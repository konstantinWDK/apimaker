"""Routes related to project and API generation lifecycle."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Dataset, DatasetField, Endpoint, FieldMappingRule, Project as DBProject, WorkspaceMember
from ..models import (
    UpdateProjectRequest,
    CreateProjectRequest,
    DefineEndpointsRequest,
    GenerationRequest,
    GenerationResult,
    Project as PydanticProject,
    UploadDatasetRequest,
    MappingRule as PydanticMappingRule,
    CreateMappingRuleRequest,
)
from ..security import CurrentUser, get_current_user_from_header, require_project_access
from ..openapi_builder import build_openapi_document
from ..services.generation import run_generation
from ..services.project_service import project_service


router = APIRouter(prefix="/projects", tags=["projects"])

def _db_to_pydantic(db_project, datasets_with_fields=None, endpoints=None, include_secrets: bool = False) -> PydanticProject:
    """Convert a database Project to a Pydantic Project for API responses."""
    import json
    datasets_data = []
    for entry in (datasets_with_fields or []):
        ds = entry["dataset"]
        fields = entry["fields"]
        
        fields_data = []
        for f in fields:
            refs = f.references
            if refs:
                import json as _json
                try:
                    refs = _json.loads(refs)
                except Exception:
                    refs = None
            enum_vals = f.enum_values
            if enum_vals:
                import json as _json
                try:
                    enum_vals = _json.loads(enum_vals)
                except Exception:
                    enum_vals = None
            fields_data.append({
                "name": f.name,
                "type": f.field_type,
                "required": f.required,
                "description": f.description,
                "is_primary_key": f.is_primary_key,
                "default_value": f.default_value,
                "faker_category": f.faker_category,
                "enum_values": enum_vals,
                "references": refs,
            })
            
        try:
            sample_rows = json.loads(ds.sample_rows) if ds.sample_rows else []
        except Exception:
            sample_rows = []

        try:
            saved_requests = json.loads(ds.saved_requests) if ds.saved_requests else []
        except Exception:
            saved_requests = []

        datasets_data.append({
            "id": ds.id,
            "name": ds.name,
            "source_type": ds.source_type,
            "fields": fields_data,
            "sample_rows": sample_rows,
            "saved_requests": saved_requests,
            "created_at": ds.created_at if hasattr(ds, 'created_at') else db_project.created_at,
        })

    endpoints_data = []
    for ep in (endpoints or []):
        endpoints_data.append({
            "id": ep.id,
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
            "operation_type": ep.operation_type,
            "target_dataset_id": ep.target_dataset_id,
        })
    return PydanticProject(
        id=str(db_project.id),
        name=db_project.name,
        slug=db_project.slug,
        description=db_project.description,
        auth_method=db_project.auth_method,
        api_key=db_project.api_key if include_secrets else None,
        jwt_secret=db_project.jwt_secret if include_secrets else None,
        rate_limit=db_project.rate_limit,
        target_stack=db_project.target_stack,
        datasets=datasets_data,
        endpoints=endpoints_data,
        status=db_project.status,
        created_at=db_project.created_at,
        updated_at=db_project.updated_at,
    )


@router.get("", response_model=list[PydanticProject])
def list_projects(
    workspace_id: str | None = None,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> list[PydanticProject]:
    db_projects = project_service.list_projects(session, workspace_id=workspace_id, user_id=user.user_id)
    result = []
    for p in db_projects:
        data = project_service.get_project_with_data(session, p.id)
        result.append(_db_to_pydantic(
            data["project"],
            datasets_with_fields=data["datasets"],
            endpoints=data["endpoints"],
            include_secrets=True,
        ))
    return result


@router.post("", response_model=PydanticProject, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: CreateProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> PydanticProject:
    if payload.workspace_id and user.role != "admin":
        membership = session.exec(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == payload.workspace_id,
                WorkspaceMember.user_id == user.user_id,
            )
        ).first()
        if membership is None:
            raise HTTPException(status_code=403, detail="Not allowed to create projects in this workspace")
    db_project = project_service.create_project(
        session,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        target_stack=payload.target_stack,
        workspace_id=payload.workspace_id,
        created_by=user.user_id,
        auth_method=payload.auth_method,
        api_key=payload.api_key,
        jwt_secret=payload.jwt_secret,
        rate_limit=payload.rate_limit,
        include_data=payload.include_data,
    )
    # Handle initial datasets if provided
    if payload.datasets:
        for ds in payload.datasets:
            try:
                fields_data = [f.model_dump() for f in ds.fields]
                project_service.attach_dataset(
                    session,
                    project_id=db_project.id,
                    name=ds.name,
                    source_type=ds.source_type,
                    fields=fields_data,
                    sample_rows=ds.sample_rows,
                    dataset_id=str(ds.id)
                )
            except Exception as e:
                import logging
                logging.error(f"Failed to attach dataset '{ds.name}': {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error al adjuntar dataset '{ds.name}': {str(e)}"
                )

    data = project_service.get_project_with_data(session, db_project.id)
    return _db_to_pydantic(
        data["project"],
        datasets_with_fields=data["datasets"],
        endpoints=data["endpoints"],
        include_secrets=True,
    )


@router.get("/{project_id}", response_model=PydanticProject)
def get_project(
    project_id: str,
    session: Session = Depends(get_session),
    _project: DBProject = Depends(require_project_access),
) -> PydanticProject:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        data = project_service.get_project_with_data(session, resolved_id)
        return _db_to_pydantic(
            data["project"],
            datasets_with_fields=data["datasets"],
            endpoints=data["endpoints"],
            include_secrets=True,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{project_id}", response_model=PydanticProject)
def update_project(
    project_id: str,
    payload: UpdateProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
            auth_method=payload.auth_method,
            api_key=payload.api_key,
            jwt_secret=payload.jwt_secret,
            rate_limit=payload.rate_limit,
            include_data=payload.include_data,
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
            datasets_with_fields=data["datasets"],
            endpoints=data["endpoints"],
            include_secrets=True,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_project(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
            sample_rows=payload.sample_rows,
            saved_requests=payload.saved_requests,
            dataset_id=payload.id
        )
        
        # Update mock data in-memory if already running
        from ..services.mock_server import get_mock_status_fn, start_mock_server_fn
        status = get_mock_status_fn(str(resolved_id))
        if status["status"] == "running":
            start_mock_server_fn(session, str(resolved_id))

        data = project_service.get_project_with_data(session, resolved_id)
        return _db_to_pydantic(
            data["project"],
            datasets_with_fields=data["datasets"],
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
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
            datasets_with_fields=data["datasets"],
            endpoints=data["endpoints"],
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ─── Mapping rules ──────────────────────────────────────────────

def _mapping_to_dict(m: FieldMappingRule) -> dict:
    trans = m.transformation
    if trans:
        import json as _json
        try:
            trans = _json.loads(trans)
        except Exception:
            pass
    return {
        "id": m.id,
        "project_id": m.project_id,
        "source_dataset_id": m.source_dataset_id,
        "source_field_id": m.source_field_id,
        "target_dataset_id": m.target_dataset_id,
        "target_field_id": m.target_field_id,
        "transformation": trans,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/{project_id}/mappings", response_model=list[PydanticMappingRule])
def list_mappings(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> list[PydanticMappingRule]:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        mappings = project_service.list_mappings(session, resolved_id)
        return [_mapping_to_dict(m) for m in mappings]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{project_id}/mappings", response_model=PydanticMappingRule, status_code=status.HTTP_201_CREATED)
def create_mapping(
    project_id: str,
    payload: CreateMappingRuleRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> PydanticMappingRule:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        trans = payload.transformation
        if trans and isinstance(trans, dict):
            import json as _json
            trans = _json.dumps(trans)
        mapping = project_service.create_mapping(
            session,
            project_id=resolved_id,
            source_dataset_id=payload.source_dataset_id,
            source_field_id=payload.source_field_id,
            target_dataset_id=payload.target_dataset_id,
            target_field_id=payload.target_field_id,
            transformation=trans,
        )
        return _mapping_to_dict(mapping)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{project_id}/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_mapping(
    project_id: str,
    mapping_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> None:
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        project_service.delete_mapping(session, mapping_id)
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
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
        data = project_service.get_project_with_data(session, resolved_id)
        pydantic_project = _db_to_pydantic(
            data["project"],
            datasets_with_fields=data["datasets"],
            endpoints=data["endpoints"],
        )
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
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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


@router.get("/{project_id}/export")
def export_project(
    project_id: str,
    include_secrets: bool = False,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
) -> dict:
    """Export full project as JSON (project + datasets + endpoints)."""
    try:
        resolved_id = project_service.resolve_id(session, project_id)
        data = project_service.get_project_with_data(session, resolved_id)
        db_project = data["project"]
        datasets = data["datasets"]
        endpoints = data["endpoints"]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    import json
    datasets_data = []
    for entry in datasets:
        ds = entry["dataset"]
        fields = entry["fields"]
        try:
            sample_rows = json.loads(ds.sample_rows) if ds.sample_rows else []
        except Exception:
            sample_rows = []
        datasets_data.append({
            "id": ds.id,
            "name": ds.name,
            "source_type": ds.source_type,
            "fields": [{"name": f.name, "type": f.field_type, "required": f.required, "description": f.description} for f in fields],
            "sample_rows": sample_rows,
        })

    endpoints_data = [{
        "id": ep.id,
        "name": ep.name,
        "method": ep.method,
        "path": ep.path,
        "summary": ep.summary,
        "operation_type": ep.operation_type,
        "target_dataset_id": ep.target_dataset_id,
    } for ep in endpoints]

    return {
        "project": {
            "name": db_project.name,
            "slug": db_project.slug,
            "description": db_project.description,
            "auth_method": db_project.auth_method,
            "api_key": db_project.api_key if include_secrets and user.role == "admin" else None,
            "jwt_secret": db_project.jwt_secret if include_secrets and user.role == "admin" else None,
            "rate_limit": db_project.rate_limit,
            "target_stack": db_project.target_stack,
            "include_data": db_project.include_data,
        },
        "datasets": datasets_data,
        "endpoints": endpoints_data,
        "version": "1",
    }


class ImportProjectRequest(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    auth_method: str = "none"
    api_key: str | None = None
    jwt_secret: str | None = None
    rate_limit: int | None = None
    target_stack: str = "fastapi"
    include_data: bool = True
    datasets: list[dict] = []
    endpoints: list[dict] = []


@router.post("/import", response_model=PydanticProject, status_code=201)
def import_project(
    payload: ImportProjectRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> PydanticProject:
    """Import a project from JSON (created via export)."""
    db_project = project_service.create_project(
        session,
        name=payload.name or "Imported Project",
        slug=payload.slug,
        description=payload.description,
        target_stack=payload.target_stack,
        created_by=user.user_id,
        auth_method=payload.auth_method,
        api_key=payload.api_key,
        jwt_secret=payload.jwt_secret,
        rate_limit=payload.rate_limit,
        include_data=payload.include_data,
    )

    for ds_data in payload.datasets:
        fields_data = ds_data.get("fields", [])
        project_service.attach_dataset(
            session,
            project_id=db_project.id,
            name=ds_data.get("name", "Dataset"),
            source_type=ds_data.get("source_type", "manual"),
            fields=fields_data,
            sample_rows=ds_data.get("sample_rows", []),
        )

    if payload.endpoints:
        project_service.define_endpoints(
            session,
            project_id=db_project.id,
            endpoints=payload.endpoints,
        )

    data = project_service.get_project_with_data(session, db_project.id)
    return _db_to_pydantic(
        data["project"],
        datasets_with_fields=data["datasets"],
        endpoints=data["endpoints"],
        include_secrets=True,
    )
