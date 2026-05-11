"""Admin-only routes for system configuration."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, create_engine, text, select

from ..config import get_settings
from ..db import get_session, get_database_info
from ..security import CurrentUser, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

# Config file path (next to the backend app)
CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "admin_config.json"


class DatabaseConfig(BaseModel):
    database_type: str = "sqlite"  # "sqlite" or "postgresql"
    postgres_url: str | None = None
    host: str | None = None
    port: int | None = 5432
    username: str | None = None
    password: str | None = None
    database: str | None = None


class UpdateConfigRequest(BaseModel):
    environment: str  # "dev" or "prod"
    config: DatabaseConfig


class TestDbRequest(BaseModel):
    database_type: str = "postgresql"
    postgres_url: str | None = None
    host: str | None = None
    port: int = 5432
    username: str | None = None
    password: str | None = None
    database: str | None = None


class TestDbResponse(BaseModel):
    success: bool
    message: str
    database_type: str


class AdminConfigResponse(BaseModel):
    dev: DatabaseConfig
    prod: DatabaseConfig
    current_database_info: dict
    environment: str  # active environment from settings


def _read_admin_config() -> dict:
    """Read admin configuration from file with migration support."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                data = json.load(f)
            
            # Migration: if old format, move to dev
            if "dev" not in data and "prod" not in data:
                old_config = {
                    "database_type": data.get("database_type", "sqlite"),
                    "postgres_url": data.get("postgres_url"),
                    "host": data.get("host"),
                    "port": data.get("port", 5432),
                    "username": data.get("username"),
                    "password": data.get("password"),
                    "database": data.get("database"),
                }
                return {
                    "dev": old_config,
                    "prod": {**old_config, "database_type": "postgresql"} # Default prod to PG
                }
            return data
        except Exception:
            return {}
    
    # Default initial config
    default_cfg = {"database_type": "sqlite", "port": 5432}
    return {
        "dev": default_cfg,
        "prod": {**default_cfg, "database_type": "postgresql"}
    }


def _write_admin_config(config: dict) -> None:
    """Write admin configuration to file."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


@router.get("/config", response_model=AdminConfigResponse)
def get_admin_config(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> AdminConfigResponse:
    """Get current admin configuration for both environments."""
    settings = get_settings()
    admin_config = _read_admin_config()

    return AdminConfigResponse(
        dev=DatabaseConfig(**admin_config.get("dev", {})),
        prod=DatabaseConfig(**admin_config.get("prod", {})),
        current_database_info=get_database_info(),
        environment=settings.environment,
    )


@router.post("/config", status_code=status.HTTP_200_OK)
def update_admin_config(
    payload: UpdateConfigRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Update admin configuration for a specific environment."""
    admin_config = _read_admin_config()
    
    env = payload.environment
    if env not in ["dev", "prod"]:
        raise HTTPException(status_code=400, detail="Invalid environment. Use 'dev' or 'prod'.")

    cfg = payload.config
    env_data = {
        "database_type": cfg.database_type,
        "postgres_url": cfg.postgres_url,
        "host": cfg.host,
        "port": cfg.port,
        "username": cfg.username,
        "password": cfg.password,
        "database": cfg.database,
    }

    if cfg.database_type == "postgresql" and not cfg.postgres_url:
        if cfg.host and cfg.username and cfg.database:
            password = cfg.password or ""
            env_data["postgres_url"] = (
                f"postgresql+psycopg2://{cfg.username}:{password}"
                f"@{cfg.host}:{cfg.port or 5432}/{cfg.database}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either postgres_url or host/username/database for PostgreSQL",
            )

    admin_config[env] = env_data
    _write_admin_config(admin_config)

    return {
        "message": f"Configuración de {env} guardada. Reinicia el backend para aplicar los cambios si este es el entorno activo.",
        "environment": env,
    }



