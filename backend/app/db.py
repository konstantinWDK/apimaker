"""Database engine, session factory, and initialization."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine
from alembic.config import Config
from alembic import command
import logging

from .config import get_settings
from . import db_models  # noqa: F401 - register SQLModel metadata before create_all

settings = get_settings()

# Resolve database URL from environment or config file
ADMIN_CONFIG_PATH = Path(__file__).resolve().parent / "data" / "admin_config.json"


def _get_database_url() -> str:
    """Get database URL from settings or legacy config."""
    # Settings (from env or .env) takes priority
    if settings.database_url:
        return settings.database_url

    default_sqlite = f"sqlite:///{Path(__file__).resolve().parent / 'data' / 'apimaker.db'}"

    # Check admin config file (Legacy)
    if ADMIN_CONFIG_PATH.exists():
        try:
            with open(ADMIN_CONFIG_PATH, "r") as f:
                config = json.load(f)
            
            # Determine which environment config to use
            env = settings.environment or "development"
            key = "prod" if env == "production" else "dev"
            
            # Handle legacy format if not yet migrated
            if key not in config and "database_type" in config:
                if config.get("database_type") == "postgresql" and config.get("postgres_url"):
                    return config["postgres_url"]
                return default_sqlite

            env_config = config.get(key, {})
            if env_config.get("database_type") == "postgresql" and env_config.get("postgres_url"):
                return env_config["postgres_url"]
        except (json.JSONDecodeError, IOError):
            pass

    # Default to SQLite
    return default_sqlite



DATABASE_URL = _get_database_url()

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, echo=settings.environment == "development", connect_args=connect_args)


def create_db_and_tables() -> None:
    """Create all SQLModel tables. In production, use Alembic migrations."""
    # Create all tables and columns defined in the current models
    SQLModel.metadata.create_all(engine)
    
    # Stamp Alembic so it knows the schema is up-to-date
    alembic_ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    if alembic_ini_path.exists():
        try:
            alembic_cfg = Config(str(alembic_ini_path))
            alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
            from alembic import command as alembic_cmd
            alembic_cmd.stamp(alembic_cfg, "head")
            logging.info("Alembic schema stamped to head.")
        except Exception as e:
            logging.warning(f"Alembic stamp failed: {e}")


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a Session and close it afterwards."""
    with Session(engine) as session:
        yield session


def get_database_info() -> dict:
    """Get current database connection info."""
    if DATABASE_URL.startswith("sqlite"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        return {
            "type": "sqlite",
            "url": f"sqlite:///{db_path}",
            "path": db_path,
        }
    elif DATABASE_URL.startswith("postgresql"):
        # Parse PostgreSQL URL for display
        try:
            # Format: postgresql+psycopg2://user:pass@host:port/dbname
            after_protocol = DATABASE_URL.split("://")[1]
            user_pass = after_protocol.split("@")[0]
            host_db = after_protocol.split("@")[1]
            username = user_pass.split(":")[0] if ":" in user_pass else "unknown"
            host_port_db = host_db.split("/")
            host_port = host_port_db[0]
            dbname = host_port_db[1] if len(host_port_db) > 1 else "unknown"
            return {
                "type": "postgresql",
                "url": "postgresql+psycopg2://***:***@" + host_port + "/" + dbname,
                "host": host_port,
                "database": dbname,
                "username": username,
            }
        except Exception:
            return {"type": "postgresql", "url": "***"}
    return {"type": "unknown", "url": "***"}
