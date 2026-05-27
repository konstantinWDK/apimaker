"""Tests for project listing options."""

from __future__ import annotations

import time

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.db_models import User
from app.main import app
from app.services.jwt_service import hash_password


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _auth_headers() -> dict[str, str]:
    username = f"listing_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_project_listing_supports_summary_include_pagination_and_v1() -> None:
    headers = _auth_headers()
    for index in range(2):
        created = client.post(
            "/projects",
            headers=headers,
            json={"name": f"Listing Project {SUFFIX} {index}", "target_stack": "fastapi"},
        )
        assert created.status_code == 201

    listed = client.get(
        "/api/v1/projects?include=summary&limit=1&offset=0",
        headers=headers,
    )
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert body[0]["datasets"] == []
    assert body[0]["endpoints"] == []