@router.post("/config/test-db", response_model=TestDbResponse)
def test_database_connection(
    payload: TestDbRequest,
    user: CurrentUser = Depends(require_admin),
) -> TestDbResponse:
    """Test a database connection without saving."""
    try:
        if payload.database_type == "postgresql":
            if payload.postgres_url:
                conn_url = payload.postgres_url
            elif payload.host and payload.username and payload.database:
                password = payload.password or ""
                conn_url = (
                    f"postgresql+psycopg2://{payload.username}:{password}"
                    f"@{payload.host}:{payload.port}/{payload.database}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Provide either postgres_url or host/username/database",
                )

            engine = create_engine(conn_url)
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
            engine.dispose()

            return TestDbResponse(
                success=True,
                message=f"Conexión exitosa a PostgreSQL ({payload.host or payload.postgres_url})",
                database_type="postgresql",
            )
        else:
            return TestDbResponse(
                success=True,
                message="SQLite está en uso actualmente",
                database_type="sqlite",
            )

    except Exception as e:
        error_msg = str(e)
        # Clean up error message for user
        if "connection" in error_msg.lower() or "refused" in error_msg.lower():
            error_msg = "No se pudo conectar. Verifica host, puerto y credenciales."
        elif "password" in error_msg.lower() or "auth" in error_msg.lower():
            error_msg = "Error de autenticación. Verifica usuario y contraseña."

        return TestDbResponse(
            success=False,
            message=error_msg,
            database_type=payload.database_type,
        )


# ─── Direct DB Sync (SQLite → PostgreSQL) ────────────────────────


class SyncResponse(BaseModel):
    success: bool
    message: str
    counts: dict


