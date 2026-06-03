"""Product operations shared by logs, releases, automations and imports."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlmodel import Session, select

from ..db_models import (
    Automation,
    AutomationRun,
    Dataset,
    DatasetField,
    Endpoint,
    Project,
    ProjectRelease,
    RuntimeLog,
)


def json_dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def create_runtime_log(
    session: Session,
    project_id: str,
    event_type: str,
    *,
    method: str | None = None,
    path: str | None = None,
    status_code: int | None = None,
    duration_ms: int | None = None,
    message: str = "",
    metadata: dict | None = None,
) -> RuntimeLog:
    log = RuntimeLog(
        project_id=str(project_id),
        event_type=event_type,
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=duration_ms,
        message=message,
        metadata_json=json_dumps(metadata or {}),
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


def build_project_snapshot(session: Session, project_id: str, include_secrets: bool = False) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise KeyError("Project not found")

    datasets = session.exec(select(Dataset).where(Dataset.project_id == project_id)).all()
    datasets_data = []
    for ds in datasets:
        fields = session.exec(select(DatasetField).where(DatasetField.dataset_id == ds.id)).all()
        datasets_data.append(
            {
                "id": ds.id,
                "name": ds.name,
                "source_type": ds.source_type,
                "fields": [
                    {
                        "id": f.id,
                        "name": f.name,
                        "type": f.field_type,
                        "required": f.required,
                        "description": f.description,
                        "is_primary_key": f.is_primary_key,
                        "default_value": f.default_value,
                        "faker_category": f.faker_category,
                        "enum_values": json_loads(f.enum_values, None),
                        "references": json_loads(f.references, None),
                    }
                    for f in fields
                ],
                "sample_rows": json_loads(ds.sample_rows, []),
                "saved_requests": json_loads(ds.saved_requests, []),
            }
        )

    endpoints = session.exec(select(Endpoint).where(Endpoint.project_id == project_id)).all()
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "slug": project.slug,
            "description": project.description,
            "auth_method": project.auth_method,
            "api_key": project.api_key if include_secrets else None,
            "jwt_secret": project.jwt_secret if include_secrets else None,
            "rate_limit": project.rate_limit,
            "target_stack": project.target_stack,
            "include_data": project.include_data,
            "status": project.status,
        },
        "datasets": datasets_data,
        "endpoints": [
            {
                "id": ep.id,
                "name": ep.name,
                "method": ep.method,
                "path": ep.path,
                "summary": ep.summary,
                "operation_type": ep.operation_type,
                "target_dataset_id": ep.target_dataset_id,
            }
            for ep in endpoints
        ],
    }


def create_release(session: Session, project_id: str, message: str, created_by: str | None) -> ProjectRelease:
    last = session.exec(
        select(ProjectRelease)
        .where(ProjectRelease.project_id == project_id)
        .order_by(ProjectRelease.version.desc())
    ).first()
    version = (last.version + 1) if last else 1
    for active in session.exec(
        select(ProjectRelease).where(
            ProjectRelease.project_id == project_id,
            ProjectRelease.is_active == True,
        )
    ).all():
        active.is_active = False
        session.add(active)

    release = ProjectRelease(
        project_id=project_id,
        version=version,
        message=message,
        snapshot_data=json_dumps(build_project_snapshot(session, project_id)),
        is_active=True,
        created_by=created_by,
    )
    project = session.get(Project, project_id)
    if project:
        project.status = "published"
        project.updated_at = datetime.now(timezone.utc)
        session.add(project)
    session.add(release)
    session.commit()
    session.refresh(release)
    create_runtime_log(session, project_id, "release.created", message=message, metadata={"version": version})
    return release


async def dispatch_automations(
    session: Session,
    project_id: str,
    trigger_event: str,
    payload: dict,
) -> None:
    automations = session.exec(
        select(Automation).where(
            Automation.project_id == str(project_id),
            Automation.trigger_event == trigger_event,
            Automation.is_active == True,
        )
    ).all()

    for automation in automations:
        run = AutomationRun(
            automation_id=automation.id,
            project_id=str(project_id),
            status="pending",
            input_data=json_dumps(payload),
        )
        session.add(run)
        session.commit()
        output: list[dict] = []
        try:
            actions = json_loads(automation.actions, [])
            for action in actions:
                action_type = action.get("type")
                if action_type in {"http_request", "webhook"}:
                    url = action.get("url")
                    if not url:
                        output.append({"type": action_type, "status": "skipped", "reason": "missing url"})
                        continue
                    method = action.get("method", "POST").upper()
                    body = action.get("body", payload)
                    async with httpx.AsyncClient(timeout=10) as client:
                        resp = await client.request(method, url, json=body)
                    output.append({"type": action_type, "status": resp.status_code})
                elif action_type == "runtime_log":
                    create_runtime_log(
                        session,
                        project_id,
                        action.get("event_type", "automation.event"),
                        message=action.get("message", automation.name),
                        metadata={"automation_id": automation.id, "payload": payload},
                    )
                    output.append({"type": action_type, "status": "success"})
                else:
                    output.append({"type": action_type or "unknown", "status": "unsupported"})
            run.status = "success"
            run.output_data = json_dumps(output)
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)[:500]
        session.add(run)
        session.commit()
