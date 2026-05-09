"""Database engine, session factory, and initialization."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine

from .config import get_settings

settings = get_settings()

# Resolve database URL from environment or use SQLite by default
DATABASE_URL = os.getenv(
    "APIMAKER_DATABASE_URL",
    f"sqlite:///{Path(__file__).resolve().parent / 'data' / 'apimaker.db'}",
)

# For PostgreSQL in production:
# DATABASE_URL = os.getenv("APIMAKER_DATABASE_URL", "postgresql+psycopg2://user:pass@host:5432/apimaker")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, echo=settings.environment == "development", connect_args=connect_args)


def create_db_and_tables() -> None:
    """Create all SQLModel tables. In production, use Alembic migrations."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a Session and close it afterwards."""
    with Session(engine) as session:
        yield session
