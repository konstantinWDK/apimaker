"""Monitoring router — query runtime logs for project APIs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from ..db import get_session
from ..db_models import RuntimeLog
from ..security import CurrentUser, get_current_user_from_header
from ..services.project_service import project_service

router = APIRouter(prefix="/projects/{project_id}/monitor", tags=["monitor"])


@router.get("/logs")
def get_monitor_logs(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    method: str | None = Query(None),
    status_min: int | None = Query(None, ge=100, le=599),
    status_max: int | None = Query(None, ge=100, le=599),
    since_minutes: int | None = Query(None, ge=1, le=1440),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
) -> dict:
    resolved = project_service.resolve_id(session, project_id)
    query = select(RuntimeLog).where(RuntimeLog.project_id == resolved).order_by(RuntimeLog.created_at.desc())

    if method:
        query = query.where(RuntimeLog.method == method.upper())
    if status_min is not None:
        query = query.where(RuntimeLog.status_code >= status_min)
    if status_max is not None:
        query = query.where(RuntimeLog.status_code <= status_max)
    if since_minutes is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
        query = query.where(RuntimeLog.created_at >= cutoff)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    offset = (page - 1) * per_page
    logs = session.exec(query.offset(offset).limit(per_page)).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "logs": [
            {
                "id": log.id,
                "event_type": log.event_type,
                "method": log.method,
                "path": log.path,
                "status_code": log.status_code,
                "duration_ms": log.duration_ms,
                "message": log.message,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    }


@router.get("/summary")
def get_monitor_summary(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    since_minutes: int | None = Query(60, ge=1, le=1440),
) -> dict:
    resolved = project_service.resolve_id(session, project_id)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
    logs = session.exec(
        select(RuntimeLog).where(
            RuntimeLog.project_id == resolved,
            RuntimeLog.created_at >= cutoff,
        )
    ).all()

    total = len(logs)
    errors = [l for l in logs if l.status_code and l.status_code >= 400]
    durations = [l.duration_ms for l in logs if l.duration_ms is not None]

    by_endpoint: dict[str, dict] = {}
    for l in logs:
        key = f"{l.method} {l.path}" if l.method and l.path else "unknown"
        if key not in by_endpoint:
            by_endpoint[key] = {"method": l.method, "path": l.path, "count": 0, "errors": 0, "durations": []}
        by_endpoint[key]["count"] += 1
        if l.status_code and l.status_code >= 400:
            by_endpoint[key]["errors"] += 1
        if l.duration_ms is not None:
            by_endpoint[key]["durations"].append(l.duration_ms)

    return {
        "total_requests": total,
        "error_count": len(errors),
        "error_rate": round(len(errors) / total * 100, 1) if total > 0 else 0,
        "avg_duration_ms": round(sum(durations) / len(durations), 1) if durations else 0,
        "max_duration_ms": max(durations) if durations else 0,
        "by_endpoint": [
            {
                "method": v["method"],
                "path": v["path"],
                "count": v["count"],
                "errors": v["errors"],
                "avg_duration_ms": round(sum(v["durations"]) / len(v["durations"]), 1) if v["durations"] else 0,
            }
            for v in by_endpoint.values()
        ],
        "since_minutes": since_minutes,
    }
