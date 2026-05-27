"""Project version management routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import get_session
from ..db_models import Project as DBProject
from ..security import CurrentUser, get_current_user_from_header, require_project_access
from ..services.project_service import project_service
from ..services.version_service import version_service

router = APIRouter(prefix="/projects/{project_id}/versions", tags=["versions"])


class VersionResponse(BaseModel):
    id: str
    version: int
    message: str
    created_at: str


class VersionDetailResponse(VersionResponse):
    snapshot_data: dict


class CreateVersionRequest(BaseModel):
    message: str = ""


@router.get("", response_model=list[VersionResponse])
def list_versions(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> list[VersionResponse]:
    resolved_id = project_service.resolve_id(session, project_id)
    versions = version_service.list_versions(session, resolved_id)
    return [
        VersionResponse(
            id=v.id,
            version=v.version,
            message=v.message,
            created_at=v.created_at.isoformat(),
        )
        for v in versions
    ]


@router.get("/{version_id}", response_model=VersionDetailResponse)
def get_version(
    project_id: str,
    version_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> VersionDetailResponse:
    resolved_id = project_service.resolve_id(session, project_id)
    try:
        version = version_service.get_version(session, resolved_id, version_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Version not found") from exc
    return VersionDetailResponse(
        id=version.id,
        version=version.version,
        message=version.message,
        created_at=version.created_at.isoformat(),
        snapshot_data=json.loads(version.snapshot_data),
    )


@router.post("", response_model=VersionResponse, status_code=201)
def create_version(
    project_id: str,
    payload: CreateVersionRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> VersionResponse:
    resolved_id = project_service.resolve_id(session, project_id)
    version = version_service.create_version(session, resolved_id, payload.message)

    return VersionResponse(
        id=version.id,
        version=version.version,
        message=version.message,
        created_at=version.created_at.isoformat(),
    )


@router.post("/{version_id}/restore", response_model=dict)
def restore_version(
    project_id: str,
    version_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> dict:
    resolved_id = project_service.resolve_id(session, project_id)
    try:
        version = version_service.restore_version(session, resolved_id, version_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Version not found") from exc

    return {"message": f"Version {version.version} restaurada correctamente", "version": version.version}
