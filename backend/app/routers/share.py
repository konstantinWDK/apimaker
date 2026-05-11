"""Routes for share snapshots."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..security import CurrentUser, get_current_user_from_header, require_admin
from ..services.share_service import (
    cleanup_expired_shares,
    create_share_snapshot,
    delete_share_snapshot,
    get_share_snapshot,
    list_project_shares,
)
from ..services.project_service import project_service


router = APIRouter(prefix="/share", tags=["share"])


class CreateShareRequest(BaseModel):
    password: str | None = None
    expires_days: int = 30


class ShareResponse(BaseModel):
    id: str
    slug: str
    url: str
    expires_at: str | None
    created_at: str
    views_count: int
    has_password: bool


class ShareDataResponse(BaseModel):
    project: dict
    dataset: dict | None
    endpoints: list[dict]
    share_id: str
    share_slug: str
    share_expires_at: str | None
    share_views: int


@router.get("/{snapshot_id}/{slug}", response_model=ShareDataResponse)
def get_shared_project(
    snapshot_id: str,
    slug: str,
    password: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> ShareDataResponse:
    """Retrieve a shared project snapshot (public endpoint)."""
    try:
        data = get_share_snapshot(session, snapshot_id, slug, password)
    except KeyError:
        raise HTTPException(status_code=404, detail="Share not found")
    except ValueError as e:
        if "expired" in str(e).lower():
            raise HTTPException(status_code=410, detail="Share link expired")
        if "password" in str(e).lower():
            raise HTTPException(status_code=401, detail="Password required")
        raise HTTPException(status_code=400, detail=str(e))
    return ShareDataResponse(**data)


@router.post("/projects/{project_id}", response_model=ShareResponse)
def create_share(
    project_id: str,
    payload: CreateShareRequest = CreateShareRequest(),
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> ShareResponse:
    """Create a share snapshot for a project."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        snapshot = create_share_snapshot(
            session, str(resolved_id), payload.password, payload.expires_days
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Project not found")
    return ShareResponse(
        id=snapshot.id,
        slug=snapshot.slug,
        url=f"/share/{snapshot.id}/{snapshot.slug}",
        expires_at=snapshot.expires_at.isoformat() if snapshot.expires_at else None,
        created_at=snapshot.created_at.isoformat(),
        views_count=snapshot.views_count,
        has_password=bool(snapshot.password_hash),
    )


@router.get("/projects/{project_id}", response_model=list[ShareResponse])
def list_shares(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> list[ShareResponse]:
    """List all share snapshots for a project."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        return list_project_shares(session, str(resolved_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{share_id}", status_code=204, response_model=None)
def delete_share(
    share_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    """Delete a share snapshot."""
    if not delete_share_snapshot(session, share_id):
        raise HTTPException(status_code=404, detail="Share not found")


@router.post("/cleanup", status_code=204, response_model=None)
def cleanup_shares(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    """Clean up expired share snapshots."""
    cleanup_expired_shares(session)
