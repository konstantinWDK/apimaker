"""Product capability routes inspired by internal-tool builders."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import (
    Automation,
    AutomationRun,
    Datasource,
    DbConnection,
    Project as DBProject,
    ProjectRelease,
    RuntimeLog,
    SavedQuery,
)
from ..security import CurrentUser, get_current_user_from_header, require_project_access
from ..services.project_service import project_service
from ..services.product_ops import (
    build_project_snapshot,
    create_release as create_project_release,
    create_runtime_log,
    dispatch_automations,
    json_dumps,
    json_loads,
)

router = APIRouter(prefix="/projects/{project_id}", tags=["product-ops"])
system_router = APIRouter(prefix="/api/platform", tags=["platform"])


class DatasourcePayload(BaseModel):
    name: str
    source_type: str = "manual"
    connection_id: str | None = None
    config: dict[str, Any] | None = None
    schema_snapshot: dict[str, Any] | None = None


class QueryPayload(BaseModel):
    name: str
    query_type: str = "sql"
    statement: str
    datasource_id: str | None = None
    connection_id: str | None = None
    bindings: dict[str, Any] | None = None


class RunQueryPayload(BaseModel):
    params: dict[str, Any] = Field(default_factory=dict)
    limit: int = 100


class ReleasePayload(BaseModel):
    message: str = ""


class AutomationPayload(BaseModel):
    name: str
    trigger_event: str = "manual"
    actions: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class ImportPayload(BaseModel):
    name: str = "Imported API"
    format: str = "openapi"  # openapi | postman
    document: dict[str, Any]


def _ensure_project_connection(session: Session, project_id: str, connection_id: str | None) -> DbConnection | None:
    if not connection_id:
        return None
    conn = session.get(DbConnection, connection_id)
    if not conn or conn.project_id != project_id:
        raise HTTPException(status_code=404, detail="Connection not found for project")
    return conn


def _ensure_project_datasource(session: Session, project_id: str, datasource_id: str | None) -> Datasource | None:
    if not datasource_id:
        return None
    ds = session.get(Datasource, datasource_id)
    if not ds or ds.project_id != project_id:
        raise HTTPException(status_code=404, detail="Datasource not found for project")
    return ds


def _datasource_to_dict(ds: Datasource) -> dict:
    return {
        "id": ds.id,
        "project_id": ds.project_id,
        "name": ds.name,
        "source_type": ds.source_type,
        "connection_id": ds.connection_id,
        "config": json_loads(ds.config, {}),
        "schema_snapshot": json_loads(ds.schema_snapshot, {}),
        "created_at": ds.created_at.isoformat(),
        "updated_at": ds.updated_at.isoformat(),
    }


def _query_to_dict(query: SavedQuery) -> dict:
    return {
        "id": query.id,
        "project_id": query.project_id,
        "datasource_id": query.datasource_id,
        "connection_id": query.connection_id,
        "name": query.name,
        "query_type": query.query_type,
        "statement": query.statement,
        "bindings": json_loads(query.bindings, {}),
        "created_at": query.created_at.isoformat(),
        "updated_at": query.updated_at.isoformat(),
    }


def _automation_to_dict(item: Automation) -> dict:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "name": item.name,
        "trigger_event": item.trigger_event,
        "actions": json_loads(item.actions, []),
        "is_active": item.is_active,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


@router.get("/datasources")
def list_datasources(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    rows = session.exec(select(Datasource).where(Datasource.project_id == project.id)).all()
    return [_datasource_to_dict(row) for row in rows]


@router.post("/datasources", status_code=status.HTTP_201_CREATED)
def create_datasource(
    project_id: str,
    payload: DatasourcePayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    _ensure_project_connection(session, project.id, payload.connection_id)
    ds = Datasource(
        project_id=project.id,
        name=payload.name,
        source_type=payload.source_type,
        connection_id=payload.connection_id,
        config=json_dumps(payload.config or {}),
        schema_snapshot=json_dumps(payload.schema_snapshot or {}),
    )
    session.add(ds)
    session.commit()
    session.refresh(ds)
    create_runtime_log(session, project.id, "datasource.created", message=payload.name, metadata={"datasource_id": ds.id})
    return _datasource_to_dict(ds)


@router.patch("/datasources/{datasource_id}")
def update_datasource(
    project_id: str,
    datasource_id: str,
    payload: DatasourcePayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    ds = session.get(Datasource, datasource_id)
    if not ds or ds.project_id != project.id:
        raise HTTPException(status_code=404, detail="Datasource not found")
    _ensure_project_connection(session, project.id, payload.connection_id)
    ds.name = payload.name
    ds.source_type = payload.source_type
    ds.connection_id = payload.connection_id
    ds.config = json_dumps(payload.config or {})
    ds.schema_snapshot = json_dumps(payload.schema_snapshot or {})
    ds.updated_at = datetime.now(timezone.utc)
    session.add(ds)
    session.commit()
    session.refresh(ds)
    return _datasource_to_dict(ds)


@router.delete("/datasources/{datasource_id}", status_code=204, response_model=None)
def delete_datasource(
    project_id: str,
    datasource_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> None:
    ds = session.get(Datasource, datasource_id)
    if not ds or ds.project_id != project.id:
        raise HTTPException(status_code=404, detail="Datasource not found")
    session.delete(ds)
    session.commit()


@router.get("/queries")
def list_queries(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    rows = session.exec(select(SavedQuery).where(SavedQuery.project_id == project.id)).all()
    return [_query_to_dict(row) for row in rows]


@router.post("/queries", status_code=status.HTTP_201_CREATED)
def create_query(
    project_id: str,
    payload: QueryPayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    _ensure_project_connection(session, project.id, payload.connection_id)
    _ensure_project_datasource(session, project.id, payload.datasource_id)
    query = SavedQuery(
        project_id=project.id,
        datasource_id=payload.datasource_id,
        connection_id=payload.connection_id,
        name=payload.name,
        query_type=payload.query_type,
        statement=payload.statement,
        bindings=json_dumps(payload.bindings or {}),
    )
    session.add(query)
    session.commit()
    session.refresh(query)
    return _query_to_dict(query)


@router.post("/queries/{query_id}/run")
def run_query(
    project_id: str,
    query_id: str,
    payload: RunQueryPayload = RunQueryPayload(),
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    query = session.get(SavedQuery, query_id)
    if not query or query.project_id != project.id:
        raise HTTPException(status_code=404, detail="Query not found")
    if query.query_type != "sql" or not query.statement.strip().lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT SQL queries can be run from the builder")
    conn = _ensure_project_connection(session, project.id, query.connection_id)
    if not conn:
        raise HTTPException(status_code=400, detail="SQL query requires a project connection")
    from .connections import _build_sqlalchemy_url, _decrypt_password

    password = _decrypt_password(conn.password_encrypted) if conn.password_encrypted else None
    engine = create_engine(_build_sqlalchemy_url(conn, password), pool_pre_ping=True)
    try:
        with engine.connect() as c:
            result = c.execute(text(query.statement), payload.params)
            rows = [dict(row._mapping) for row in result.fetchmany(max(1, min(payload.limit, 500)))]
        create_runtime_log(session, project.id, "query.run", message=query.name, metadata={"query_id": query.id, "rows": len(rows)})
        return {"columns": list(rows[0].keys()) if rows else [], "rows": rows}
    finally:
        engine.dispose()


@router.get("/runtime-logs")
def list_runtime_logs(
    project_id: str,
    event_type: str | None = None,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    statement = select(RuntimeLog).where(RuntimeLog.project_id == project.id)
    if event_type:
        statement = statement.where(RuntimeLog.event_type == event_type)
    rows = session.exec(statement.order_by(RuntimeLog.created_at.desc()).limit(200)).all()
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "method": row.method,
            "path": row.path,
            "status_code": row.status_code,
            "duration_ms": row.duration_ms,
            "message": row.message,
            "metadata": json_loads(row.metadata_json, {}),
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/releases")
def list_releases(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    rows = session.exec(
        select(ProjectRelease).where(ProjectRelease.project_id == project.id).order_by(ProjectRelease.version.desc())
    ).all()
    return [
        {
            "id": row.id,
            "version": row.version,
            "message": row.message,
            "is_active": row.is_active,
            "created_by": row.created_by,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/releases", status_code=status.HTTP_201_CREATED)
def create_release(
    project_id: str,
    payload: ReleasePayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    release = create_project_release(session, project.id, payload.message, user.user_id)
    return {"id": release.id, "version": release.version, "is_active": release.is_active, "created_at": release.created_at.isoformat()}


@router.get("/releases/{release_id}")
def get_release(
    project_id: str,
    release_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    release = session.get(ProjectRelease, release_id)
    if not release or release.project_id != project.id:
        raise HTTPException(status_code=404, detail="Release not found")
    return {
        "id": release.id,
        "version": release.version,
        "message": release.message,
        "is_active": release.is_active,
        "snapshot_data": json_loads(release.snapshot_data, {}),
        "created_at": release.created_at.isoformat(),
    }


@router.get("/automations")
def list_automations(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    rows = session.exec(select(Automation).where(Automation.project_id == project.id)).all()
    return [_automation_to_dict(row) for row in rows]


@router.post("/automations", status_code=status.HTTP_201_CREATED)
def create_automation(
    project_id: str,
    payload: AutomationPayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    automation = Automation(
        project_id=project.id,
        name=payload.name,
        trigger_event=payload.trigger_event,
        actions=json_dumps(payload.actions),
        is_active=payload.is_active,
    )
    session.add(automation)
    session.commit()
    session.refresh(automation)
    return _automation_to_dict(automation)


@router.post("/automations/{automation_id}/test")
async def test_automation(
    project_id: str,
    automation_id: str,
    payload: dict[str, Any] | None = None,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    automation = session.get(Automation, automation_id)
    if not automation or automation.project_id != project.id:
        raise HTTPException(status_code=404, detail="Automation not found")
    original_trigger = automation.trigger_event
    automation.trigger_event = "manual"
    session.add(automation)
    session.commit()
    try:
        await dispatch_automations(session, project.id, "manual", payload or {"test": True})
    finally:
        automation.trigger_event = original_trigger
        session.add(automation)
        session.commit()
    return {"status": "queued"}


@router.get("/automations/{automation_id}/runs")
def list_automation_runs(
    project_id: str,
    automation_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[dict]:
    rows = session.exec(
        select(AutomationRun)
        .where(AutomationRun.project_id == project.id, AutomationRun.automation_id == automation_id)
        .order_by(AutomationRun.created_at.desc())
        .limit(100)
    ).all()
    return [
        {
            "id": row.id,
            "status": row.status,
            "input_data": json_loads(row.input_data, {}),
            "output_data": json_loads(row.output_data, []),
            "error": row.error,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/imports", status_code=status.HTTP_201_CREATED)
def import_contract(
    project_id: str,
    payload: ImportPayload,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    """Import OpenAPI/Postman routes as endpoint definitions in the current project."""
    endpoints: list[dict] = []
    doc = payload.document
    if payload.format == "openapi":
        for path, path_item in (doc.get("paths") or {}).items():
            for method, op in path_item.items():
                if method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                    endpoints.append(
                        {
                            "name": op.get("operationId") or f"{method.upper()} {path}",
                            "method": method.upper(),
                            "path": path,
                            "summary": op.get("summary"),
                            "operation_type": "custom",
                        }
                    )
    elif payload.format == "postman":
        for item in doc.get("item", []):
            request = item.get("request", {})
            url = request.get("url", {})
            path = "/" + "/".join(url.get("path", [])) if isinstance(url, dict) else "/"
            endpoints.append(
                {
                    "name": item.get("name") or f"{request.get('method', 'GET')} {path}",
                    "method": request.get("method", "GET").upper(),
                    "path": path,
                    "summary": item.get("name"),
                    "operation_type": "custom",
                }
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported import format")

    existing = project_service.get_project_with_data(session, project.id)["endpoints"]
    merged = [
        {
            "id": ep.id,
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
            "operation_type": ep.operation_type,
            "target_dataset_id": ep.target_dataset_id,
        }
        for ep in existing
    ] + endpoints
    project_service.define_endpoints(session, project.id, merged)
    create_runtime_log(session, project.id, "import.completed", message=payload.format, metadata={"endpoints": len(endpoints)})
    return {"imported_endpoints": len(endpoints), "format": payload.format}


@router.get("/snapshot")
def get_snapshot(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> dict:
    return build_project_snapshot(session, project.id)


@system_router.get("/deploy-providers")
def list_deploy_providers(user: CurrentUser = Depends(get_current_user_from_header)) -> list[dict]:
    return [
        {"id": "docker-local", "name": "Docker Local", "status": "available"},
        {"id": "ssh", "name": "VPS via SSH", "status": "available"},
        {"id": "render", "name": "Render", "status": "planned"},
        {"id": "railway", "name": "Railway", "status": "planned"},
        {"id": "fly", "name": "Fly.io", "status": "planned"},
    ]


@system_router.get("/plugins")
def list_plugins(user: CurrentUser = Depends(get_current_user_from_header)) -> dict:
    return {
        "connectors": ["manual", "csv", "database", "rest"],
        "generators": ["fastapi", "express", "nest"],
        "deployers": ["docker-local", "ssh"],
        "automation_actions": ["http_request", "webhook", "runtime_log"],
    }
