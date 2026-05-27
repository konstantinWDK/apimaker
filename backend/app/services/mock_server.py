"""Mock server runtime — simulates project API endpoints using DB-backed data."""

from __future__ import annotations

import json
import logging
import math
import re
import traceback
from datetime import datetime, timezone
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Dataset, DatasetField, Endpoint, MockRecord, Project
# Lazy import to avoid circular deps with routers
_dispatch_webhooks = None
def _get_webhook_dispatcher():
    global _dispatch_webhooks
    if _dispatch_webhooks is None:
        from ..routers.webhooks import dispatch_webhooks as dw
        _dispatch_webhooks = dw
    return _dispatch_webhooks
from .project_service import project_service
from .product_ops import create_runtime_log, dispatch_automations

logger = logging.getLogger("doapi.mock_server")

# In-memory cache: _mock_cache[project_id][dataset_id] = list[dict]
_mock_cache: dict[str, dict[str, list[dict]]] = {}


def _load_dataset_cache(session: Session, project_id: str, dataset_id: str) -> list[dict]:
    """Load a dataset's mock records from DB into the in-memory cache."""
    rows = session.exec(
        select(MockRecord).where(
            MockRecord.project_id == project_id,
            MockRecord.dataset_id == dataset_id
        )
    ).all()
    store = []
    for row in rows:
        item = json.loads(row.data)
        item["_id"] = row.record_id
        store.append(item)
    if project_id not in _mock_cache:
        _mock_cache[project_id] = {}
    _mock_cache[project_id][dataset_id] = store
    return store


def _invalidate_cache(project_id: str, dataset_id: str) -> None:
    """Remove a dataset from the in-memory cache so it reloads from DB on next access."""
    if project_id in _mock_cache and dataset_id in _mock_cache[project_id]:
        del _mock_cache[project_id][dataset_id]


def _get_store(session: Session, project_id: str, dataset_id: str) -> list[dict]:
    """Get the dataset store from cache, loading from DB if needed."""
    project_cache = _mock_cache.get(project_id, {})
    if dataset_id in project_cache:
        return project_cache[dataset_id]
    return _load_dataset_cache(session, project_id, dataset_id)


def _save_record(
    session: Session, project_id: str, dataset_id: str, record_id: str, data: dict
) -> None:
    """Persist a mock record to the DB."""
    clean_data = {k: v for k, v in data.items() if k != "_id"}
    existing = session.exec(
        select(MockRecord).where(
            MockRecord.project_id == project_id,
            MockRecord.dataset_id == dataset_id,
            MockRecord.record_id == record_id
        )
    ).first()
    if existing:
        existing.data = json.dumps(clean_data, ensure_ascii=False, default=str)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        existing = MockRecord(
            project_id=project_id,
            dataset_id=dataset_id,
            record_id=record_id,
            data=json.dumps(clean_data, ensure_ascii=False, default=str),
        )
        session.add(existing)
    session.commit()


