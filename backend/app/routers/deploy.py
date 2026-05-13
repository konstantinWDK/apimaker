"""Deploy router — deploy projects locally via Docker or remotely via SSH."""

from __future__ import annotations

import json
import logging
import os
import socket
import shutil
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..services.project_service import project_service

logger = logging.getLogger("apimaker.deploy")
router = APIRouter(prefix="/api/deploy", tags=["deploy"])

# When running inside Docker, APIMAKER_DEPLOY_HOST_PATH maps the container's
# /app to the host path so generated docker-compose volumes work correctly.
_HOST_PATH = os.environ.get("APIMAKER_DEPLOY_HOST_PATH", "").strip()
if _HOST_PATH:
    _HOST_PATH = _HOST_PATH.rstrip("/")

def _host_path(container_path: str) -> str:
    """Convert a container path to a host path using APIMAKER_DEPLOY_HOST_PATH."""
    if _HOST_PATH and container_path.startswith("/app"):
        return container_path.replace("/app", _HOST_PATH, 1)
    return container_path

# Resolve project root — works both natively and inside Docker
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if _HOST_PATH:
    _PROJECT_ROOT = Path(_HOST_PATH)

DEPLOY_ROOT = _PROJECT_ROOT / "deployments"
BACKEND_DIR = _PROJECT_ROOT / "backend"
TRACKING_FILE = DEPLOY_ROOT / ".deployments.json"
PORT_RANGE = range(8080, 8100)
DEPLOY_IMAGE = "apimaker-deploy:latest"


class LocalDeployRequest(BaseModel):
    project_id: str
    port: int = 8080
    db_type: str = "sqlite"
    db_host: str | None = None
    db_port: int | None = None
    db_user: str | None = None
    db_password: str | None = None
    db_name: str | None = None
    deploy_postgres_mode: str | None = None  # "existing" or "new_container"


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


def _ensure_deploy_image(logs: list[str]) -> bool:
    """Build the deploy Docker image locally if it doesn't exist."""
    try:
        result = subprocess.run(
            ["docker", "image", "inspect", DEPLOY_IMAGE],
            capture_output=True, timeout=10,
        )
        if result.returncode == 0:
            return True
    except Exception:
        pass

    logs.append(f"🐳 Construyendo imagen local {DEPLOY_IMAGE}...")
    try:
        result = subprocess.run(
            ["docker", "build", "-t", DEPLOY_IMAGE, "-f", "Dockerfile", "."],
            cwd=str(BACKEND_DIR),
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode != 0:
            logs.append(f"❌ Error construyendo imagen: {result.stderr.strip()[:300]}")
            return False
        logs.append("✅ Imagen construida")
        return True
    except subprocess.TimeoutExpired:
        logs.append("⏱️ Timeout construyendo imagen (>5min)")
        return False
    except Exception as e:
        logs.append(f"❌ Error: {str(e)}")
        return False


def _build_docker_compose(port: int, slug: str, db_url: str, include_postgres_container: bool = False) -> str:
    """Generate a docker-compose.yml using the local deploy image."""
    volumes_path = _host_path(str(_PROJECT_ROOT / "deployments"))

    if include_postgres_container:
        pg_user = "apimaker"
        pg_pass = "deploy_secret_$(date +%s)"
        pg_db = "api_deploy"
        return f"""services:
  api:
    image: {DEPLOY_IMAGE}
    ports:
      - "{port}:8000"
    environment:
      - APIMAKER_DEPLOY_DB_URL=postgresql+psycopg2://{pg_user}:{pg_pass}@db:5432/{pg_db}
    command: python -m app.deploy_entrypoint /app/deployments/{slug}/project.json 8000
    volumes:
      - {volumes_path}:/app/deployments
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER={pg_user}
      - POSTGRES_PASSWORD={pg_pass}
      - POSTGRES_DB={pg_db}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U {pg_user} -d {pg_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
"""

    return f"""services:
  api:
    image: {DEPLOY_IMAGE}
    ports:
      - "{port}:8000"
    environment:
      - APIMAKER_DEPLOY_DB_URL={db_url}
    command: python -m app.deploy_entrypoint /app/deployments/{slug}/project.json 8000
    volumes:
      - {volumes_path}:/app/deployments
    restart: unless-stopped
"""


@router.post("/local/stop")
def stop_deployment(req: SlugRequest) -> DeployStatus:
    """Stop a local deployment."""
    slug = req.slug
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


@router.post("/local/start")
def start_deployment(req: SlugRequest) -> DeployStatus:
    """Start a stopped deployment."""
    slug = req.slug
    deploy_dir = DEPLOY_ROOT / slug
    if not deploy_dir.exists():
        raise HTTPException(status_code=404, detail="Deployment not found")
    try:
        subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=str(deploy_dir), capture_output=True, text=True, timeout=120,
        )
    except subprocess.TimeoutExpired:
        return DeployStatus(status="timeout", message="Timeout starting container")
    except Exception as e:
        return DeployStatus(status="error", message=str(e))
    tracking = _load_tracking()
    if slug in tracking:
        tracking[slug]["status"] = "running"
        _save_tracking(tracking)
    return DeployStatus(status="running", message="Deployment started")


