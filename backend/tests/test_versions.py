"""Tests for project version snapshots."""

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
    username = f"versions_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_project_version_create_list_get_and_restore() -> None:
    headers = _auth_headers()
    created = client.post(
        "/projects",
        headers=headers,
        json={"name": f"Versioned Project {SUFFIX}", "target_stack": "fastapi"},
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    version = client.post(
        f"/projects/{project_id}/versions",
        headers=headers,
        json={"message": "first snapshot"},
    )
    assert version.status_code == 201
    version_id = version.json()["id"]
    assert version.json()["version"] == 1

    patched = client.patch(
        f"/projects/{project_id}",
        headers=headers,
        json={"name": f"Changed Project {SUFFIX}"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"].startswith("Changed Project")

    listed = client.get(f"/projects/{project_id}/versions", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == version_id

    detail = client.get(f"/projects/{project_id}/versions/{version_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["snapshot_data"]["project"]["name"].startswith("Versioned Project")

    restored = client.post(
        f"/projects/{project_id}/versions/{version_id}/restore",
        headers=headers,
    )
    assert restored.status_code == 200

    project = client.get(f"/projects/{project_id}", headers=headers)
    assert project.status_code == 200
    assert project.json()["name"].startswith("Versioned Project")
