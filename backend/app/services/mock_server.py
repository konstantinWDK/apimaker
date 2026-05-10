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


# In-memory mock data store: _mock_data[project_id][dataset_id] = list[dict]
_mock_data: dict[str, dict[str, list[dict]]] = {}


def init_mock_data(project_id: str) -> dict[str, list[dict]]:
    """Initialize mock data store for a project (empty)."""
    _mock_data[project_id] = {}
    return {}


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


def _find_dataset_for_endpoint(session: Session, resolved_project_id: str, matched_ep: Endpoint) -> tuple[str | None, list[dict]]:
    """Find the correct dataset and its data for a matched endpoint.
    
    Returns (dataset_id, data_list). Falls back to first dataset with data.
    """
    # 1. Try to find dataset via endpoint's target_dataset_id
    if matched_ep.target_dataset_id:
        ds = session.get(Dataset, matched_ep.target_dataset_id)
        if ds and ds.id:
            store = _mock_data.get(resolved_project_id, {}).get(ds.id)
            if store is not None:
                return (ds.id, store)

    # 2. Fallback: find first dataset that has data for this project
    project_datasets = session.exec(
        select(Dataset).where(Dataset.project_id == resolved_project_id)
    ).all()
    for ds in project_datasets:
        store = _mock_data.get(resolved_project_id, {}).get(ds.id)
        if store is not None:
            return (ds.id, store)

    return (None, [])


@router.get("/{path:path}")
async def mock_get(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
) -> Any:
    """Mock GET — list or get by ID."""
    try:
        resolved_id = _resolve_project_id(session, project_id)
        project_ds = _mock_data.get(resolved_id)
        if project_ds is None or not project_ds:
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
            import re
            for ep in endpoints:
                if ep.method.upper() != "GET":
                    continue
                ep_path = f"/{ep.path.strip('/')}"
                if "{" in ep_path and "}" in ep_path:
                    # First escape all regex metacharacters in the path,
                    # then convert {param} placeholders back to capture groups
                    escaped = re.escape(ep_path)
                    pattern = re.sub(r"\\\{[^}]+\\\}", r"([^/]+)", escaped)
                    try:
                        match = re.fullmatch(pattern, full_path)
                        if match:
                            param_value = match.group(1)
                            matched_ep = ep
                            break
                    except Exception as re_err:
                        print(f"[MockServer] Regex error: {re_err}")

        if not matched_ep:
            raise HTTPException(
                status_code=404,
                detail=f"No matching endpoint definition for GET {full_path}."
            )

        # Find the correct dataset for this endpoint
        ds_id, store = _find_dataset_for_endpoint(session, resolved_id, matched_ep)

        # Extract query params for filtering (excluding pagination)
        query_params = dict(request.query_params)
        query_params.pop('skip', None)
        query_params.pop('limit', None)

        # Filter the store based on query parameters if any
        if query_params:
            filtered_store = []
            for item in store:
                if not isinstance(item, dict):
                    continue
                match = True
                for k, v in query_params.items():
                    if k not in item:
                        match = False
                        break
                    
                    item_val = item[k]
                    # Handle different types for comparison
                    if isinstance(item_val, (int, float)):
                        try:
                            if float(item_val) != float(v):
                                match = False
                                break
                        except (ValueError, TypeError):
                            match = False
                            break
                    elif isinstance(item_val, bool):
                        if str(item_val).lower() != str(v).lower():
                            match = False
                            break
                    else:
                        # String comparison (case-insensitive)
                        if str(item_val).lower() != str(v).lower():
                            match = False
                            break
                if match:
                    filtered_store.append(item)
            store = filtered_store

        # Use operation_type for logic
        op_type = getattr(matched_ep, "operation_type", "custom")

        if param_value:
            # Path param captured — this is a detail request
            target_id = param_value
            print(f"[MockServer] Searching for record matching '{target_id}' in filtered dataset {ds_id} ({len(store)} items)")

            # 1. Try standard ID fields first
            for item in store:
                if not isinstance(item, dict):
                    continue
                if str(item.get("_id")) == str(target_id) or str(item.get("id")) == str(target_id):
                    return item

            # 2. Try matching any string field (e.g. name, slug, pokedex_id)
            for item in store:
                if not isinstance(item, dict):
                    continue
                for key, val in item.items():
                    if val is not None and str(val).lower() == str(target_id).lower():
                        return item

            print(f"[MockServer] No match found for {target_id}")
            raise HTTPException(status_code=404, detail=f"No record found matching '{target_id}'")

        if op_type == "list":
            # Explicit list endpoint — return paginated list
            return store[skip:skip + limit]

        if op_type == "get":
            # "get" operation without path param: check if path has multiple segments
            path_segments = path.strip("/").split("/")
            if len(path_segments) >= 2:
                target_id = path_segments[-1]
                print(f"[MockServer] Searching for record matching '{target_id}' in dataset {ds_id}")

                for item in store:
                    if not isinstance(item, dict):
                        continue
                    if str(item.get("_id")) == str(target_id) or str(item.get("id")) == str(target_id):
                        return item

                for item in store:
                    if not isinstance(item, dict):
                        continue
                    for key, val in item.items():
                        if val is not None and str(val).lower() == str(target_id).lower():
                            return item

                print(f"[MockServer] No match found for {target_id}")
                raise HTTPException(status_code=404, detail=f"No record found matching '{target_id}'")

            # Single-segment path with op_type "get" — return list
            return store[skip:skip + limit]

        # Default: return list for custom operations
        return store[skip:skip + limit]
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Mock Server Error: {str(e)}")


