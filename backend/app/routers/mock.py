"""Routes for mock server runtime."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Project
from ..security import CurrentUser, require_admin
from ..services.mock_server import get_mock_status_fn, start_mock_server_fn, stop_mock_server_fn, router as mock_api_router


router = APIRouter(prefix="/projects", tags=["mock"])


def _resolve_project_id(session: Session, project_id: str) -> str:
    """Resolve a project ID that may be a name slug or a UUID."""
    # Try as UUID first
    project = session.get(Project, project_id)
    if project:
        return project.id
    # Try lookup by name (slugified)
    project = session.exec(select(Project).where(Project.name == project_id)).first()
    if project:
        return project.id
    raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")


@router.post("/{project_id}/mock/start")
def mock_start(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Start mock server for a project."""
    resolved_id = _resolve_project_id(session, project_id)
    return start_mock_server_fn(session, resolved_id)


@router.post("/{project_id}/mock/stop")
def mock_stop(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Stop mock server for a project."""
    resolved_id = _resolve_project_id(session, project_id)
    return stop_mock_server_fn(resolved_id)


@router.get("/{project_id}/mock/status")
def mock_status(
    project_id: str,
    session: Session = Depends(get_session),
) -> dict:
    """Get mock server status."""
    try:
        resolved_id = _resolve_project_id(session, project_id)
    except HTTPException:
        return {"project_id": project_id, "status": "stopped"}
    return get_mock_status_fn(resolved_id)
