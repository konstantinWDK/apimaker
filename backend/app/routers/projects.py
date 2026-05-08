"""Routes related to project and API generation lifecycle."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse

from ..models import (
    CreateProjectRequest,
    DefineEndpointsRequest,
    GenerationRequest,
    GenerationResult,
    Project,
    UploadDatasetRequest,
)
from ..openapi_builder import build_openapi_document
from ..services import registry, run_generation
from ..security import require_admin


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[Project])
def list_projects() -> list[Project]:
    return registry.list_projects()


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_project(payload: CreateProjectRequest) -> Project:
    project = Project(**payload.model_dump())
    return registry.create_project(project)


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: UUID) -> Project:
    try:
        return registry.get_project(project_id)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_project(project_id: UUID) -> None:
    registry.delete_project(project_id)


@router.post(
    "/{project_id}/dataset",
    response_model=Project,
    dependencies=[Depends(require_admin)],
)
def upload_dataset(project_id: UUID, payload: UploadDatasetRequest) -> Project:
    try:
        return registry.attach_dataset(project_id, payload)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{project_id}/endpoints",
    response_model=Project,
    dependencies=[Depends(require_admin)],
)
def define_endpoints(project_id: UUID, payload: DefineEndpointsRequest) -> Project:
    try:
        return registry.define_endpoints(project_id, payload)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{project_id}/generate",
    response_model=GenerationResult,
    dependencies=[Depends(require_admin)],
)
def generate_artifacts(project_id: UUID, payload: GenerationRequest) -> GenerationResult:
    try:
        return run_generation(project_id, payload)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/openapi.json")
def project_openapi(project_id: UUID) -> dict:
    try:
        project = registry.get_project(project_id)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return build_openapi_document(project)


@router.get("/{project_id}/docs", response_class=HTMLResponse)
def project_docs(request: Request, project_id: UUID) -> HTMLResponse:
    try:
        project = registry.get_project(project_id)
    except KeyError as exc:  # pragma: no cover - trivial branch
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    spec_url = request.url_for("project_openapi", project_id=str(project_id))
    return get_redoc_html(openapi_url=str(spec_url), title=f"Documentación · {project.name}")