def _delete_record(
    session: Session, project_id: str, dataset_id: str, record_id: str
) -> bool:
    """Remove a mock record from the DB. Returns True if found."""
    existing = session.exec(
        select(MockRecord).where(
            MockRecord.project_id == project_id,
            MockRecord.dataset_id == dataset_id,
            MockRecord.record_id == record_id
        )
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
        return True
    return False


def _resolve_project_id(session: Session, project_id: str) -> str:
    """Resolve a project ID from either a UUID string or a slug."""
    return project_service.resolve_id(session, project_id)


async def verify_mock_auth(
    project_id: str,
    request: Request,
    session: Session = Depends(get_session)
):
    """Verify auth headers if the project has authentication enabled.
    
    Also accepts the builder's admin JWT to allow internal tools (Dashboard, Admin Panel)
    to access the mock server without the project's specific API key or JWT secret.
    """
    resolved_id = project_service.resolve_id(session, project_id)
    project = session.get(Project, resolved_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Skip project-level auth if the request is authenticated as a builder admin
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        builder_token = auth_header.split(" ", 1)[1]
        try:
            from ..services.jwt_service import decode_token
            from ..config import get_settings
            payload = decode_token(builder_token, secret=get_settings().jwt_secret_key)
            if payload.get("role") == "admin":
                return True
        except Exception:
            pass  # Not a valid builder token, fall through to project auth

    if project.auth_method == "apikey":
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != project.api_key:
            raise HTTPException(status_code=401, detail="Invalid or missing API Key")
    elif project.auth_method == "jwt":
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Bearer Token")
        token = auth_header.split(" ", 1)[1] if " " in auth_header else ""
        if project.jwt_secret:
            try:
                from ..services.jwt_service import decode_token
                decode_token(token, secret=project.jwt_secret)
            except HTTPException:
                raise
            except ValueError:
                raise HTTPException(status_code=401, detail="Invalid or expired JWT token")
            except Exception:
                raise HTTPException(status_code=401, detail="Invalid or expired JWT token")
    return True


router = APIRouter(prefix="/mock/{project_id}", tags=["mock"], dependencies=[Depends(verify_mock_auth)])


def _find_dataset_for_endpoint(session: Session, resolved_project_id: str, matched_ep: Endpoint) -> tuple[str | None, list[dict]]:
    """Find the correct dataset and its data for a matched endpoint.

    Returns (dataset_id, data_list). Falls back to first dataset with data.
    """
    if matched_ep.target_dataset_id:
        ds = session.get(Dataset, matched_ep.target_dataset_id)
        if ds and ds.id:
            store = _get_store(session, resolved_project_id, ds.id)
            return (ds.id, store)

    project_datasets = session.exec(
        select(Dataset).where(Dataset.project_id == resolved_project_id)
    ).all()
    for ds in project_datasets:
        store = _get_store(session, resolved_project_id, ds.id)
        if store:
            return (ds.id, store)

    return (None, [])


def _validate_body(session: Session, dataset_id: str | None, body: dict) -> list[dict]:
    """Validate request body against dataset field definitions. Returns list of errors."""
    if not dataset_id:
        return []
    fields = session.exec(
        select(DatasetField).where(DatasetField.dataset_id == dataset_id)
    ).all()
    if not fields:
        return []

    errors: list[dict] = []

    for field in fields:
        val = body.get(field.name)

        # Check required
        if field.required and val is None and field.name not in body:
            errors.append({"field": field.name, "error": "required", "message": f"'{field.name}' is required"})
            continue

        if val is None:
            continue

        # Type validation
        if field.field_type == "integer":
            if isinstance(val, bool) or not isinstance(val, (int, float, str)):
                errors.append({"field": field.name, "error": "type", "message": f"'{field.name}' must be an integer"})
            elif isinstance(val, str):
                try:
                    int(val)
                except ValueError:
                    errors.append({"field": field.name, "error": "type", "message": f"'{field.name}' must be an integer"})

        elif field.field_type == "float":
            if isinstance(val, bool) or not isinstance(val, (int, float, str)):
                errors.append({"field": field.name, "error": "type", "message": f"'{field.name}' must be a number"})
            elif isinstance(val, str):
                try:
                    float(val)
                except ValueError:
                    errors.append({"field": field.name, "error": "type", "message": f"'{field.name}' must be a number"})

        elif field.field_type == "boolean":
            if isinstance(val, bool):
                continue
            if isinstance(val, str) and val.lower() in ("true", "false", "1", "0"):
                continue
            if isinstance(val, int) and val in (0, 1):
                continue
            errors.append({"field": field.name, "error": "type", "message": f"'{field.name}' must be a boolean"})

        # Check enum values
        if field.enum_values:
            try:
                allowed = json.loads(field.enum_values)
                if isinstance(allowed, list) and str(val) not in [str(v) for v in allowed]:
                    errors.append({"field": field.name, "error": "enum", "message": f"'{field.name}' must be one of {allowed}"})
            except (json.JSONDecodeError, TypeError):
                pass

    return errors


def _get_related_data(session: Session, project_id: str, dataset_id: str, requested_includes: list[str]) -> dict:
    """Build a dict of related data for ?include= queries."""
    related = {}
    ds_names = {}
    datasets = session.exec(
        select(Dataset).where(Dataset.project_id == project_id)
    ).all()
    for ds in datasets:
        ds_names[ds.name.lower()] = ds.id

    for name in requested_includes:
        clean = name.lower()
        if clean in ds_names:
            ds_id = ds_names[clean]
            store = _get_store(session, project_id, ds_id)
            if store:
                related[clean] = store

    return related


async def _mock_get_impl(
    project_id: str,
    path: str,
    request: Request,
    session: Session,
    page: int = 1,
    limit: int = 100,
    include: str | None = None,
) -> Any:
    """Mock GET implementation with plain Python defaults."""
    started = perf_counter()
    full_path_for_log = f"/{path.strip('/')}"
    try:
        resolved_id = _resolve_project_id(session, project_id)
        project_cache = _mock_cache.get(resolved_id)

        if project_cache is None:
            logger.info("Auto-initializing mock data for project %s", resolved_id)
            start_mock_server_fn(session, resolved_id)
            project_cache = _mock_cache.get(resolved_id)

        if project_cache is None:
            raise HTTPException(status_code=404, detail="Mock data not initialized. Start mock server from the dashboard.")

        endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id == resolved_id)
        ).all()

        full_path = f"/{path.strip('/')}"
        matched_ep = None
        param_value = None

        for ep in endpoints:
            if ep.method.upper() != "GET":
                continue
            if f"/{ep.path.strip('/')}" == full_path:
                matched_ep = ep
                break

        if not matched_ep:
            for ep in endpoints:
                if ep.method.upper() != "GET":
                    continue
                ep_path = f"/{ep.path.strip('/')}"
                if "{" in ep_path and "}" in ep_path:
                    escaped = re.escape(ep_path)
                    pattern = re.sub(r"\\\{[^}]+\\\}", r"([^/]+)", escaped)
                    try:
                        match = re.fullmatch(pattern, full_path)
                        if match:
                            param_value = match.group(1)
                            matched_ep = ep
                            break
                    except Exception as re_err:
                        logger.debug("Regex error: %s", re_err)

        if not matched_ep:
            raise HTTPException(
                status_code=404,
                detail=f"No matching endpoint definition for GET {full_path}."
            )

        ds_id, store = _find_dataset_for_endpoint(session, resolved_id, matched_ep)

        query_params = dict(request.query_params)
        query_params.pop('page', None)
        query_params.pop('limit', None)
        query_params.pop('include', None)

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
                        if str(item_val).lower() != str(v).lower():
                            match = False
                            break
                if match:
                    filtered_store.append(item)
            store = filtered_store

        op_type = getattr(matched_ep, "operation_type", "custom")

        if param_value:
            target_id = param_value
            for item in store:
                if not isinstance(item, dict):
                    continue
                if str(item.get("_id")) == str(target_id) or str(item.get("id")) == str(target_id):
                    if include:
                        related = _get_related_data(session, resolved_id, ds_id, include.split(","))
                        item = {**item, "_includes": related}
                    create_runtime_log(
                        session,
                        resolved_id,
                        "endpoint.called",
                        method="GET",
                        path=full_path_for_log,
                        status_code=200,
                        duration_ms=int((perf_counter() - started) * 1000),
                    )
                    await dispatch_automations(session, resolved_id, "endpoint.called", {"method": "GET", "path": full_path_for_log, "record": item})
                    return item

            for item in store:
                if not isinstance(item, dict):
                    continue
                for key, val in item.items():
                    if val is not None and str(val).lower() == str(target_id).lower():
                        if include:
                            related = _get_related_data(session, resolved_id, ds_id, include.split(","))
                            item = {**item, "_includes": related}
                        create_runtime_log(
                            session,
                            resolved_id,
                            "endpoint.called",
                            method="GET",
                            path=full_path_for_log,
                            status_code=200,
                            duration_ms=int((perf_counter() - started) * 1000),
                        )
                        await dispatch_automations(session, resolved_id, "endpoint.called", {"method": "GET", "path": full_path_for_log, "record": item})
                        return item

            raise HTTPException(status_code=404, detail=f"No record found matching '{target_id}'")

        skip = (page - 1) * limit
        total = len(store)
        items = store[skip:skip + limit]

        if include and items:
            related = _get_related_data(session, resolved_id, ds_id, include.split(","))
            items = [{**item, "_includes": related} for item in items]

        response = {
            "data": items,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit) if total > 0 else 0,
        }
        create_runtime_log(
            session,
            resolved_id,
            "endpoint.called",
            method="GET",
            path=full_path_for_log,
            status_code=200,
            duration_ms=int((perf_counter() - started) * 1000),
            metadata={"total": total},
        )
        await dispatch_automations(session, resolved_id, "endpoint.called", {"method": "GET", "path": full_path_for_log, "total": total})
        return response
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Mock Server Error: {str(e)}")


