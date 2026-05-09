"""Admin-only routes for system configuration."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, create_engine, text

from ..config import get_settings
from ..db import get_session, get_database_info
from ..security import CurrentUser, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

# Config file path (next to the backend app)
CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "admin_config.json"


class DatabaseConfig(BaseModel):
    database_type: str = "sqlite"  # "sqlite" or "postgresql"
    postgres_url: str | None = None  # Full PostgreSQL connection URL
    host: str | None = None
    port: int | None = 5432
    username: str | None = None
    password: str | None = None
    database: str | None = None


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
    database_type: str
    current_database_url: str
    current_database_info: dict
    postgres_configured: bool
    artifacts_dir: str
    environment: str


def _read_admin_config() -> dict:
    """Read admin configuration from file."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    return {}


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
    """Get current admin configuration."""
    settings = get_settings()
    admin_config = _read_admin_config()

    db_type = admin_config.get("database_type", "sqlite")
    postgres_url = admin_config.get("postgres_url", "")

    return AdminConfigResponse(
        database_type=db_type,
        current_database_url=settings.__dict__.get("database_url", "sqlite (default)"),
        current_database_info=get_database_info(),
        postgres_configured=bool(postgres_url),
        artifacts_dir=settings.artifacts_dir,
        environment=settings.environment,
    )


@router.post("/config", status_code=status.HTTP_200_OK)
def update_admin_config(
    payload: DatabaseConfig,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Update admin configuration (database settings)."""
    admin_config = _read_admin_config()

    if payload.database_type == "postgresql":
        if payload.postgres_url:
            admin_config["postgres_url"] = payload.postgres_url
        elif payload.host and payload.username and payload.database:
            # Build connection URL
            password = payload.password or ""
            admin_config["postgres_url"] = (
                f"postgresql+psycopg2://{payload.username}:{password}"
                f"@{payload.host}:{payload.port or 5432}/{payload.database}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either postgres_url or host/username/database",
            )
        admin_config["database_type"] = "postgresql"
    else:
        # Switch back to SQLite
        admin_config["database_type"] = "sqlite"
        admin_config["postgres_url"] = None

    _write_admin_config(admin_config)

    return {
        "message": "Configuración guardada. Reinicia el backend para aplicar los cambios.",
        "database_type": admin_config["database_type"],
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
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> SyncResponse:
    """Sync all data from current DB (SQLite) to configured PostgreSQL database."""
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

    postgres_url = config.get("postgres_url")
    if not postgres_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PostgreSQL no configurada. Configura la conexión primero.",
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

    return SyncResponse(
        success=True,
        message=f"Sincronización completada: {total} registros transferidos a PostgreSQL ({counts['skipped']} ya existían)",
        counts=counts,
    )
