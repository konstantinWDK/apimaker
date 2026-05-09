"""Mock server runtime — simulates project API endpoints using in-memory data."""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Dataset, DatasetField, Endpoint, Project


# In-memory mock data store per project
_mock_data: dict[str, list[dict]] = {}


def _generate_sample_row(fields: list[DatasetField]) -> dict[str, Any]:
    """Generate a realistic sample row based on field types."""
    row: dict[str, Any] = {}
    for f in fields:
        if f.field_type == "string":
            if "email" in f.name.lower():
                row[f.name] = f"sample_{random.randint(1000, 9999)}@example.com"
            elif "name" in f.name.lower():
                row[f.name] = f"Sample {f.name.capitalize()} {random.randint(1, 100)}"
            else:
                row[f.name] = f"value-{random.randint(1, 1000)}"
        elif f.field_type == "integer":
            row[f.name] = random.randint(1, 1000)
        elif f.field_type == "float":
            row[f.name] = round(random.uniform(1.0, 999.99), 2)
        elif f.field_type == "boolean":
            row[f.name] = random.choice([True, False])
        elif f.field_type == "datetime":
            days_ago = random.randint(0, 365)
            row[f.name] = (datetime.utcnow() - timedelta(days=days_ago)).isoformat()
        else:
            row[f.name] = None
    return row


def init_mock_data(project_id: str, fields: list[DatasetField], count: int = 10) -> list[dict]:
    """Initialize mock data with sample rows."""
    store: list[dict] = []
    for _ in range(count):
        row = _generate_sample_row(fields)
        row["_id"] = str(uuid4())
        store.append(row)
    _mock_data[project_id] = store
    return store


router = APIRouter(prefix="/api/mock/{project_id}", tags=["mock"])


@router.get("/{path:path}")
async def mock_get(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
) -> list[dict]:
    """Mock GET — list or get by ID."""
    store = _mock_data.get(project_id, [])
    if not store:
        raise HTTPException(status_code=404, detail="Mock data not initialized. Start mock server first.")

    # Check if this is a list or detail request
    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == project_id)
    ).all()

    # Match the path to an endpoint
    full_path = f"/{path}"
    matched_ep = None
    param_value = None
    param_name = None

    for ep in endpoints:
        if ep.method != "GET":
            continue
        if ep.path == full_path:
            matched_ep = ep
            break
        # Try path pattern like /products/{id}
        if "{" in ep.path and "}" in ep.path:
            pattern = ep.path
            pname = pattern.split("{")[1].split("}")[0]
            prefix = pattern.split("{")[0]
            if full_path.startswith(prefix):
                param_value = full_path[len(prefix):].split("/")[0]
                param_name = pname
                matched_ep = ep
                break

    if not matched_ep:
        raise HTTPException(status_code=404, detail="No matching endpoint definition")

    if param_value:
        # Get by ID
        for item in store:
            if item.get("_id") == param_value or str(item.get("id")) == str(param_value):
                return [item] if isinstance(item, dict) else item
        raise HTTPException(status_code=404, detail="Not found")

    # List
    return store[skip:skip + limit]


@router.post("/{path:path}")
async def mock_post(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    """Mock POST — create a new record."""
    store = _mock_data.get(project_id, [])
    if not store:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    try:
        body = await request.json()
    except Exception:
        body = {}

    new_item = {"_id": str(uuid4()), **body}
    store.append(new_item)
    return new_item


@router.put("/{path:path}")
async def mock_put(
    project_id: str,
    path: str,
    request: Request,
) -> dict:
    """Mock PUT — update a record."""
    store = _mock_data.get(project_id, [])
    if not store:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    try:
        body = await request.json()
    except Exception:
        body = {}

    # Extract ID from path (e.g., /products/abc123)
    parts = path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="ID required in path")
    item_id = parts[-1]

    for i, item in enumerate(store):
        if item.get("_id") == item_id or str(item.get("id")) == str(item_id):
            store[i] = {"_id": item_id, **body}
            return store[i]

    raise HTTPException(status_code=404, detail="Not found")


@router.delete("/{path:path}", status_code=204)
async def mock_delete(
    project_id: str,
    path: str,
) -> None:
    """Mock DELETE — remove a record."""
    store = _mock_data.get(project_id, [])
    if not store:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    # Extract ID from path
    parts = path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="ID required in path")
    item_id = parts[-1]

    for i, item in enumerate(store):
        if item.get("_id") == item_id or str(item.get("id")) == str(item_id):
            store.pop(i)
            return

    raise HTTPException(status_code=404, detail="Not found")


# Public functions for the mock router


def start_mock_server_fn(session: Session, project_id: str) -> dict:
    """Start mock server for a project (initialize data)."""
    project = session.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dataset = session.exec(
        select(Dataset).where(Dataset.project_id == str(project_id))
    ).first()

    fields = []
    if dataset:
        fields = session.exec(
            select(DatasetField).where(DatasetField.dataset_id == dataset.id)
        ).all()

    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == str(project_id))
    ).all()

    store = init_mock_data(str(project_id), fields)

    return {
        "project_id": str(project_id),
        "status": "running",
        "base_url": f"/api/mock/{project_id}",
        "endpoints": [{"method": ep.method, "path": f"/api/mock/{project_id}{ep.path}"} for ep in endpoints],
        "sample_rows": len(store),
    }


def stop_mock_server_fn(project_id: str) -> dict:
    """Stop mock server and clear data."""
    _mock_data.pop(str(project_id), None)
    return {"project_id": str(project_id), "status": "stopped"}


def get_mock_status_fn(project_id: str) -> dict:
    """Get mock server status."""
    store = _mock_data.get(str(project_id))
    if store is not None:
        return {
            "project_id": str(project_id),
            "status": "running",
            "base_url": f"/api/mock/{project_id}",
            "sample_rows": len(store),
        }
    return {"project_id": str(project_id), "status": "stopped"}
