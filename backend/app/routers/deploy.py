"""Deploy router — deploy projects locally via Docker or remotely via SSH."""

from __future__ import annotations

import json
import logging
import os
import re
import socket
import shutil
import subprocess

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..security import CurrentUser, require_admin
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

# Resolve paths
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_IS_DOCKER = Path("/.dockerenv").exists() or os.environ.get("APIMAKER_DEPLOY_HOST_PATH") is not None

if _IS_DOCKER:
    DEPLOY_ROOT = BACKEND_DIR / "deployments"
else:
    DEPLOY_ROOT = BACKEND_DIR.parent / "deployments"

TRACKING_FILE = DEPLOY_ROOT / ".deployments.json"
PORT_RANGE = range(8080, 8100)
DEPLOY_IMAGE = "apimaker-deploy:latest"


def _safe_slug(slug: str) -> str:
    """Validate deployment slugs before using them as directory names."""
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,120}", slug or ""):
        raise HTTPException(status_code=400, detail="Invalid deployment slug")
    return slug


def _deploy_password_for_slug(slug: str) -> str:
    """Derive a stable DB password from the deployment slug."""
    import hashlib
    return hashlib.sha256(slug.encode()).hexdigest()[:16]

def _deploy_dir_for_slug(slug: str) -> Path:
    deploy_dir = (DEPLOY_ROOT / _safe_slug(slug)).resolve()
    root = DEPLOY_ROOT.resolve()
    if root != deploy_dir and root not in deploy_dir.parents:
        raise HTTPException(status_code=400, detail="Invalid deployment path")
    return deploy_dir


