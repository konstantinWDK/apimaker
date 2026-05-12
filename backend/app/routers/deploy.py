"""Deploy router — deploy projects locally via Docker or remotely via SSH."""

from __future__ import annotations

import io
import logging
import shutil
import subprocess
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..services.code_generator import render_bundle
from ..services.project_service import project_service

logger = logging.getLogger("apimaker.deploy")
router = APIRouter(prefix="/api/deploy", tags=["deploy"])

DEPLOY_ROOT = Path(__file__).resolve().parent.parent.parent / "deployments"


class LocalDeployRequest(BaseModel):
    project_id: str
    port: int = 8080


class DeployStatus(BaseModel):
    status: str
    url: str | None = None
    message: str = ""
    logs: list[str] = []


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
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
"""


@router.post("/local")
def deploy_local(req: LocalDeployRequest, session: Session = Depends(get_session)) -> DeployStatus:
    """Deploy a project locally using Docker."""
    logs: list[str] = []

    data = project_service.get_project_with_data(session, req.project_id)
    project = data["project"]
    datasets_with_fields = data["datasets"]
    endpoints = data["endpoints"]

    slug = project.slug or str(project.id)
    deploy_dir = DEPLOY_ROOT / slug
    logs.append(f"📁 Preparando directorio: {deploy_dir}")

    if deploy_dir.exists():
        shutil.rmtree(deploy_dir)
    deploy_dir.mkdir(parents=True, exist_ok=True)

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

    # Extract bundle
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(str(deploy_dir))
    logs.append(f"✅ Código extraído")

    # Use SQLite for deploy (point to a project-specific DB)
    db_path = deploy_dir / "data.db"
    db_url = f"sqlite:///{db_path}"

    # Write docker-compose
    compose = _build_docker_compose(req.port, db_url)
    (deploy_dir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    logs.append(f"📝 docker-compose.yml (puerto {req.port})")

    # Check Docker is available
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logs.append("⚠️ Docker no disponible. Instrucciones manuales:")
        logs.append(f"   cd {deploy_dir} && docker compose up -d --build")
        return DeployStatus(status="no_docker", logs=logs, message="Docker no disponible")

    # Run docker compose
    logs.append("🐳 Construyendo y levantando contenedor...")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d", "--build"],
            cwd=str(deploy_dir),
            capture_output=True, text=True, timeout=300,
        )
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f"❌ Error: {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs, message=result.stderr.strip())
    except subprocess.TimeoutExpired:
        logs.append("⏱️ Timeout (>5min)")
        return DeployStatus(status="timeout", logs=logs)

    url = f"http://localhost:{req.port}"
    logs.append(f"✅ API en {url}/api")

    return DeployStatus(status="running", url=url, logs=logs, message="Deploy exitoso")
