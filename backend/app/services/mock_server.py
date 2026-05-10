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


def init_mock_data(project_id: str, fields: list[DatasetField], count: int = 0) -> list[dict]:
    """Initialize mock data store for a project (starts empty if no count provided)."""
    # We no longer generate random data unless explicitly requested with a count > 0
    # and even then, we prefer starting clean.
    store: list[dict] = []
    _mock_data[project_id] = store
    return store


from .project_service import project_service

def _resolve_project_id(session: Session, project_id: str) -> str:
    """Resolve a project ID from either a UUID string or a slug."""
    return project_service.resolve_id(session, project_id)


async def verify_mock_auth(
    project_id: str,
    request: Request,
    session: Session = Depends(get_session)
):
    """Verify auth headers if the project has authentication enabled."""
    resolved_id = project_service.resolve_id(session, project_id)
    project = session.get(Project, resolved_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.auth_method == "apikey":
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != project.api_key:
            raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    elif project.auth_method == "jwt":
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Bearer Token")
        # NOTE: In the sandbox, we just check for presence of a Bearer token
        # to allow easy testing without complex token generation.
    return True


router = APIRouter(prefix="/api/mock/{project_id}", tags=["mock"], dependencies=[Depends(verify_mock_auth)])


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
    resolved_id = _resolve_project_id(session, project_id)
    store = _mock_data.get(resolved_id)
    if store is None:
        # Check if project exists but mock not started
        raise HTTPException(status_code=404, detail="Mock data not initialized. Start mock server from the dashboard.")

    # Check if this is a list or detail request
    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == resolved_id)
    ).all()

    # Match the path to an endpoint
    full_path = f"/{path.strip('/')}"
    matched_ep = None
    param_value = None
    
    print(f"[MockServer] Matching GET {full_path}")

    # 1. Exact path match first
    for ep in endpoints:
        if ep.method.upper() != "GET":
            continue
        if f"/{ep.path.strip('/')}" == full_path:
            matched_ep = ep
            break

    # 2. Pattern match if no exact match (e.g. /pokemon/25)
    if not matched_ep:
        for ep in endpoints:
            if ep.method.upper() != "GET":
                continue
            ep_path = f"/{ep.path.strip('/')}"
            if "{" in ep_path and "}" in ep_path:
                import re
                pattern = re.sub(r"\{[^}]+\}", r"([^/]+)", ep_path)
                match = re.fullmatch(pattern, full_path)
                if match:
                    param_value = match.group(1)
                    matched_ep = ep
                    break

    if not matched_ep:
        raise HTTPException(
            status_code=404, 
            detail=f"No matching endpoint definition for GET {full_path}."
        )

    # Use operation_type for logic
    op_type = getattr(matched_ep, "operation_type", "custom")

    if op_type == "get" or param_value:
        # Get by ID
        target_id = param_value or path.split("/")[-1]
        for item in store:
            if str(item.get("_id")) == str(target_id) or str(item.get("id")) == str(target_id) or str(item.get("pokedex_id")) == str(target_id):
                return item
        raise HTTPException(status_code=404, detail="Item not found")

    # Default to list
    return store[skip:skip + limit]


@router.post("/{path:path}")
async def mock_post(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    """Mock POST — create a new record."""
    resolved_id = _resolve_project_id(session, project_id)
    store = _mock_data.get(resolved_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Mock server not running for this project. Start it first.")

    # Validate endpoint exists
    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == resolved_id)
    ).all()
    
    full_path = f"/{path.strip('/')}"
    matched = any(ep.method.upper() == "POST" and f"/{ep.path.strip('/')}" == full_path for ep in endpoints)
    
    if not matched:
        # Relaxed check for POST if path is common
        if path not in ["records", "items", "data"]:
             raise HTTPException(status_code=404, detail=f"No matching POST endpoint for {full_path}")

    try:
        body = await request.json()
    except Exception:
        body = {}

    new_item = {"_id": str(uuid4())[:8], "id": len(store) + 1, **body, "created_at": datetime.utcnow().isoformat()}
    store.append(new_item)
    return new_item


@router.put("/{path:path}")
async def mock_put(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    """Mock PUT — update a record."""
    resolved_id = _resolve_project_id(session, project_id)
    store = _mock_data.get(resolved_id)
    if store is None:
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
    session: Session = Depends(get_session),
) -> None:
    """Mock DELETE — remove a record."""
    resolved_id = _resolve_project_id(session, project_id)
    store = _mock_data.get(resolved_id)
    if store is None:
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

    # Load initial data from dataset sample_rows or generate if empty
    store = []
    if dataset and dataset.sample_rows:
        try:
            store = json.loads(dataset.sample_rows)
            # Ensure every item has an _id for our mock logic
            for item in store:
                if "_id" not in item:
                    item["_id"] = str(uuid4())[:8]
            _mock_data[str(project_id)] = store
        except Exception as e:
            print(f"[MockServer] Error loading sample_rows: {e}")
            store = init_mock_data(str(project_id), fields)
    else:
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
