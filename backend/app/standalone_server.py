"""Standalone API server — deploy a project as a live API without the builder."""

from __future__ import annotations

import json
import logging
import os
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger("apimaker.standalone")


def _ensure_project_in_db(project_data: dict, db_url: str) -> str:
    """Import a project JSON into a database and return the project ID."""
    from sqlmodel import Session, SQLModel, create_engine, select

    # Import models FIRST so SQLModel.metadata knows about them
    from .db_models import Dataset, DatasetField, Endpoint, MockRecord, Project

    engine = create_engine(db_url)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        slug = project_data.get("slug") or project_data["name"].lower().replace(" ", "-")
        existing = session.exec(select(Project).where(Project.slug == slug)).first()
        if existing:
            logger.info("Project '%s' already exists, reusing", slug)
            return existing.id

        project = Project(
            name=project_data["name"],
            slug=slug,
            description=project_data.get("description", ""),
            auth_method=project_data.get("auth_method", "none"),
            target_stack=project_data.get("target_stack", "fastapi"),
            status="ready",
        )
        session.add(project)
        session.flush()
        project_id = project.id

        for ds_data in project_data.get("datasets", []):
            dataset = Dataset(
                project_id=project_id,
                name=ds_data["name"],
                source_type=ds_data.get("source_type", "manual"),
            )
            session.add(dataset)
            session.flush()

            for field in ds_data.get("fields", []):
                session.add(DatasetField(
                    dataset_id=dataset.id,
                    name=field["name"],
                    field_type=field.get("type", "string"),
                    required=field.get("required", True),
                    description=field.get("description"),
                    is_primary_key=field.get("is_primary_key", False),
                    enum_values=json.dumps(field["enum_values"]) if field.get("enum_values") else None,
                ))

            for row in ds_data.get("sample_rows", []):
                record_id = row.pop("_id", uuid.uuid4().hex[:8])
                row["_id"] = record_id
                clean = {k: v for k, v in row.items() if k != "_id"}
                session.add(MockRecord(
                    project_id=project_id,
                    dataset_id=dataset.id,
                    record_id=record_id,
                    data=json.dumps(clean, ensure_ascii=False, default=str),
                ))

        for ep_data in project_data.get("endpoints", []):
            target_ds_id = None
            if project_data.get("datasets"):
                for ds_data in project_data["datasets"]:
                    if ds_data["name"].lower() in ep_data.get("path", "").lower():
                        ds = session.exec(
                            select(Dataset).where(
                                Dataset.project_id == project_id,
                                Dataset.name == ds_data["name"],
                            )
                        ).first()
                        if ds:
                            target_ds_id = ds.id
                            break

            session.add(Endpoint(
                project_id=project_id,
                name=ep_data["name"],
                method=ep_data.get("method", "GET"),
                path=ep_data["path"],
                summary=ep_data.get("summary", ""),
                operation_type=ep_data.get("operation_type", "custom"),
                target_dataset_id=target_ds_id,
            ))

        session.commit()
        logger.info("Project '%s' imported with ID %s", slug, project_id)
        return project_id


def create_app_for_project(
    project_id: str,
    title: str | None = None,
    cors_origins: list[str] | None = None,
) -> FastAPI:
    """Create a standalone FastAPI app that serves a single project's mock API."""
    from .db import engine
    from .services.mock_server import (
        _mock_get_impl as mock_get,
        _resolve_project_id,
        mock_delete,
        mock_post,
        mock_put,
        start_mock_server_fn,
    )
    from sqlmodel import Session

    app = FastAPI(title=title or f"API Maker - {project_id}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def init_data():
        with Session(engine) as session:
            resolved = _resolve_project_id(session, project_id)
            start_mock_server_fn(session, resolved)

    HANDLERS = {
        "GET": mock_get,
        "POST": mock_post,
        "PUT": mock_put,
        "DELETE": mock_delete,
    }

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def handle_all(path: str, request: Request):
        method = request.method.upper()
        handler = HANDLERS.get(method)
        if not handler:
            return JSONResponse(status_code=405, content={"detail": f"Method {method} not allowed"})
        with Session(engine) as session:
            return await handler(project_id, path, request, session)

    @app.get("/health")
    def health():
        return {"status": "ok", "project_id": project_id}

    return app


def serve_project_from_json(
    json_path: str,
    host: str = "0.0.0.0",
    port: int = 8080,
    db_url: str | None = None,
) -> None:
    """Deploy a project from an exported JSON file as a standalone API."""
    import uvicorn

    project_data = json.loads(Path(json_path).read_text(encoding="utf-8"))

    if not db_url:
        db_path = Path(json_path).with_suffix(".db")
        db_url = f"sqlite:///{db_path.resolve()}"

    if "APIMAKER_DATABASE_URL" not in os.environ:
        os.environ["APIMAKER_DATABASE_URL"] = db_url

    pid = _ensure_project_in_db(project_data, db_url)
    app = create_app_for_project(pid, title=project_data.get("name", "API"))

    print(f"\n{'='*50}")
    print(f"   {project_data.get('name', 'API')} corriendo en:")
    print(f"   http://{host}:{port}/api")

    endpoints = project_data.get("endpoints", [])
    print(f"   Endpoints:")
    for ep in endpoints:
        method = ep.get("method", "GET")
        path = ep.get("path", "/")
        print(f"     {method:6s} /api{path}")

    print(f"\n   DB: {db_url}")
    print(f"{'='*50}\n")
    uvicorn.run(app, host=host, port=port)


def serve_project_from_db(
    project_slug: str,
    host: str = "0.0.0.0",
    port: int = 8081,
) -> None:
    """Serve an existing project from the builder's database."""
    import uvicorn
    from sqlmodel import Session, select

    from .db import engine
    from .db_models import Project

    with Session(engine) as session:
        project = session.exec(
            select(Project).where(Project.slug == project_slug)
        ).first()
        if not project:
            print(f" Project '{project_slug}' not found.")
            sys.exit(1)

        app = create_app_for_project(project.id, title=project.name)

        print(f"\n{'='*50}")
        print(f"   '{project.name}' como API independiente")
        print(f"   http://{host}:{port}/api")
        print(f"   Puerto separado del builder (puerto 8000)")
        print(f"{'='*50}\n")

        uvicorn.run(app, host=host, port=port)
