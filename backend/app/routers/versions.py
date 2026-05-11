"""Project version management routes."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Project as DBProject, ProjectVersion
from ..security import CurrentUser, get_current_user_from_header
from ..services.project_service import project_service

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
) -> list[VersionResponse]:
    resolved_id = project_service.resolve_id(session, project_id)
    versions = session.exec(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == str(resolved_id))
        .order_by(ProjectVersion.version.desc())
    ).all()
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
) -> VersionDetailResponse:
    resolved_id = project_service.resolve_id(session, project_id)
    version = session.get(ProjectVersion, version_id)
    if not version or version.project_id != str(resolved_id):
        raise HTTPException(status_code=404, detail="Version not found")
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
) -> VersionResponse:
    from ..db_models import Dataset, DatasetField, Endpoint

    resolved_id = project_service.resolve_id(session, project_id)
    project = session.get(DBProject, resolved_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get next version number
    last = session.exec(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == str(resolved_id))
        .order_by(ProjectVersion.version.desc())
    ).first()
    next_version = (last.version + 1) if last else 1

    # Build snapshot (same as export)
    data = project_service.get_project_with_data(session, resolved_id)
    datasets_data = []
    for entry in data["datasets"]:
        ds = entry["dataset"]
        fields = entry["fields"]
        try:
            sample_rows = json.loads(ds.sample_rows) if ds.sample_rows else []
        except Exception:
            sample_rows = []
        datasets_data.append({
            "id": ds.id, "name": ds.name, "source_type": ds.source_type,
            "fields": [{"name": f.name, "type": f.field_type, "required": f.required, "description": f.description} for f in fields],
            "sample_rows": sample_rows,
        })

    endpoints_data = [{
        "id": ep.id, "name": ep.name, "method": ep.method, "path": ep.path,
        "summary": ep.summary, "operation_type": ep.operation_type, "target_dataset_id": ep.target_dataset_id,
    } for ep in data["endpoints"]]

    snapshot = {
        "project": {
            "name": project.name, "slug": project.slug, "description": project.description,
            "auth_method": project.auth_method, "api_key": project.api_key,
            "jwt_secret": project.jwt_secret, "rate_limit": project.rate_limit,
            "target_stack": project.target_stack,
        },
        "datasets": datasets_data,
        "endpoints": endpoints_data,
    }

    version = ProjectVersion(
        project_id=str(resolved_id),
        version=next_version,
        message=payload.message,
        snapshot_data=json.dumps(snapshot),
    )
    session.add(version)
    session.commit()
    session.refresh(version)

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
) -> dict:
    from ..db_models import Dataset, DatasetField, Endpoint

    resolved_id = project_service.resolve_id(session, project_id)
    version = session.get(ProjectVersion, version_id)
    if not version or version.project_id != str(resolved_id):
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = json.loads(version.snapshot_data)
    proj_data = snapshot.get("project", {})
    project = session.get(DBProject, resolved_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update project fields
    for key in ["name", "description", "target_stack", "auth_method", "api_key", "jwt_secret", "rate_limit"]:
        if key in proj_data:
            setattr(project, key, proj_data[key])
    project.updated_at = datetime.now(timezone.utc)

    # Clear existing datasets and endpoints
    for ep in session.exec(select(Endpoint).where(Endpoint.project_id == str(resolved_id))).all():
        session.delete(ep)
    for ds in session.exec(select(Dataset).where(Dataset.project_id == str(resolved_id))).all():
        for f in session.exec(select(DatasetField).where(DatasetField.dataset_id == ds.id)).all():
            session.delete(f)
        session.delete(ds)

    # Restore datasets
    for ds_data in snapshot.get("datasets", []):
        new_ds = Dataset(
            id=ds_data["id"],
            project_id=str(resolved_id),
            name=ds_data["name"],
            source_type=ds_data.get("source_type", "manual"),
            sample_rows=json.dumps(ds_data.get("sample_rows", [])),
        )
        session.add(new_ds)
        session.flush()
        for f_data in ds_data.get("fields", []):
            session.add(DatasetField(
                dataset_id=new_ds.id,
                name=f_data["name"],
                field_type=f_data.get("type", "string"),
                required=f_data.get("required", True),
                description=f_data.get("description"),
            ))

    # Restore endpoints
    for ep_data in snapshot.get("endpoints", []):
        session.add(Endpoint(
            id=ep_data["id"],
            project_id=str(resolved_id),
            name=ep_data["name"],
            method=ep_data["method"],
            path=ep_data["path"],
            summary=ep_data.get("summary"),
            operation_type=ep_data.get("operation_type", "custom"),
            target_dataset_id=ep_data.get("target_dataset_id"),
        ))

    session.add(project)
    session.commit()

    return {"message": f"Version {version.version} restaurada correctamente", "version": version.version}
