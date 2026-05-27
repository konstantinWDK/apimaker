"""Tests for database datasource exploration and import."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.db_models import Dataset, DatasetField, Endpoint, User
from app.main import app
from app.services.jwt_service import hash_password


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _auth_headers() -> dict[str, str]:
    username = f"explorer_{SUFFIX}"
    password = "testpass123"
    with Session(engine) as session:
        if not session.exec(select(User).where(User.username == username)).first():
            session.add(User(username=username, password_hash=hash_password(password), role="admin"))
            session.commit()
    login = client.post("/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_project(headers: dict[str, str]) -> str:
    response = client.post(
        "/projects",
        headers=headers,
        json={"name": f"Explorer Project {SUFFIX}", "target_stack": "fastapi"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_external_sqlite(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            create table customers (
                id integer primary key,
                email text not null unique,
                active boolean not null default 1,
                created_at datetime
            );
            create table orders (
                id integer primary key,
                customer_id integer not null references customers(id),
                total numeric not null
            );
            insert into customers (email, active, created_at)
            values ('one@example.com', 1, '2026-05-27T10:00:00');
            insert into orders (customer_id, total) values (1, 19.95);
            """
        )
        connection.commit()
    finally:
        connection.close()


def test_sqlite_datasource_explorer_imports_table_as_dataset(tmp_path: Path) -> None:
    source_db = tmp_path / "source.db"
    _create_external_sqlite(source_db)
    headers = _auth_headers()
    project_id = _create_project(headers)

    created = client.post(
        f"/api/connections/project/{project_id}",
        headers=headers,
        json={"name": "SQLite source", "db_type": "sqlite", "database": source_db.as_posix()},
    )
    assert created.status_code == 201
    connection_id = created.json()["id"]

    tested = client.post(f"/api/connections/{connection_id}/test", headers=headers)
    assert tested.status_code == 200
    assert tested.json()["success"] is True

    tables = client.get(f"/api/connections/{connection_id}/tables?include_counts=true", headers=headers)
    assert tables.status_code == 200
    customers = next(table for table in tables.json() if table["name"] == "customers")
    assert customers["column_count"] == 4
    assert customers["row_count"] == 1

    schema = client.get(f"/api/connections/{connection_id}/tables/orders/schema", headers=headers)
    assert schema.status_code == 200
    customer_id = next(column for column in schema.json()["columns"] if column["name"] == "customer_id")
    assert customer_id["foreign_key"] == "customers.id"

    preview = client.get(f"/api/connections/{connection_id}/tables/customers/preview?limit=1", headers=headers)
    assert preview.status_code == 200
    assert preview.json()["rows"][0]["email"] == "one@example.com"

    imported = client.post(
        f"/api/connections/{connection_id}/import-table",
        headers=headers,
        json={"table_name": "orders", "dataset_name": "Orders", "sample_limit": 5},
    )
    assert imported.status_code == 201
    body = imported.json()
    assert body["fields_imported"] == 3
    assert len(body["endpoints_created"]) == 5

    with Session(engine) as session:
        dataset = session.get(Dataset, body["dataset_id"])
        assert dataset is not None
        assert dataset.source_type == "database"
        fields = session.exec(select(DatasetField).where(DatasetField.dataset_id == dataset.id)).all()
        assert {field.name for field in fields} == {"id", "customer_id", "total"}
        endpoints = session.exec(select(Endpoint).where(Endpoint.target_dataset_id == dataset.id)).all()
        assert {endpoint.operation_type for endpoint in endpoints} == {"list", "get", "create", "update", "delete"}