@router.post("/sync", status_code=status.HTTP_200_OK)
def sync_databases(
    target_env: str = "prod",
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> SyncResponse:
    """Sync all data from current DB (SQLite) to configured PostgreSQL database in target_env."""
    import json
    from datetime import datetime, timezone
    from uuid import uuid4

    from ..db_models import (
        Dataset as DBDataset,
        DatasetField,
        Endpoint as DBEndpoint,
        Project as DBProject,
        ShareSnapshot,
        User,
    )
    from ..services.jwt_service import hash_password

    # Read PostgreSQL URL from admin config
    if not CONFIG_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay configuración de PostgreSQL. Configúrala primero en 'Base de datos'.",
        )
    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    if target_env not in ["dev", "prod"]:
        raise HTTPException(status_code=400, detail="Entorno de destino inválido. Usa 'dev' o 'prod'.")

    postgres_url = config.get(target_env, {}).get("postgres_url")
    if not postgres_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PostgreSQL de {target_env} no configurada. Configúrala primero.",
        )

    counts = {
        "users_synced": 0,
        "projects_synced": 0,
        "datasets_synced": 0,
        "fields_synced": 0,
        "endpoints_synced": 0,
        "shares_synced": 0,
        "skipped": 0,
        "errors": [],
    }

    # Connect to PostgreSQL
    try:
        pg_engine = create_engine(postgres_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo conectar a PostgreSQL: {e}",
        )

    try:
        # Read all data from SQLite (current session)
        sqlite_users = session.exec(select(User)).all()
        sqlite_projects = session.exec(select(DBProject)).all()

        with Session(pg_engine) as pg_session:
            # Sync users (skip if username exists)
            for u in sqlite_users:
                existing = pg_session.exec(select(User).where(User.username == u.username)).first()
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_user = User(
                    id=u.id,
                    username=u.username,
                    email=u.email,
                    password_hash=u.password_hash,
                    role=u.role,
                    is_active=u.is_active,
                    created_at=u.created_at,
                    updated_at=u.updated_at,
                )
                pg_session.add(pg_user)
                counts["users_synced"] += 1

            # Sync projects
            for p in sqlite_projects:
                # Check if project with same name already exists
                existing = pg_session.exec(select(DBProject).where(DBProject.name == p.name)).first()
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_project = DBProject(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                    target_stack=p.target_stack,
                    status=p.status,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
                pg_session.add(pg_project)
                counts["projects_synced"] += 1

            # Sync datasets
            for ds in session.exec(select(DBDataset)).all():
                existing = pg_session.get(DBDataset, ds.id)
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_ds = DBDataset(
                    id=ds.id,
                    project_id=ds.project_id,
                    name=ds.name,
                    source_type=ds.source_type,
                )
                pg_session.add(pg_ds)
                counts["datasets_synced"] += 1

            # Sync dataset fields
            for f in session.exec(select(DatasetField)).all():
                existing = pg_session.get(DatasetField, f.id)
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_f = DatasetField(
                    id=f.id,
                    dataset_id=f.dataset_id,
                    name=f.name,
                    field_type=f.field_type,
                    required=f.required,
                    description=f.description,
                )
                pg_session.add(pg_f)
                counts["fields_synced"] += 1

            # Sync endpoints
            for ep in session.exec(select(DBEndpoint)).all():
                existing = pg_session.get(DBEndpoint, ep.id)
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_ep = DBEndpoint(
                    id=ep.id,
                    project_id=ep.project_id,
                    name=ep.name,
                    method=ep.method,
                    path=ep.path,
                    summary=ep.summary,
                    operation_type=ep.operation_type,
                )
                pg_session.add(pg_ep)
                counts["endpoints_synced"] += 1

            # Sync share snapshots
            for ss in session.exec(select(ShareSnapshot)).all():
                existing = pg_session.get(ShareSnapshot, ss.id)
                if existing:
                    counts["skipped"] += 1
                    continue
                pg_ss = ShareSnapshot(
                    id=ss.id,
                    project_id=ss.project_id,
                    slug=ss.slug,
                    snapshot_data=ss.snapshot_data,
                    password_hash=ss.password_hash,
                    expires_at=ss.expires_at,
                    views_count=ss.views_count,
                )
                pg_session.add(pg_ss)
                counts["shares_synced"] += 1

            # Create tables and commit
            from sqlmodel import SQLModel
            SQLModel.metadata.create_all(pg_engine)
            pg_session.commit()

    except Exception as e:
        counts["errors"].append(str(e))
        return SyncResponse(
            success=False,
            message=f"Error durante la sincronización: {e}",
            counts=counts,
        )
    finally:
        pg_engine.dispose()

    total = sum([
        counts["users_synced"],
        counts["projects_synced"],
        counts["datasets_synced"],
        counts["fields_synced"],
        counts["endpoints_synced"],
        counts["shares_synced"],
    ])

import subprocess
from pathlib import Path


class RunTestsResponse(BaseModel):
    success: bool
    output: str
    passed: int
    failed: int
    total: int


@router.post("/run-tests", response_model=RunTestsResponse)
def run_tests(
    user: CurrentUser = Depends(require_admin),
) -> RunTestsResponse:
    """Run the backend test suite and return results."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", "tests/", "-v", "--tb=short"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(backend_dir),
        )
        output = result.stdout + result.stderr

        # Parse test counts from pytest output
        passed = 0
        failed = 0
        for line in output.splitlines():
            if "passed" in line and "failed" in line and "=" not in line:
                parts = line.split()
                for i, p in enumerate(parts):
                    if p == "passed":
                        passed += int(parts[i - 1]) if i > 0 else 0
                    elif p == "failed":
                        failed += int(parts[i - 1]) if i > 0 else 0

        # Fallback: get counts from summary line
        if passed == 0 and failed == 0:
            for line in output.splitlines():
                if "passed" in line and "failed" in line:
                    import re
                    nums = re.findall(r"(\d+)\s+(passed|failed)", line)
                    for num, status in nums:
                        if status == "passed":
                            passed = int(num)
                        elif status == "failed":
                            failed = int(num)

        total = passed + failed
        return RunTestsResponse(
            success=result.returncode == 0,
            output=output[-5000:] if len(output) > 5000 else output,
            passed=passed,
            failed=failed,
            total=total,
        )
    except subprocess.TimeoutExpired:
        return RunTestsResponse(
            success=False,
            output="Timeout: los tests superaron los 120 segundos.",
            passed=0,
            failed=0,
            total=0,
        )
    except FileNotFoundError:
        return RunTestsResponse(
            success=False,
            output="Error: pytest no encontrado. Asegúrate de que está instalado en el entorno virtual.",
            passed=0,
            failed=0,
            total=0,
        )
    except Exception as e:
        return RunTestsResponse(
            success=False,
            output=f"Error al ejecutar tests: {str(e)}",
            passed=0,
            failed=0,
            total=0,
        )
