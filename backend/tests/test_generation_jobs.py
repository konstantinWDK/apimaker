"""Tests for asynchronous generation jobs."""

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
    username = f"genjobs_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_generation_job_runs_and_exposes_result() -> None:
    headers = _auth_headers()
    created = client.post(
        "/projects",
        headers=headers,
        json={"name": f"Generation Job Project {SUFFIX}", "target_stack": "fastapi"},
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    job = client.post(
        f"/projects/{project_id}/generation-jobs",
        headers=headers,
        json={"include_mock_server": True, "include_sdk": False, "include_data": True},
    )
    assert job.status_code == 202
    job_id = job.json()["id"]
    assert job.json()["status"] == "pending"

    detail = client.get(f"/projects/{project_id}/generation-jobs/{job_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "success"
    assert body["result"]["project_id"] == project_id
    assert body["result"]["bundle_path"].endswith("fastapi-bundle.zip")
