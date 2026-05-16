"""Tests for project security persistence across builder, mock and deploy import."""

from __future__ import annotations

import time

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.db_models import Project, User
from app.main import app
from app.services.jwt_service import hash_password
from app.standalone_server import _ensure_project_in_db


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _auth_headers() -> dict[str, str]:
    username = f"security_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_project_security_settings_are_saved_and_mock_enforces_apikey() -> None:
    headers = _auth_headers()
    created = client.post(
        "/projects",
        headers=headers,
        json={
            "name": f"Security Project {SUFFIX}",
            "target_stack": "fastapi",
            "auth_method": "apikey",
            "api_key": "secret-key",
        },
    )
    assert created.status_code == 201
    project_id = created.json()["id"]
    assert created.json()["auth_method"] == "apikey"
    # Secrets are not returned in API responses for security
    with Session(engine) as session:
        db_project = session.get(Project, project_id)
        assert db_project is not None
        assert db_project.api_key == "secret-key"

    dataset = client.post(
        f"/projects/{project_id}/dataset",
        headers=headers,
        json={
            "name": "items",
            "source_type": "manual",
            "fields": [{"name": "name", "type": "string", "required": True}],
            "sample_rows": [{"name": "one"}],
        },
    )
    assert dataset.status_code == 200
    dataset_id = dataset.json()["datasets"][0]["id"]

    endpoints = client.post(
        f"/projects/{project_id}/endpoints",
        headers=headers,
        json={
            "endpoints": [
                {
                    "name": "List items",
                    "method": "GET",
                    "path": "/items",
                    "operation_type": "list",
                    "target_dataset_id": dataset_id,
                }
            ]
        },
    )
    assert endpoints.status_code == 200

    denied = client.get(f"/api/mock/{project_id}/items")
    assert denied.status_code == 401

    allowed = client.get(f"/api/mock/{project_id}/items", headers={"X-API-Key": "secret-key"})
    assert allowed.status_code == 200

    patched = client.patch(
        f"/projects/{project_id}",
        headers=headers,
        json={"auth_method": "jwt", "jwt_secret": "jwt-secret", "rate_limit": 25},
    )
    assert patched.status_code == 200
    assert patched.json()["auth_method"] == "jwt"
    # Secrets are not returned in API responses for security
    assert patched.json()["rate_limit"] == 25

    with Session(engine) as session:
        project = session.get(Project, project_id)
        assert project is not None
        assert project.auth_method == "jwt"
        assert project.jwt_secret == "jwt-secret"
        assert project.rate_limit == 25


def test_standalone_import_preserves_security_settings(tmp_path) -> None:
    db_path = tmp_path / "standalone.db"
    first_project_id = _ensure_project_in_db(
        {
            "name": "Standalone Secure",
            "slug": "standalone-secure",
            "auth_method": "apikey",
            "api_key": "deploy-secret",
            "jwt_secret": "jwt-secret",
            "rate_limit": 15,
            "include_data": False,
            "target_stack": "fastapi",
            "datasets": [],
            "endpoints": [],
        },
        f"sqlite:///{db_path}",
    )
    second_project_id = _ensure_project_in_db(
        {
            "name": "Standalone Secure Updated",
            "slug": "standalone-secure",
            "auth_method": "jwt",
            "api_key": None,
            "jwt_secret": "updated-jwt-secret",
            "rate_limit": 30,
            "include_data": True,
            "target_stack": "express",
            "datasets": [],
            "endpoints": [],
        },
        f"sqlite:///{db_path}",
    )
    assert second_project_id == first_project_id

    from sqlmodel import create_engine

    standalone_engine = create_engine(f"sqlite:///{db_path}")
    with Session(standalone_engine) as session:
        project = session.get(Project, first_project_id)
        assert project is not None
        assert project.name == "Standalone Secure Updated"
        assert project.auth_method == "jwt"
        assert project.jwt_secret == "updated-jwt-secret"
        assert project.rate_limit == 30
        assert project.include_data is True
        assert project.target_stack == "express"