def _get_host_deploy_root() -> str:
    """Find the absolute host path for the deployments folder."""
    # 1. Check if we have an explicit host path from environment
    env_path = os.environ.get("APIMAKER_DEPLOY_HOST_PATH", "").strip()
    if env_path and env_path != ".":
        return env_path.replace("\\", "/").rstrip("/") + "/deployments"

    # 2. If in Docker, try to inspect ourselves to find the real host mount
    if Path("/.dockerenv").exists():
        try:
            # We try to find the mount for '/app/deployments' or '/app'
            # Note: hostname in docker is usually the container ID
            cid = socket.gethostname()
            res = subprocess.run(
                ["docker", "inspect", cid, "--format", "{{json .Mounts}}"],
                capture_output=True, text=True, timeout=5
            )
            if res.returncode == 0:
                mounts = json.loads(res.stdout)
                # Look for /app/deployments first
                for m in mounts:
                    if m.get("Destination") == "/app/deployments":
                        return m["Source"].replace("\\", "/")
                # Look for /app as fallback
                for m in mounts:
                    if m.get("Destination") == "/app":
                        return m["Source"].replace("\\", "/").rstrip("/") + "/deployments"
        except Exception:
            pass

    # 3. Fallback to '..' which works if docker compose is called from deployments/slug/
    # but only if the daemon's context is correctly aligned (often fails in Win/Mac)
    return ".."


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
    deploy_mysql_mode: str | None = None  # "existing" or "new_container"


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
    """Check if a port is available on the host. Works from inside Docker too."""
    if Path("/.dockerenv").exists():
        try:
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.Ports}}"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if f":{port}-" in line or f":{port}->" in line or f":{port}/" in line:
                        return False
        except Exception:
            pass
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

    logs.append(f" Puerto {preferred} está ocupado. Buscando disponible...")
    for port in PORT_RANGE:
        if port == preferred:
            continue
        if _port_is_free(port):
            logs.append(f" Puerto disponible encontrado: {port}")
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

    logs.append(f" Construyendo imagen local {DEPLOY_IMAGE}...")
    try:
        result = subprocess.run(
            ["docker", "build", "-t", DEPLOY_IMAGE, "-f", "Dockerfile", "."],
            cwd=str(BACKEND_DIR),
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode != 0:
            logs.append(f" Error construyendo imagen: {result.stderr.strip()[:300]}")
            return False
        logs.append(" Imagen construida")
        return True
    except subprocess.TimeoutExpired:
        logs.append(" Timeout construyendo imagen (>5min)")
        return False
    except Exception as e:
        logs.append(f" Error: {str(e)}")
        return False


def _build_docker_compose(
    port: int, slug: str, db_url: str,
    include_postgres_container: bool = False,
    pg_user: str = "apimaker",
    pg_pass: str = "",
    pg_db: str = "api_deploy",
    pg_port: int = 5432,
    include_mysql_container: bool = False,
    mysql_user: str = "apimaker",
    mysql_pass: str = "",
    mysql_db: str = "api_deploy",
    mysql_port: int = 3306,
    **kwargs: Any,
) -> str:
    """Generate a docker-compose.yml using the local deploy image."""
    if _IS_DOCKER:
        volumes_path = _get_host_deploy_root()
    else:
        volumes_path = str(DEPLOY_ROOT)

    if include_postgres_container:
        if not pg_pass:
            pg_pass = f"deploy_secret_{int(Path(__file__).stat().st_mtime)}"
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
    ports:
      - "127.0.0.1:{pg_port}:5432"
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

    if include_mysql_container:
        if not mysql_pass:
            mysql_pass = f"deploy_secret_{int(Path(__file__).stat().st_mtime)}"
        return f"""services:
  api:
    image: {DEPLOY_IMAGE}
    ports:
      - "{port}:8000"
    environment:
      - APIMAKER_DEPLOY_DB_URL=mysql+pymysql://{mysql_user}:{mysql_pass}@db:3306/{mysql_db}
    command: python -m app.deploy_entrypoint /app/deployments/{slug}/project.json 8000
    volumes:
      - {volumes_path}:/app/deployments
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mysql:8.0
    ports:
      - "127.0.0.1:{mysql_port}:3306"
    environment:
      - MYSQL_ROOT_PASSWORD={mysql_pass}
      - MYSQL_DATABASE={mysql_db}
      - MYSQL_USER={mysql_user}
      - MYSQL_PASSWORD={mysql_pass}
    volumes:
      - mysqldata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysqldata:
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
def stop_deployment(req: SlugRequest, user: CurrentUser = Depends(require_admin)) -> DeployStatus:
    """Stop a local deployment."""
    slug = _safe_slug(req.slug)
    deploy_dir = _deploy_dir_for_slug(slug)
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
def start_deployment(req: SlugRequest, user: CurrentUser = Depends(require_admin)) -> DeployStatus:
    """Start a stopped deployment."""
    slug = _safe_slug(req.slug)
    deploy_dir = _deploy_dir_for_slug(slug)
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
def restart_deployment(req: SlugRequest, user: CurrentUser = Depends(require_admin)) -> DeployStatus:
    """Restart a deployment."""
    slug = _safe_slug(req.slug)
    deploy_dir = _deploy_dir_for_slug(slug)
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


class RedeployRequest(BaseModel):
    slug: str
    project_id: str | None = None


def _export_project_json(session: Session, project_id: str, target_path: Path) -> tuple[Any, list[str]]:
    """Write the latest builder project definition for a deployment."""
    from ..routers.projects import _db_to_pydantic

    resolved = project_service.resolve_id(session, project_id)
    data = project_service.get_project_with_data(session, resolved)
    project = data["project"]
    export_data = _db_to_pydantic(project, data["datasets"], data["endpoints"], include_secrets=True)
    target_path.write_text(export_data.model_dump_json(indent=2), encoding="utf-8")
    deployed_endpoints = sorted(set(f"{ep.method} {ep.path}" for ep in data["endpoints"]))
    return project, deployed_endpoints


class RemoteDeployRequest(BaseModel):
    project_id: str
    host: str
    user: str
    port: int = 22
    api_port: int = 8080
    ssh_key: str = ""
    password: str = ""


@router.post("/remote")
def deploy_remote(
    req: RemoteDeployRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> DeployStatus:
    """Deploy a project to a remote VPS via SSH + Docker."""
    import tempfile

    logs: list[str] = []

    resolved = project_service.resolve_id(session, req.project_id)
    data = project_service.get_project_with_data(session, resolved)
    project = data["project"]
    slug = _safe_slug(project.slug or str(project.id))
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,64}", req.user):
        raise HTTPException(status_code=400, detail="Invalid SSH user")
    if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,253}", req.host):
        raise HTTPException(status_code=400, detail="Invalid SSH host")
    if not (1 <= req.port <= 65535 and 1 <= req.api_port <= 65535):
        raise HTTPException(status_code=400, detail="Invalid port")
    remote_dir = f"/opt/apimaker/{slug}"
    remote_url = f"{req.user}@{req.host}"

    logs.append(f" Conectando a {remote_url}...")

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
        logs.append(" Creando directorio remoto...")
        subprocess.run(ssh_base + [f"mkdir -p {remote_dir}"], capture_output=True, text=True, timeout=15)

        # Export project as JSON
        logs.append(" Exportando proyecto...")
        from ..routers.projects import _db_to_pydantic
        export_data = _db_to_pydantic(project, data["datasets"], data["endpoints"], include_secrets=True)
        json_path = Path(tempfile.gettempdir()) / f"{slug}-project.json"
        json_path.write_text(export_data.model_dump_json(indent=2))

        logs.append(" Subiendo project.json al servidor...")
        subprocess.run(scp_base + [str(json_path), f"{remote_url}:{remote_dir}/project.json"], capture_output=True, text=True, timeout=30)
        json_path.unlink(missing_ok=True)

        # Deploy via SSH using the CLI on the remote server
        logs.append(" Desplegando en el servidor remoto...")
        deploy_cmd = (
            f"cd {remote_dir} && "
            f"pip install apimaker-backend -q --no-cache-dir && "
            f"apimaker deploy project.json --port {req.api_port}"
        )
        result = subprocess.run(ssh_base + [deploy_cmd], capture_output=True, text=True, timeout=300)
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f" {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs)

        url = f"http://{req.host}:{req.api_port}/api"
        logs.append(f" API desplegada en {url}")

        # Track deployment
        tracking = _load_tracking()
        tracking[f"{slug}-remote"] = {
            "name": project.name, "host": req.host, "port": req.api_port,
            "url": url, "stack": project.target_stack, "status": "running",
        }
        _save_tracking(tracking)

        return DeployStatus(status="running", url=url, logs=logs, message="Deploy remoto exitoso")

    except subprocess.TimeoutExpired:
        logs.append(" Timeout en conexión SSH")
        return DeployStatus(status="timeout", logs=logs)
    except Exception as e:
        logs.append(f" Error: {str(e)}")
        return DeployStatus(status="error", logs=logs)
    finally:
        if key_file:
            Path(key_file.name).unlink(missing_ok=True)


@router.post("/local/delete")
def delete_deployment(req: SlugRequest, user: CurrentUser = Depends(require_admin)) -> DeployStatus:
    """Stop and remove a local deployment entirely."""
    slug = _safe_slug(req.slug)
    deploy_dir = _deploy_dir_for_slug(slug)
    logs: list[str] = []
    if deploy_dir.exists():
        subprocess.run(
            ["docker", "compose", "down", "--remove-orphans", "-v"],
            cwd=str(deploy_dir), capture_output=True, timeout=60,
        )
        shutil.rmtree(deploy_dir)
        logs.append(" Directorio de deploy eliminado")
    else:
        logs.append(" No hay directorio de deployment")

    tracking = _load_tracking()
    if slug in tracking:
        del tracking[slug]
        _save_tracking(tracking)
        logs.append(" Deployment eliminado del registro")

    return DeployStatus(status="deleted", logs=logs, message="Deployment eliminado")


@router.post("/local/redeploy")
def redeploy_local(
    req: RedeployRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> DeployStatus:
    """Apply the latest project definition to an existing local deployment."""
    slug = _safe_slug(req.slug)
    deploy_dir = _deploy_dir_for_slug(slug)
    logs: list[str] = []
    if not deploy_dir.exists():
        raise HTTPException(status_code=404, detail="Deployment not found")

    project_ref = req.project_id or slug
    project, deployed_endpoints = _export_project_json(session, project_ref, deploy_dir / "project.json")
    logs.append(" Proyecto actualizado en project.json")

    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d", "--force-recreate", "--remove-orphans"],
            cwd=str(deploy_dir), capture_output=True, text=True, timeout=180,
        )
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(result.stderr.strip()[:500])
            return DeployStatus(status="error", logs=logs, message="Error recreando deployment")
    except subprocess.TimeoutExpired:
        logs.append(" Timeout recreando contenedor (>3min)")
        return DeployStatus(status="timeout", logs=logs)
    except Exception as e:
        logs.append(f" Error: {str(e)}")
        return DeployStatus(status="error", logs=logs)

    tracking = _load_tracking()
    if slug in tracking:
        tracking[slug]["name"] = project.name
        tracking[slug]["stack"] = project.target_stack
        tracking[slug]["status"] = "running"
        tracking[slug]["endpoints"] = deployed_endpoints
        tracking[slug]["deployed_at"] = str(subprocess.run(
            ["date"], capture_output=True, text=True
        ).stdout.strip())
        _save_tracking(tracking)

    url = tracking.get(slug, {}).get("url") if tracking else None
    logs.append(" Cambios aplicados al deployment")
    return DeployStatus(status="running", url=url, logs=logs, message="Redeploy completado")


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
def list_deployments(user: CurrentUser = Depends(require_admin)) -> list[dict]:
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
def docker_status(user: CurrentUser = Depends(require_admin)) -> dict:
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
def list_ports(user: CurrentUser = Depends(require_admin)) -> dict:
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


@router.get("/local/check-port")
def check_port(port: int, user: CurrentUser = Depends(require_admin)) -> dict:
    """Check if a specific port is available on the host."""
    if not 1 <= port <= 65535:
        raise HTTPException(status_code=400, detail="Invalid port")
    return {"port": port, "free": _port_is_free(port)}


@router.post("/local/rebuild-image")
def rebuild_deploy_image(user: CurrentUser = Depends(require_admin)) -> DeployStatus:
    """Rebuild the local deploy Docker image."""
    logs: list[str] = []
    logs.append(" Eliminando imagen anterior...")
    subprocess.run(["docker", "rmi", "-f", DEPLOY_IMAGE], capture_output=True, timeout=30)
    if _ensure_deploy_image(logs):
        return DeployStatus(status="ok", logs=logs, message="Imagen reconstruida")
    return DeployStatus(status="error", logs=logs, message="Error al reconstruir la imagen")


@router.post("/local")
def deploy_local(
    req: LocalDeployRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> DeployStatus:
    """Deploy a project locally using Docker."""
    logs: list[str] = []

    resolved = project_service.resolve_id(session, req.project_id)
    data = project_service.get_project_with_data(session, resolved)
    project = data["project"]
    endpoints = data["endpoints"]

    slug = _safe_slug(project.slug or str(project.id))
    deploy_dir = _deploy_dir_for_slug(slug)

    # Stop the existing deployment for this project before checking the port.
    # Otherwise redeploying on the same port would be seen as a conflict.
    if deploy_dir.exists():
        logs.append(" Deteniendo contenedor anterior...")
        subprocess.run(
            ["docker", "compose", "down", "--remove-orphans", "-v"],
            cwd=str(deploy_dir), capture_output=True, timeout=30,
        )
        shutil.rmtree(deploy_dir)

    # Check port and find available one if needed
    port, port_logs = _find_free_port(req.port)
    logs.extend(port_logs)

    deploy_dir.mkdir(parents=True, exist_ok=True)
    logs.append(f" Directorio: {deploy_dir}")

    # Build DB URL for the deployed API
    include_postgres_container = False
    include_mysql_container = False
    
    container_pg_user = container_pg_pass = container_pg_db = ""
    container_mysql_user = container_mysql_pass = container_mysql_db = ""

    if req.db_type == "postgresql":
        if req.deploy_postgres_mode == "new_container":
            include_postgres_container = True
            container_pg_user = req.db_user or "apimaker"
            container_pg_pass = req.db_password or _deploy_password_for_slug(slug)
            container_pg_db = req.db_name or "api_deploy"
            logs.append(f" Nuevo contenedor PostgreSQL: usuario={container_pg_user}, bd={container_pg_db}")
            deploy_db_url = ""
        elif req.db_host:
            deploy_db_url = f"postgresql+psycopg2://{req.db_user}:{req.db_password}@{req.db_host}:{req.db_port}/{req.db_name or 'api'}"
            logs.append(f" Usando PostgreSQL existente: {req.db_host}:{req.db_port}/{req.db_name}")
        else:
            deploy_db_url = f"sqlite:////app/deployments/{slug}/data.db"
            logs.append(" Usando SQLite embebida (persistente en disco)")
    elif req.db_type == "mysql":
        if req.deploy_mysql_mode == "new_container":
            include_mysql_container = True
            container_mysql_user = req.db_user or "apimaker"
            container_mysql_pass = req.db_password or _deploy_password_for_slug(slug)
            container_mysql_db = req.db_name or "api_deploy"
            logs.append(f" Nuevo contenedor MySQL: usuario={container_mysql_user}, bd={container_mysql_db}")
            deploy_db_url = ""
        elif req.db_host:
            deploy_db_url = f"mysql+pymysql://{req.db_user}:{req.db_password}@{req.db_host}:{req.db_port}/{req.db_name or 'api'}"
            logs.append(f" Usando MySQL existente: {req.db_host}:{req.db_port}/{req.db_name}")
        else:
            deploy_db_url = f"sqlite:////app/deployments/{slug}/data.db"
            logs.append(" Usando SQLite embebida (persistente en disco)")
    else:
        deploy_db_url = f"sqlite:////app/deployments/{slug}/data.db"
        logs.append(" Usando SQLite embebida (persistente en disco)")

    # Export project as JSON for the standalone server
    _export_project_json(session, project.id, deploy_dir / "project.json")
    logs.append(" Proyecto exportado a project.json")

    # Write docker-compose.yml
    if include_postgres_container:
        if req.db_port:
            pg_host_port = req.db_port
        elif _port_is_free(5432):
            pg_host_port = 5432
        else:
            pg_host_port = port + 1
            logs.append(f" Puerto 5432 ocupado, usando {pg_host_port}")
        compose = _build_docker_compose(
            port=port, slug=slug, db_url="",
            include_postgres_container=True,
            pg_user=container_pg_user, pg_pass=container_pg_pass, pg_db=container_pg_db,
            pg_port=pg_host_port,
        )
    elif include_mysql_container:
        if req.db_port:
            mysql_host_port = req.db_port
        elif _port_is_free(3306):
            mysql_host_port = 3306
        else:
            mysql_host_port = port + 1
            logs.append(f" Puerto 3306 ocupado, usando {mysql_host_port}")
        compose = _build_docker_compose(
            port=port, slug=slug, db_url="",
            include_mysql_container=True,
            mysql_user=container_mysql_user, mysql_pass=container_mysql_pass, mysql_db=container_mysql_db,
            mysql_port=mysql_host_port,
        )
    else:
        compose = _build_docker_compose(
            port=port, slug=slug, db_url=deploy_db_url
        )
    (deploy_dir / "docker-compose.yml").write_text(compose, encoding="utf-8")
    logs.append(f" docker-compose.yml (puerto {port})")

    # Check Docker
    try:
        subprocess.run(["docker", "--version"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logs.append(" Docker no disponible. Instrucciones:")
        logs.append(f"   cd {deploy_dir} && docker compose up -d")
        return DeployStatus(status="no_docker", logs=logs)

    # Build or verify local deploy image
    if not _ensure_deploy_image(logs):
        logs.append(" No se pudo preparar la imagen Docker. Revisa los logs.")
        return DeployStatus(status="error", logs=logs, message="Error preparando imagen Docker")

    logs.append(" Levantando contenedor...")
    try:
        result = subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=str(deploy_dir),
            capture_output=True, text=True, timeout=120,
        )
        if result.stdout.strip():
            logs.append(result.stdout.strip()[:500])
        if result.returncode != 0:
            logs.append(f" {result.stderr.strip()[:300]}")
            return DeployStatus(status="error", logs=logs)
    except subprocess.TimeoutExpired:
        logs.append(" Timeout (>2min)")
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
        "db_type": "postgresql" if include_postgres_container else ("mysql" if include_mysql_container else req.db_type),
        "deployed_at": str(subprocess.run(
            ["date"], capture_output=True, text=True
        ).stdout.strip()),
    }
    if include_postgres_container:
        tracking[slug]["db_credentials"] = {
            "user": container_pg_user,
            "password": container_pg_pass,
            "database": container_pg_db,
            "host": "localhost",
            "port": pg_host_port,
        }
    elif include_mysql_container:
        tracking[slug]["db_credentials"] = {
            "user": container_mysql_user,
            "password": container_mysql_pass,
            "database": container_mysql_db,
            "host": "localhost",
            "port": mysql_host_port,
        }
    _save_tracking(tracking)

    url = f"http://localhost:{port}/api"
    logs.append(f" API en {url}")
    logs.append(f" Deployments activos:")
    for s, d in _load_tracking().items():
        logs.append(f"   {d['name']}: {d['url']}")

    return DeployStatus(status="running", url=url, logs=logs, message=f"Deploy exitoso en puerto {port}")
