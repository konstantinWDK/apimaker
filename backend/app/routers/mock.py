"""Routes for mock server runtime."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Project
from ..security import CurrentUser, get_current_user_from_header, require_admin, require_project_access
from ..services.mock_server import get_mock_status_fn, start_mock_server_fn, stop_mock_server_fn, router as mock_api_router


from ..services.project_service import project_service

router = APIRouter(prefix="/projects", tags=["mock"])


@router.post("/{project_id}/mock/start")
def mock_start(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Start mock server for a project."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        return start_mock_server_fn(session, resolved_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{project_id}/mock/stop")
def mock_stop(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> dict:
    """Stop mock server for a project."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        return stop_mock_server_fn(resolved_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/mock/status")
def mock_status(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: Project = Depends(require_project_access),
) -> dict:
    """Get mock server status (no auth required — read-only, in-memory check)."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        return get_mock_status_fn(resolved_id)
    except (HTTPException, KeyError):
        return {"project_id": project_id, "status": "stopped"}
