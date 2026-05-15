"""Setup router for initial application configuration."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, text, create_engine

from ..db import get_session, create_db_and_tables
from ..db_models import User, Workspace, WorkspaceMember
from ..services.jwt_service import hash_password
from ..config import get_settings

router = APIRouter(prefix="/setup", tags=["setup"])

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "admin_config.json"

class SetupRequest(BaseModel):
    # Admin info
    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_email: Optional[str] = None
    
    # Database info
    database_type: str = "sqlite"  # "sqlite" or "postgresql"
    host: Optional[str] = None
    port: Optional[int] = 5432
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    
    # Options
    import_sample_data: bool = True

class SetupStatus(BaseModel):
    is_configured: bool
    database_type: str
    has_admin: bool

@router.get("/status", response_model=SetupStatus)
def get_setup_status(session: Session = Depends(get_session)) -> SetupStatus:
    """Check if the system is already configured."""
    has_admin = session.exec(select(User).where(User.role == "admin")).first() is not None
    settings = get_settings()
    
    db_type = "sqlite"
    if "postgresql" in settings.database_url:
        db_type = "postgresql"
        
    return SetupStatus(
        is_configured=has_admin,
        database_type=db_type,
        has_admin=has_admin
    )

@router.post("/run")
def run_setup(payload: SetupRequest, session: Session = Depends(get_session)) -> dict:
    """Run initial setup. Only allowed if no admin exists."""
    # Safety check: is there already an admin?
    existing_admin = session.exec(select(User).where(User.role == "admin")).first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System is already configured. Setup cannot be run again."
        )

    # 1. Update Database Configuration if Postgres
    if payload.database_type == "postgresql":
        if not (payload.host and payload.username and payload.database):
            raise HTTPException(
                status_code=400,
                detail="PostgreSQL requires host, username, and database name."
            )
        
        pg_pass = payload.password or ""
        db_url = (
            f"postgresql+psycopg2://{payload.username}:{pg_pass}"
            f"@{payload.host}:{payload.port or 5432}/{payload.database}"
        )
        
        # Test connection
        try:
            test_engine = create_engine(db_url)
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            test_engine.dispose()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot connect to PostgreSQL: {str(e)}"
            )

        # Save config to .env or admin_config.json
        # For simplicity in this demo, we'll write it to the config file
        config_data = {
            "dev": {
                "database_type": "postgresql",
                "postgres_url": db_url,
                "host": payload.host,
                "port": payload.port,
                "username": payload.username,
                "password": payload.password,
                "database": payload.database
            },
            "prod": {
                "database_type": "postgresql",
                "postgres_url": db_url
            }
        }
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump(config_data, f, indent=2)
            
        # IMPORTANT: Since we changed DB, we need to re-initialize tables in the new DB
        # This is tricky because the current 'session' is linked to the OLD engine.
        # We'll suggest the user restart or we can try to initialize here.
        new_engine = create_engine(db_url)
        from sqlmodel import SQLModel
        SQLModel.metadata.create_all(new_engine)
        
        # Create a new session for the rest of the setup
        with Session(new_engine) as new_session:
            _finalize_setup(new_session, payload)
    else:
        # SQLite: use current session
        _finalize_setup(session, payload)

    return {"message": "Setup completed successfully. Please restart the backend to apply all changes."}

def _finalize_setup(session: Session, payload: SetupRequest):
    """Create admin user and optionally import sample data."""
    # Create Admin
    admin = User(
        username=payload.admin_username,
        password_hash=hash_password(payload.admin_password),
        role="admin"
    )
    session.add(admin)
    session.flush()

    workspace = Workspace(
        name="Default Workspace",
        slug="default",
        owner_id=admin.id
    )
    session.add(workspace)
    session.flush()
    session.add(WorkspaceMember(workspace_id=workspace.id, user_id=admin.id, role="owner"))
    
    session.commit()

    # Import Sample Data if requested
    if payload.import_sample_data:
        try:
            from ..scripts.seed_admin import seed_admin_user # Not this, we need sample data
            # Use migrate_json_to_db logic
            import subprocess
            import os
            import sys
            
            # This is a bit hacky but works for a setup wizard
            backend_dir = Path(__file__).resolve().parent.parent.parent
            env = os.environ.copy()
            # If we just saved to config file, the scripts should find it
            subprocess.run([sys.executable, "migrate_json_to_db.py"], cwd=str(backend_dir), env=env)
            subprocess.run([sys.executable, "repair_pokedex.py"], cwd=str(backend_dir), env=env)
        except Exception as e:
            print(f"Warning: Sample data import failed: {e}")
