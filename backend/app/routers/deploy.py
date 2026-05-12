"""Deploy router — deploy projects locally via Docker or remotely via SSH."""

from __future__ import annotations

import io
import json
import logging
import socket
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..security import get_current_user_from_header
from ..services.code_generator import render_bundle
from ..services.project_service import project_service

logger = logging.getLogger("apimaker.deploy")
router = APIRouter(prefix="/api/deploy", tags=["deploy"])

DEPLOY_ROOT = Path(__file__).resolve().parent.parent.parent / "deployments"
TRACKING_FILE = DEPLOY_ROOT / ".deployments.json"
PORT_RANGE = range(8080, 8100)


class LocalDeployRequest(BaseModel):
    project_id: str
    port: int = 8080


class DeployStatus(BaseModel):
    status: str
    url: str | None = None
    message: str = ""
    logs: list[str] = []


def _load_tracking() -> dict[str, Any]:
    """Load deployment tracking data."""
    if TRACKING_FILE.exists():
        try:
            return json.loads(TRACKING_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def _save_tracking(data: dict) -> None:
    """Save deployment tracking data."""
    DEPLOY_ROOT.mkdir(parents=True, exist_ok=True)
    TRACKING_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _port_is_free(port: int) -> bool:
    """Check if a port is available on the host."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return True
        except OSError:
            return False


def _find_free_port(preferred: int) -> tuple[int, list[str]]:
    """Find an available port. Returns (port, logs)."""
    logs: list[str] = []

    if _port_is_free(preferred):
        return preferred, logs

    logs.append(f"⚠️ Puerto {preferred} está ocupado. Buscando disponible...")
    for port in PORT_RANGE:
        if port == preferred:
            continue
        if _port_is_free(port):
            logs.append(f"✅ Puerto disponible encontrado: {port}")
            return port, logs

    raise HTTPException(status_code=409, detail="No hay puertos disponibles en el rango 8080-8099")


def _build_docker_compose(port: int, db_url: str) -> str:
    """Generate a docker-compose.yml for the deployed project."""
    return f"""version: '3.8'

services:
  api:
    build: .
    ports:
      - "{port}:8000"
    environment:
      - DATABASE_URL={db_url}
      - PORT=8000
    restart: unless-stopped
"""


@router.post("/local/stop")
def stop_deployment(slug: str, _=Depends(get_current_user_from_header)) -> DeployStatus:
    """Stop a local deployment."""
    deploy_dir = DEPLOY_ROOT / slug
    if not deploy_dir.exists():
        raise HTTPException(status_code=404, detail="Deployment not found")

    try:
        subprocess.run(
            ["docker", "compose", "down", "--remove-orphans"],
            cwd=str(deploy_dir), capture_output=True, text=True, timeout=60,
        )
    except Exception as e:
        return DeployStatus(status="error", message=str(e))

    tracking = _load_tracking()
    if slug in tracking:
        tracking[slug]["status"] = "stopped"
        _save_tracking(tracking)

    return DeployStatus(status="stopped", message="Deployment stopped")


@router.get("/local/ports")
def list_ports() -> dict:
    """List used and available ports for local deployments."""
    used: list[int] = []
    available: list[int] = []
    for p in PORT_RANGE:
        if _port_is_free(p):
            available.append(p)
        else:
            used.append(p)
    tracked = _load_tracking()
    return {
        "used": used,
        "available": available,
        "deployments": tracked,
    }


@router.post("/local")
def deploy_local(req: LocalDeployRequest, session: Session = Depends(get_session), _=Depends(get_current_user_from_header)) -> DeployStatus:
    """Deploy a project locally using Docker."""
    logs: list[str] = []

    data = project_service.get_project_with_data(session, req.project_id)
    project = data["project"]
    datasets_with_fields = data["datasets"]
    endpoints = data["endpoints"]

    slug = project.slug or str(project.id)
    deploy_dir = DEPLOY_ROOT / slug

    # Check port and find available one if needed
    port, port_logs = _find_free_port(req.port)
    logs.extend(port_logs)

    # Stop existing container for this project if redeploying
    if deploy_dir.exists():
        logs.append("🔄 Deteniendo contenedor anterior...")
        subprocess.run(
            ["docker", "compose", "down", "--remove-orphans"],
            cwd=str(deploy_dir), capture_output=True, timeout=30,
        )
        shutil.rmtree(deploy_dir)
    deploy_dir.mkdir(parents=True, exist_ok=True)
    logs.append(f"📁 Directorio: {deploy_dir}")

    # Generate bundle
    logs.append("📦 Generando código...")
    try:
        zip_bytes = render_bundle(
            project.target_stack or "fastapi",
            project.name,
            project.description,
            project.auth_method,
            project.api_key,
            project.jwt_secret,
            project.rate_limit,
            datasets_with_fields,
            endpoints,
            True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {e}")

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(str(deploy_dir))
    logs.append("✅ Código extraído")

    db_path = deploy_dir / "data.db"
    db_url = f"sqlite:///{db_path}"
    compose = _build_docker_compose(port, db_url)
    (deploy_dir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    logs.append(f"📝 docker-compose.yml (puerto {port})")

    # Check Docker
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logs.append("⚠️ Docker no disponible. Instrucciones:")
        logs.append(f"   cd {deploy_dir} && docker compose up -d --build")
        return DeployStatus(status="no_docker", logs=logs)

    logs.append("🐳 Levantando contenedor...")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d", "--build"],
            cwd=str(deploy_dir),
            capture_output=True, text=True, timeout=300,
        )
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f"❌ {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs)
    except subprocess.TimeoutExpired:
        logs.append("⏱️ Timeout (>5min)")
        return DeployStatus(status="timeout", logs=logs)

    # Track deployment
    tracking = _load_tracking()
    tracking[slug] = {
        "name": project.name,
        "port": port,
        "url": f"http://localhost:{port}",
        "stack": project.target_stack,
        "status": "running",
        "deployed_at": str(subprocess.run(
            ["date"], capture_output=True, text=True
        ).stdout.strip()),
    }
    _save_tracking(tracking)

    url = f"http://localhost:{port}"
    logs.append(f"✅ API en {url}/api")
    logs.append(f"📌 Deployments activos:")
    for s, d in _load_tracking().items():
        logs.append(f"   {d['name']}: {d['url']}/api")

    return DeployStatus(status="running", url=url, logs=logs, message=f"Deploy exitoso en puerto {port}")
