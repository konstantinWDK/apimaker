"""Routes related to project and API generation lifecycle."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import FileResponse, HTMLResponse
from sqlmodel import Session

from ..db import get_session
from ..db_models import Project as DBProject
from ..models import (
    CreateProjectRequest,
    DefineEndpointsRequest,
    GenerationRequest,
    GenerationResult,
    Project,
    UploadDatasetRequest,
)
from ..openapi_builder import build_openapi_document
from ..services.generation import run_generation
from ..services.project_service import project_service
from ..security import require_admin, get_current_user_from_header, CurrentUser


router = APIRouter(prefix="/projects", tags=["projects"])


def _db_to_pydantic(db_project, dataset=None, fields=None, endpoints=None) -> Project:
    """Convert a database Project to a Pydantic Project for API responses."""
    dataset_data = None
    if dataset:
        fields_data = []
        for f in (fields or []):
            fields_data.append({
                "name": f.name,
                "type": f.field_type,
                "required": f.required,
                "description": f.description,
            })
        dataset_data = {
            "id": dataset.id,
            "name": dataset.name,
            "source_type": dataset.source_type,
            "fields": fields_data,
            "created_at": db_project.created_at,
        }

    endpoints_data = []
    for ep in (endpoints or []):
        endpoints_data.append({
            "id": ep.id,
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
        })

    return Project(
        id=db_project.id,
        name=db_project.name,
        description=db_project.description,
        target_stack=db_project.target_stack,
        dataset=dataset_data,
        endpoints=endpoints_data,
        status=db_project.status,
        created_at=db_project.created_at,
        updated_at=db_project.updated_at,
    )


@router.get("", response_model=list[Project])
def list_projects(session: Session = Depends(get_session)) -> list[Project]:
    db_projects = project_service.list_projects(session)
    result = []
    for p in db_projects:
        data = project_service.get_project_with_data(session, p.id)
        result.append(_db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        ))
    return result


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> Project:
    db_project = project_service.create_project(
        session,
        name=payload.name,
        description=payload.description,
        target_stack=payload.target_stack,
    )
    return _db_to_pydantic(db_project)


@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: UUID,
    session: Session = Depends(get_session),
) -> Project:
    try:
        data = project_service.get_project_with_data(session, project_id)
        return _db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    project_service.delete_project(session, project_id)


@router.post(
    "/{project_id}/dataset",
    response_model=Project,
)
def upload_dataset(
    project_id: UUID,
    payload: UploadDatasetRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> Project:
    try:
        fields_data = [f.model_dump() for f in payload.fields]
        db_project = project_service.attach_dataset(
            session,
            project_id=project_id,
            name=payload.name,
            source_type=payload.source_type,
            fields=fields_data,
        )
        data = project_service.get_project_with_data(session, project_id)
        return _db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{project_id}/endpoints",
    response_model=Project,
)
def define_endpoints(
    project_id: UUID,
    payload: DefineEndpointsRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> Project:
    try:
        endpoints_data = [ep.model_dump() for ep in payload.endpoints]
        project_service.define_endpoints(
            session,
            project_id=project_id,
            endpoints=endpoints_data,
        )
        data = project_service.get_project_with_data(session, project_id)
        return _db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{project_id}/generate",
    response_model=GenerationResult,
)
def generate_artifacts(
    project_id: UUID,
    payload: GenerationRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> GenerationResult:
    try:
        return run_generation(session, project_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/openapi.json", name="project_openapi")
def project_openapi(
    project_id: UUID,
    session: Session = Depends(get_session),
) -> dict:
    try:
        db_project = project_service.get_project(session, project_id)
        pydantic_project = _db_to_pydantic(db_project)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return build_openapi_document(pydantic_project)


@router.get("/{project_id}/docs", response_class=HTMLResponse)
def project_docs(
    request: Request,
    project_id: UUID,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    try:
        db_project = project_service.get_project(session, project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    spec_url = f"/projects/{project_id}/openapi.json"
    return get_redoc_html(openapi_url=spec_url, title=f"Documentación · {db_project.name}")


@router.get("/{project_id}/download")
def download_bundle(
    project_id: UUID,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> FileResponse:
    """Download the generated code bundle (zip file)."""
    from pathlib import Path

    artifacts_root = Path("artifacts") / str(project_id)
    bundle_path = artifacts_root / "fastapi-bundle.zip"
    if not bundle_path.exists():
        raise HTTPException(status_code=404, detail="Bundle not found. Generate artifacts first.")
    return FileResponse(
        str(bundle_path),
        media_type="application/zip",
        filename=f"{project_id}-bundle.zip",
    )