@router.post("/{path:path}")
async def mock_post(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    """Mock POST — create a new record."""
    resolved_id = _resolve_project_id(session, project_id)
    project_ds = _mock_data.get(resolved_id)
    if project_ds is None or not project_ds:
        raise HTTPException(status_code=404, detail="Mock server not running for this project. Start it first.")

    # Find matching POST endpoint to determine target dataset
    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == resolved_id)
    ).all()

    full_path = f"/{path.strip('/')}"
    matched_ep = None
    
    # 1. Look for exact POST endpoint match
    for ep in endpoints:
        if ep.method.upper() == "POST" and f"/{ep.path.strip('/')}" == full_path:
            matched_ep = ep
            break

    # 2. If no POST match, look for a GET match on the same path (Smart Fallback)
    if not matched_ep:
        for ep in endpoints:
            if ep.method.upper() == "GET" and f"/{ep.path.strip('/')}" == full_path:
                matched_ep = ep
                # We found a GET endpoint on the same path, we'll assume the user
                # wants to POST to the same dataset.
                break

    if not matched_ep:
        if path not in ["records", "items", "data"]:
            raise HTTPException(status_code=404, detail=f"No matching endpoint (POST or GET) found for {full_path}. Create the endpoint in the designer first.")

    # Find the correct dataset
    ds_id, store = _find_dataset_for_endpoint(session, resolved_id, matched_ep) if matched_ep else (None, [])

    # Use the first available store if no specific dataset found
    if not store:
        for ds_store in project_ds.values():
            if ds_store:
                store = ds_store
                break

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
    project_ds = _mock_data.get(resolved_id)
    if project_ds is None or not project_ds:
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

    # Search across all dataset stores for this project
    for ds_id, store in project_ds.items():
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
    project_ds = _mock_data.get(resolved_id)
    if project_ds is None or not project_ds:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    # Extract ID from path
    parts = path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="ID required in path")
    item_id = parts[-1]

    # Search across all dataset stores
    for ds_id, store in project_ds.items():
        for i, item in enumerate(store):
            if item.get("_id") == item_id or str(item.get("id")) == str(item_id):
                store.pop(i)
                return

    raise HTTPException(status_code=404, detail="Not found")


# Public functions for the mock router


def start_mock_server_fn(session: Session, project_id: str) -> dict:
    """Start mock server for a project (initialize data for ALL datasets)."""
    print(f"[MockServer] Starting mock server for project_id={project_id}")
    project = session.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Load ALL datasets for this project
    datasets = session.exec(
        select(Dataset).where(Dataset.project_id == str(project_id))
    ).all()

    print(f"[MockServer] Found {len(datasets)} datasets for project")

    fields = []
    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == str(project_id))
    ).all()

    project_store: dict[str, list[dict]] = {}
    total_rows = 0

    for dataset in datasets:
        ds_fields = session.exec(
            select(DatasetField).where(DatasetField.dataset_id == dataset.id)
        ).all()
        fields.extend(ds_fields)

        store = []
        if dataset.sample_rows:
            try:
                print(f"[MockServer] Loading sample_rows for dataset '{dataset.name}' ({len(dataset.sample_rows)} chars)")
                store = json.loads(dataset.sample_rows)
                print(f"[MockServer]   -> Loaded {len(store)} rows")
                if store:
                    print(f"[MockServer]   -> First row keys: {list(store[0].keys())}")
                # Ensure every item has an _id
                for item in store:
                    if "_id" not in item:
                        item["_id"] = str(uuid4())[:8]
                project_store[dataset.id] = store
                total_rows += len(store)
            except Exception as e:
                print(f"[MockServer]   -> Error loading sample_rows: {e}")
                import traceback
                traceback.print_exc()
                project_store[dataset.id] = []
        else:
            print(f"[MockServer]   -> No sample_rows for dataset '{dataset.name}', empty store")
            project_store[dataset.id] = []

    _mock_data[str(project_id)] = project_store

    return {
        "project_id": str(project_id),
        "status": "running",
        "base_url": f"/api/mock/{project_id}",
        "endpoints": [{"method": ep.method, "path": f"/api/mock/{project_id}{ep.path}"} for ep in endpoints],
        "datasets": len(project_store),
        "sample_rows": total_rows,
    }


def stop_mock_server_fn(project_id: str) -> dict:
    """Stop mock server and clear data."""
    _mock_data.pop(str(project_id), None)
    return {"project_id": str(project_id), "status": "stopped"}


def get_mock_status_fn(project_id: str) -> dict:
    """Get mock server status."""
    project_ds = _mock_data.get(str(project_id))
    if project_ds is not None:
        total = sum(len(store) for store in project_ds.values())
        return {
            "project_id": str(project_id),
            "status": "running",
            "base_url": f"/api/mock/{project_id}",
            "datasets": len(project_ds),
            "sample_rows": total,
        }
    return {"project_id": str(project_id), "status": "stopped"}
