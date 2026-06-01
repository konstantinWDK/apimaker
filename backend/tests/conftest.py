"""Shared pytest setup for the backend test suite."""

from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault(
    "APIMAKER_DATABASE_URL",
    f"sqlite:///{Path(__file__).resolve().parent.parent / 'app' / 'data' / 'test_doapi.db'}",
)

from app.db import create_db_and_tables  # noqa: E402
from app.routers.auth import limiter  # noqa: E402


def pytest_sessionstart(session) -> None:
    create_db_and_tables()
    limiter.enabled = False