@router.post("/local/restart")
def restart_deployment(req: SlugRequest) -> DeployStatus:
    """Restart a deployment."""
    slug = req.slug
    deploy_dir = DEPLOY_ROOT / slug
    if not deploy_dir.exists():
        raise HTTPException(status_code=404, detail="Deployment not found")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=str(deploy_dir), capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return DeployStatus(status="error", message=result.stderr.strip()[:300], logs=[result.stderr.strip()])
    except subprocess.TimeoutExpired:
        return DeployStatus(status="timeout", message="Timeout restarting")
    except Exception as e:
        return DeployStatus(status="error", message=str(e))
    tracking = _load_tracking()
    if slug in tracking:
        tracking[slug]["status"] = "running"
        _save_tracking(tracking)
    return DeployStatus(status="running", message="Deployment restarted")


class SlugRequest(BaseModel):
    slug: str


class RemoteDeployRequest(BaseModel):
    project_id: str
    host: str
    user: str
    port: int = 22
    api_port: int = 8080
    ssh_key: str = ""
    password: str = ""


@router.post("/remote")
def deploy_remote(req: RemoteDeployRequest, session: Session = Depends(get_session)) -> DeployStatus:
    """Deploy a project to a remote VPS via SSH + Docker."""
    import tempfile

    logs: list[str] = []

    resolved = project_service.resolve_id(session, req.project_id)
    data = project_service.get_project_with_data(session, resolved)
    project = data["project"]
    slug = project.slug or str(project.id)
    remote_dir = f"/opt/apimaker/{slug}"
    remote_url = f"{req.user}@{req.host}"

    logs.append(f"🔌 Conectando a {remote_url}...")

    # Build SSH command prefix
    ssh_base = ["ssh", remote_url, "-p", str(req.port), "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]
    scp_base = ["scp", "-P", str(req.port), "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]

    key_file = None
    if req.ssh_key:
        key_file = tempfile.NamedTemporaryFile(mode="w", suffix=".key", delete=False)
        key_file.write(req.ssh_key)
        key_file.close()
        ssh_base.extend(["-i", key_file.name])
        scp_base.extend(["-i", key_file.name])

    try:
        # Create remote directory
        logs.append("📁 Creando directorio remoto...")
        subprocess.run(ssh_base + [f"mkdir -p {remote_dir}"], capture_output=True, text=True, timeout=15)

        # Export project as JSON
        logs.append("📦 Exportando proyecto...")
        from ..routers.projects import _db_to_pydantic
        export_data = _db_to_pydantic(project, data["datasets"], data["endpoints"])
        json_path = Path(tempfile.gettempdir()) / f"{slug}-project.json"
        json_path.write_text(export_data.model_dump_json(indent=2))

        logs.append("📄 Subiendo project.json al servidor...")
        subprocess.run(scp_base + [str(json_path), f"{remote_url}:{remote_dir}/project.json"], capture_output=True, text=True, timeout=30)
        json_path.unlink(missing_ok=True)

        # Deploy via SSH using the CLI on the remote server
        logs.append("🐳 Desplegando en el servidor remoto...")
        deploy_cmd = (
            f"cd {remote_dir} && "
            f"pip install apimaker-backend -q --no-cache-dir && "
            f"apimaker deploy project.json --port {req.api_port}"
        )
        result = subprocess.run(ssh_base + [deploy_cmd], capture_output=True, text=True, timeout=300)
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f"❌ {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs)

        url = f"http://{req.host}:{req.api_port}/api"
        logs.append(f"✅ API desplegada en {url}")

        # Track deployment
        tracking = _load_tracking()
        tracking[f"{slug}-remote"] = {
            "name": project.name, "host": req.host, "port": req.api_port,
            "url": url, "stack": project.target_stack, "status": "running",
        }
        _save_tracking(tracking)

        return DeployStatus(status="running", url=url, logs=logs, message="Deploy remoto exitoso")

    except subprocess.TimeoutExpired:
        logs.append("⏱️ Timeout en conexión SSH")
        return DeployStatus(status="timeout", logs=logs)
    except Exception as e:
        logs.append(f"❌ Error: {str(e)}")
        return DeployStatus(status="error", logs=logs)
    finally:
        if key_file:
            Path(key_file.name).unlink(missing_ok=True)


@router.post("/local/delete")
def delete_deployment(req: SlugRequest) -> DeployStatus:
    """Stop and remove a local deployment entirely."""
    slug = req.slug
    deploy_dir = DEPLOY_ROOT / slug
    logs: list[str] = []
    if deploy_dir.exists():
        subprocess.run(
            ["docker", "compose", "down", "--remove-orphans", "-v"],
            cwd=str(deploy_dir), capture_output=True, timeout=60,
        )
        shutil.rmtree(deploy_dir)
        logs.append("📁 Directorio de deploy eliminado")
    else:
        logs.append("📭 No hay directorio de deployment")

    tracking = _load_tracking()
    if slug in tracking:
        del tracking[slug]
        _save_tracking(tracking)
        logs.append("✅ Deployment eliminado del registro")

    return DeployStatus(status="deleted", logs=logs, message="Deployment eliminado")


def _check_docker_container(slug: str) -> str:
    """Check if a Docker container is running for a deployment. Returns status string."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", f"name={slug}", "--format", "{{.Status}}"],
            capture_output=True, text=True, timeout=10,
        )
        status = result.stdout.strip()
        if "Up" in status:
            return "running"
        if "Exited" in status or "Created" in status:
            return "stopped"
        # Check if container exists (exited)
        result2 = subprocess.run(
            ["docker", "ps", "-a", "--filter", f"name={slug}", "--format", "{{.Status}}"],
            capture_output=True, text=True, timeout=10,
        )
        return "stopped" if result2.stdout.strip() else "unknown"
    except Exception:
        return "unknown"


@router.get("/list")
def list_deployments() -> list[dict]:
    """List all deployments with real-time Docker status."""
    tracking = _load_tracking()
    result: list[dict] = []
    for slug, info in tracking.items():
        entry = dict(info)
        entry["slug"] = slug
        entry["docker_status"] = _check_docker_container(slug)
        result.append(entry)
    return result


@router.get("/docker-status")
def docker_status() -> dict:
    """Check if Docker is available on this machine."""
    try:
        result = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            version = result.stdout.strip()
            # Count running containers
            ps_result = subprocess.run(
                ["docker", "ps", "-q"], capture_output=True, text=True, timeout=5,
            )
            running = len([c for c in ps_result.stdout.strip().split("\n") if c])
            return {"available": True, "version": version, "containers_running": running}
        return {"available": False, "error": result.stderr.strip()}
    except FileNotFoundError:
        return {"available": False, "error": "Docker no instalado"}
    except Exception as e:
        return {"available": False, "error": str(e)}


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


@router.post("/local/rebuild-image")
def rebuild_deploy_image() -> DeployStatus:
    """Rebuild the local deploy Docker image."""
    logs: list[str] = []
    logs.append("🗑️ Eliminando imagen anterior...")
    subprocess.run(["docker", "rmi", "-f", DEPLOY_IMAGE], capture_output=True, timeout=30)
    if _ensure_deploy_image(logs):
        return DeployStatus(status="ok", logs=logs, message="Imagen reconstruida")
    return DeployStatus(status="error", logs=logs, message="Error al reconstruir la imagen")


@router.post("/local")
def deploy_local(req: LocalDeployRequest, session: Session = Depends(get_session)) -> DeployStatus:
    """Deploy a project locally using Docker."""
    logs: list[str] = []

    resolved = project_service.resolve_id(session, req.project_id)
    data = project_service.get_project_with_data(session, resolved)
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

    # Build DB URL for the deployed API
    include_postgres_container = False
    if req.db_type == "postgresql":
        if req.deploy_postgres_mode == "new_container":
            include_postgres_container = True
            logs.append("🗄️ Nuevo contenedor PostgreSQL incluido en el despliegue")
            # db_url is auto-generated inside _build_docker_compose
            deploy_db_url = ""
        elif req.db_host:
            deploy_db_url = f"postgresql+psycopg2://{req.db_user}:{req.db_password}@{req.db_host}:{req.db_port}/{req.db_name or 'api'}"
            logs.append(f"🗄️ Usando PostgreSQL existente: {req.db_host}:{req.db_port}/{req.db_name}")
        else:
            deploy_db_url = f"sqlite:////app/deployments/{slug}/data.db"
            logs.append("🗄️ Usando SQLite embebida (persistente en disco)")
    else:
        deploy_db_url = f"sqlite:////app/deployments/{slug}/data.db"
        logs.append("🗄️ Usando SQLite embebida (persistente en disco)")

    # Export project as JSON for the standalone server
    from ..routers.projects import _db_to_pydantic
    export_data = _db_to_pydantic(project, datasets_with_fields, endpoints)
    (deploy_dir / "project.json").write_text(
        export_data.model_dump_json(indent=2),
        encoding="utf-8",
    )
    logs.append("📄 Proyecto exportado a project.json")

    # Write docker-compose.yml
    compose = _build_docker_compose(port, slug, deploy_db_url, include_postgres_container)
    (deploy_dir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    logs.append(f"📝 docker-compose.yml (puerto {port})")

    # Check Docker
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logs.append("⚠️ Docker no disponible. Instrucciones:")
        logs.append(f"   cd {deploy_dir} && docker compose up -d")
        return DeployStatus(status="no_docker", logs=logs)

    # Build or verify local deploy image
    if not _ensure_deploy_image(logs):
        logs.append("❌ No se pudo preparar la imagen Docker. Revisa los logs.")
        return DeployStatus(status="error", logs=logs, message="Error preparando imagen Docker")

    logs.append("🐳 Levantando contenedor...")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=str(deploy_dir),
            capture_output=True, text=True, timeout=120,
        )
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f"❌ {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs)
    except subprocess.TimeoutExpired:
        logs.append("⏱️ Timeout (>2min)")
        return DeployStatus(status="timeout", logs=logs)

    # Build endpoint list from the generated project
    deployed_endpoints = sorted(set(
        f"{ep.method} {ep.path}" for ep in endpoints
    ))

    # Track deployment
    tracking = _load_tracking()
    tracking[slug] = {
        "name": project.name,
        "port": port,
        "url": f"http://localhost:{port}/api",
        "stack": project.target_stack,
        "status": "running",
        "endpoints": deployed_endpoints,
        "deployed_at": str(subprocess.run(
            ["date"], capture_output=True, text=True
        ).stdout.strip()),
    }
    _save_tracking(tracking)

    url = f"http://localhost:{port}/api"
    logs.append(f"✅ API en {url}")
    logs.append(f"📌 Deployments activos:")
    for s, d in _load_tracking().items():
        logs.append(f"   {d['name']}: {d['url']}")

    return DeployStatus(status="running", url=url, logs=logs, message=f"Deploy exitoso en puerto {port}")
