"""Tests for Budibase-inspired product capability endpoints."""

from __future__ import annotations

import time
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.main import app
from app.db_models import User
from app.services.jwt_service import hash_password


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _auth_headers() -> dict[str, str]:
    username = f"ops_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_project(headers: dict[str, str]) -> str:
    unique = f"{SUFFIX}-{uuid4().hex[:8]}"
    res = client.post(
        "/projects",
        headers=headers,
        json={"name": f"Ops Project {unique}", "target_stack": "fastapi"},
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_datasources_queries_releases_automations_and_imports() -> None:
    headers = _auth_headers()
    project_id = _create_project(headers)

    ds = client.post(
        f"/projects/{project_id}/datasources",
        headers=headers,
        json={"name": "Manual Source", "source_type": "manual", "config": {"mode": "mock"}},
    )
    assert ds.status_code == 201
    datasource_id = ds.json()["id"]

    listed = client.get(f"/projects/{project_id}/datasources", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == datasource_id

    query = client.post(
        f"/projects/{project_id}/queries",
        headers=headers,
        json={
            "name": "List things",
            "query_type": "sql",
            "statement": "SELECT 1",
            "datasource_id": datasource_id,
            "expose_as_endpoint": True,
            "endpoint_path": "/reports/list-things",
        },
    )
    assert query.status_code == 201
    assert query.json()["endpoint"]["enabled"] is True
    assert query.json()["endpoint"]["path"] == "/reports/list-things"

    automation = client.post(
        f"/projects/{project_id}/automations",
        headers=headers,
        json={
            "name": "Log manual test",
            "trigger_event": "manual",
            "actions": [{"type": "runtime_log", "event_type": "automation.test", "message": "ok"}],
        },
    )
    assert automation.status_code == 201

    test_run = client.post(
        f"/projects/{project_id}/automations/{automation.json()['id']}/test",
        headers=headers,
        json={"hello": "world"},
    )
    assert test_run.status_code == 200

    release = client.post(
        f"/projects/{project_id}/releases",
        headers=headers,
        json={"message": "first release"},
    )
    assert release.status_code == 201
    assert release.json()["version"] == 1

    imported = client.post(
        f"/projects/{project_id}/imports",
        headers=headers,
        json={
            "format": "openapi",
            "document": {"paths": {"/hello": {"get": {"summary": "Hello"}}}},
        },
    )
    assert imported.status_code == 201
    assert imported.json()["imported_endpoints"] == 1

    logs = client.get(f"/projects/{project_id}/runtime-logs", headers=headers)
    assert logs.status_code == 200
    assert any(row["event_type"] in {"datasource.created", "automation.test", "release.created", "import.completed"} for row in logs.json())


def test_saved_sql_query_rejects_unsafe_statement() -> None:
    headers = _auth_headers()
    project_id = _create_project(headers)

    query = client.post(
        f"/projects/{project_id}/queries",
        headers=headers,
        json={
            "name": "Dangerous query",
            "query_type": "sql",
            "statement": "SELECT * FROM users; DROP TABLE users",
            "expose_as_endpoint": True,
            "endpoint_path": "/reports/danger",
        },
    )

    assert query.status_code == 400
    assert "not allowed" in query.json()["detail"]


def test_platform_registry_endpoints() -> None:
    headers = _auth_headers()
    providers = client.get("/api/platform/deploy-providers", headers=headers)
    assert providers.status_code == 200
    assert any(item["id"] == "docker-local" for item in providers.json())

    plugins = client.get("/api/platform/plugins", headers=headers)
    assert plugins.status_code == 200
    assert "connectors" in plugins.json()