@router.get("/{path:path}")
async def mock_get(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    include: str = Query(None, description="Comma-separated relations to include"),
) -> Any:
    """Mock GET — route handler that delegates to _mock_get_impl."""
    return await _mock_get_impl(project_id, path, request, session, page, limit, include)


@router.post("/{path:path}")
async def mock_post(
    project_id: str,
    path: str,
    request: Request,
    session: Session = Depends(get_session),
) -> dict:
    """Mock POST — create a new record."""
    resolved_id = _resolve_project_id(session, project_id)
    project_cache = _mock_cache.get(resolved_id)

    if project_cache is None:
        logger.info("Auto-initializing mock data for project %s", resolved_id)
        start_mock_server_fn(session, resolved_id)
        project_cache = _mock_cache.get(resolved_id)

    if project_cache is None:
        raise HTTPException(status_code=404, detail="Mock server not running for this project. Start it first.")

    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == resolved_id)
    ).all()

    full_path = f"/{path.strip('/')}"
    matched_ep = None

    for ep in endpoints:
        if ep.method.upper() == "POST" and f"/{ep.path.strip('/')}" == full_path:
            matched_ep = ep
            break

    if not matched_ep:
        for ep in endpoints:
            if ep.method.upper() == "GET" and f"/{ep.path.strip('/')}" == full_path:
                matched_ep = ep
                break

    if not matched_ep:
        if path not in ["records", "items", "data"]:
            raise HTTPException(status_code=404, detail=f"No matching endpoint (POST or GET) found for {full_path}. Create the endpoint in the designer first.")

    ds_id, store = _find_dataset_for_endpoint(session, resolved_id, matched_ep) if matched_ep else (None, [])

    if not store:
        for ds_store in project_cache.values():
            if ds_store:
                store = ds_store
                break

    try:
        body = await request.json()
    except Exception:
        body = {}

    # Validate body against dataset schema
    errors = _validate_body(session, ds_id, body)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Validation failed", "errors": errors})

    record_id = str(uuid4())[:8]
    new_item = {"_id": record_id, "id": len(store) + 1, **body, "created_at": datetime.now(timezone.utc).isoformat()}
    store.append(new_item)

    if ds_id:
        _save_record(session, resolved_id, ds_id, record_id, new_item)

    await _get_webhook_dispatcher()(session, str(resolved_id), "create", new_item)
    create_runtime_log(session, resolved_id, "record.created", method="POST", path=full_path, status_code=201, metadata={"record_id": record_id})
    await dispatch_automations(session, resolved_id, "record.created", {"method": "POST", "path": full_path, "record": new_item})
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
    project_cache = _mock_cache.get(resolved_id)
    if project_cache is None:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    try:
        body = await request.json()
    except Exception:
        body = {}

    parts = path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="ID required in path")
    item_id = parts[-1]

    for ds_id, store in project_cache.items():
        for i, item in enumerate(store):
            if item.get("_id") == item_id or str(item.get("id")) == str(item_id):
                errors = _validate_body(session, ds_id, body)
                if errors:
                    raise HTTPException(status_code=422, detail={"message": "Validation failed", "errors": errors})
                updated = {"_id": item_id, **body}
                store[i] = updated
                _save_record(session, resolved_id, ds_id, item_id, updated)
                await _get_webhook_dispatcher()(session, str(resolved_id), "update", updated)
                create_runtime_log(session, resolved_id, "record.updated", method="PUT", path=f"/{path.strip('/')}", status_code=200, metadata={"record_id": item_id})
                await dispatch_automations(session, resolved_id, "record.updated", {"method": "PUT", "path": f"/{path.strip('/')}", "record": updated})
                return updated

    raise HTTPException(status_code=404, detail="Not found")


