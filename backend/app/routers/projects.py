"""Routes related to project and API generation lifecycle."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import FileResponse, HTMLResponse
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Dataset, DatasetField, Endpoint, Project as DBProject
from ..models import (
    UpdateProjectRequest,
    CreateProjectRequest,
    DefineEndpointsRequest,
    GenerationRequest,
    GenerationResult,
    Project as PydanticProject,
    UploadDatasetRequest,
)
from ..openapi_builder import build_openapi_document
from ..services.generation import run_generation
from ..services.project_service import project_service
from ..security import require_admin, get_current_user_from_header, CurrentUser


router = APIRouter(prefix="/projects", tags=["projects"])

def _db_to_pydantic(db_project, dataset=None, fields=None, endpoints=None) -> PydanticProject:
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
        import json
        try:
            sample_rows = json.loads(dataset.sample_rows) if dataset.sample_rows else []
        except Exception:
            sample_rows = []

        dataset_data = {
            "id": dataset.id,
            "name": dataset.name,
            "source_type": dataset.source_type,
            "fields": fields_data,
            "sample_rows": sample_rows,
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

    return PydanticProject(
        id=db_project.id,
        name=db_project.name,
        slug=db_project.slug,
        description=db_project.description,
        target_stack=db_project.target_stack,
        dataset=dataset_data,
        endpoints=endpoints_data,
        status=db_project.status,
        created_at=db_project.created_at,
        updated_at=db_project.updated_at,
    )


@router.get("", response_model=list[PydanticProject])
def list_projects(session: Session = Depends(get_session)) -> list[PydanticProject]:
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


@router.post("", response_model=PydanticProject, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> PydanticProject:
    db_project = project_service.create_project(
        session,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        target_stack=payload.target_stack,
    )
    data = project_service.get_project_with_data(session, db_project.id)
    return _db_to_pydantic(
        data["project"],
        dataset=data["dataset"],
        fields=data["fields"],
        endpoints=data["endpoints"],
    )


@router.get("/{project_id}", response_model=PydanticProject)
def get_project(
    project_id: str,
    session: Session = Depends(get_session),
) -> PydanticProject:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        data = project_service.get_project_with_data(session, resolved_id)
        return _db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{project_id}", response_model=PydanticProject)
def update_project(
    project_id: str,
    payload: UpdateProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> PydanticProject:
    """Update project name, description, or target stack."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        db_project = project_service.update_project(
            session,
            project_id=resolved_id,
            name=payload.name,
            slug=payload.slug,
            description=payload.description,
            target_stack=payload.target_stack,
            status=payload.status,
        )
        
        # FORCED REFRESH of mock data if running
        from ..services.mock_server import get_mock_status_fn, start_mock_server_fn
        try:
            resolved_id = project_service.resolve_id(session, project_id)
            mock_status = get_mock_status_fn(str(resolved_id))
            if mock_status["status"] == "running":
                start_mock_server_fn(session, str(resolved_id))
        except Exception:
            pass
            
        data = project_service.get_project_with_data(session, db_project.id)
        return _db_to_pydantic(
            data["project"],
            dataset=data["dataset"],
            fields=data["fields"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        project_service.delete_project(session, resolved_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/{project_id}/dataset",
    response_model=PydanticProject,
)
def upload_dataset(
    project_id: str,
    payload: UploadDatasetRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> PydanticProject:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        fields_data = [f.model_dump() for f in payload.fields]
        db_project = project_service.attach_dataset(
            session,
            project_id=resolved_id,
            name=payload.name,
            source_type=payload.source_type,
            fields=fields_data,
            sample_rows=payload.sample_rows
        )
        
        # Update mock data in-memory if already running
        from ..services.mock_server import get_mock_status_fn, start_mock_server_fn
        status = get_mock_status_fn(str(resolved_id))
        if status["status"] == "running":
            start_mock_server_fn(session, str(resolved_id))

        data = project_service.get_project_with_data(session, resolved_id)
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
    response_model=PydanticProject,
)
def define_endpoints(
    project_id: str,
    payload: DefineEndpointsRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> PydanticProject:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        endpoints_data = [ep.model_dump() for ep in payload.endpoints]
        project_service.define_endpoints(
            session,
            project_id=resolved_id,
            endpoints=endpoints_data,
        )

        # Update mock data in-memory if already running
        from ..services.mock_server import get_mock_status_fn, start_mock_server_fn
        status = get_mock_status_fn(str(resolved_id))
        if status["status"] == "running":
            start_mock_server_fn(session, str(resolved_id))

        data = project_service.get_project_with_data(session, resolved_id)
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
    project_id: str,
    payload: GenerationRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> GenerationResult:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        return run_generation(session, resolved_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{project_id}/openapi.json", name="project_openapi")
def project_openapi(
    project_id: str,
    session: Session = Depends(get_session),
) -> dict:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        db_project = project_service.get_project(session, resolved_id)
        pydantic_project = _db_to_pydantic(db_project)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return build_openapi_document(pydantic_project)


@router.get("/{project_id}/docs", response_class=HTMLResponse)
def project_docs(
    request: Request,
    project_id: str,
    session: Session = Depends(get_session),
) -> HTMLResponse:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        db_project = project_service.get_project(session, resolved_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    spec_url = f"/projects/{project_id}/openapi.json"
    return get_redoc_html(openapi_url=spec_url, title=f"Documentación · {db_project.name}")


@router.get("/{project_id}/download")
def download_bundle(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> FileResponse:
    """Download the generated code bundle (zip file)."""
    from pathlib import Path
    from ..config import get_settings

    resolved_id = project_service.resolve_id(session, project_id)
    settings = get_settings()
    # USE SLUG FOR THE ARTIFACT FOLDER IF POSSIBLE
    db_project = project_service.get_project(session, resolved_id)
    folder_name = db_project.slug or resolved_id
    artifacts_root = Path(settings.artifacts_dir) / folder_name

    # Get project to determine target stack
    try:
        data = project_service.get_project_with_data(session, resolved_id)
        target_stack = data["project"].target_stack
    except KeyError:
        target_stack = "fastapi"

    bundle_path = artifacts_root / f"{target_stack}-bundle.zip"
    if not bundle_path.exists():
        raise HTTPException(status_code=404, detail="Bundle not found. Generate artifacts first.")
    return FileResponse(
        str(bundle_path),
        media_type="application/zip",
        filename=f"{folder_name}-bundle.zip",
    )