@router.delete("/{path:path}", status_code=204, response_model=None)
async def mock_delete(
    project_id: str,
    path: str,
    session: Session = Depends(get_session),
) -> None:
    """Mock DELETE — remove a record."""
    resolved_id = _resolve_project_id(session, project_id)
    project_cache = _mock_cache.get(resolved_id)
    if project_cache is None:
        raise HTTPException(status_code=404, detail="Mock data not initialized.")

    parts = path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="ID required in path")
    item_id = parts[-1]

    for ds_id, store in project_cache.items():
        for i, item in enumerate(store):
            if item.get("_id") == item_id or str(item.get("id")) == str(item_id):
                removed = store.pop(i)
                _delete_record(session, resolved_id, ds_id, item_id)
                await _get_webhook_dispatcher()(session, str(resolved_id), "delete", removed)
                create_runtime_log(session, resolved_id, "record.deleted", method="DELETE", path=f"/{path.strip('/')}", status_code=204, metadata={"record_id": item_id})
                await dispatch_automations(session, resolved_id, "record.deleted", {"method": "DELETE", "path": f"/{path.strip('/')}", "record": removed})
                return

    raise HTTPException(status_code=404, detail="Not found")


# Public functions for the mock router


def start_mock_server_fn(session: Session, project_id: str) -> dict:
    """Start mock server for a project — loads data from MockRecord or seeds from sample_rows."""
    logger.info("Starting mock server for project_id=%s", project_id)
    project = session.get(Project, str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    datasets = session.exec(
        select(Dataset).where(Dataset.project_id == str(project_id))
    ).all()

    logger.info("Found %d datasets for project", len(datasets))

    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == str(project_id))
    ).all()

    project_store: dict[str, list[dict]] = {}
    total_rows = 0

    for dataset in datasets:
        existing_count = len(
            session.exec(
                select(MockRecord).where(
                    MockRecord.project_id == str(project_id),
                    MockRecord.dataset_id == dataset.id
                )
            ).all()
        )

        if existing_count > 0:
            logger.debug("Loading %d existing mock records for dataset '%s'", existing_count, dataset.name)
            store = _load_dataset_cache(session, str(project_id), dataset.id)
            project_store[dataset.id] = store
            total_rows += len(store)
        else:
            store = []
            if dataset.sample_rows:
                try:
                    sample = json.loads(dataset.sample_rows)
                    for item in sample:
                        record_id = item.pop("_id", str(uuid4())[:8])
                        item["_id"] = record_id
                        _save_record(session, str(project_id), dataset.id, record_id, item)
                        store.append(item)
                    logger.debug("Seeded %d sample rows for dataset '%s'", len(store), dataset.name)
                except Exception as e:
                    logger.warning("Error loading sample_rows for dataset '%s': %s", dataset.name, e)
                    traceback.print_exc()
            else:
                logger.debug("No sample_rows for dataset '%s', empty store", dataset.name)

            project_store[dataset.id] = store
            _mock_cache[str(project_id)] = project_store
            total_rows += len(store)

    _mock_cache[str(project_id)] = project_store

    return {
        "project_id": str(project_id),
        "status": "running",
        "base_url": f"/api/mock/{project_id}",
        "endpoints": [{"method": ep.method, "path": f"/api/mock/{project_id}{ep.path}"} for ep in endpoints],
        "datasets": len(project_store),
        "sample_rows": total_rows,
    }


def stop_mock_server_fn(project_id: str) -> dict:
    """Stop mock server and clear cache (data stays in DB)."""
    _mock_cache.pop(str(project_id), None)
    return {"project_id": str(project_id), "status": "stopped"}


def get_mock_status_fn(project_id: str) -> dict:
    """Get mock server status."""
    project_cache = _mock_cache.get(str(project_id))
    if project_cache is not None:
        total = sum(len(store) for store in project_cache.values())
        return {
            "project_id": str(project_id),
            "status": "running",
            "base_url": f"/api/mock/{project_id}",
            "datasets": len(project_cache),
            "sample_rows": total,
        }
    return {"project_id": str(project_id), "status": "stopped"}
