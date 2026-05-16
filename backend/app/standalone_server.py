"""Standalone API server — deploy a project as a live API without the builder."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urljoin

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger("doapi.standalone")


def _ensure_project_in_db(project_data: dict, db_url: str) -> str:
    """Import a project JSON into a database and return the project ID."""
    from sqlmodel import Session, SQLModel, create_engine, select

    # Import models FIRST so SQLModel.metadata knows about them
    from .db_models import Dataset, DatasetField, Endpoint, MockRecord, Project

    engine = create_engine(db_url)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        slug = project_data.get("slug") or project_data["name"].lower().replace(" ", "-")
        project = session.exec(select(Project).where(Project.slug == slug)).first()
        if project:
            logger.info("Project '%s' already exists, applying latest definition", slug)
            project.name = project_data["name"]
            project.description = project_data.get("description", "")
            project.auth_method = project_data.get("auth_method", "none")
            project.api_key = project_data.get("api_key")
            project.jwt_secret = project_data.get("jwt_secret")
            project.rate_limit = project_data.get("rate_limit")
            project.include_data = project_data.get("include_data", True)
            project.target_stack = project_data.get("target_stack", "fastapi")
            project.status = "ready"
            session.add(project)
            project_id = project.id

            for endpoint in session.exec(select(Endpoint).where(Endpoint.project_id == project_id)).all():
                session.delete(endpoint)
            for record in session.exec(select(MockRecord).where(MockRecord.project_id == project_id)).all():
                session.delete(record)
            session.flush()
            for dataset in session.exec(select(Dataset).where(Dataset.project_id == project_id)).all():
                for field in session.exec(select(DatasetField).where(DatasetField.dataset_id == dataset.id)).all():
                    session.delete(field)
                session.flush()
                session.delete(dataset)
            session.flush()
        else:
            project = Project(
                name=project_data["name"],
                slug=slug,
                description=project_data.get("description", ""),
                auth_method=project_data.get("auth_method", "none"),
                api_key=project_data.get("api_key"),
                jwt_secret=project_data.get("jwt_secret"),
                rate_limit=project_data.get("rate_limit"),
                include_data=project_data.get("include_data", True),
                target_stack=project_data.get("target_stack", "fastapi"),
                status="ready",
            )
            session.add(project)
            session.flush()
            project_id = project.id

        for ds_data in project_data.get("datasets", []):
            dataset = Dataset(
                id=ds_data.get("id") or uuid.uuid4().hex,
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

            existing_records = session.exec(
                select(MockRecord).where(MockRecord.project_id == project_id, MockRecord.dataset_id == dataset.id)
            ).first()
            if existing_records:
                continue

            for source_row in ds_data.get("sample_rows", []):
                row = dict(source_row)
                record_id = row.get("_id") or uuid.uuid4().hex[:8]
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
    from .db_models import Project
    from .services.mock_server import (
        _mock_get_impl as mock_get,
        _resolve_project_id,
        mock_delete,
        mock_post,
        mock_put,
        start_mock_server_fn,
    )
    from sqlmodel import Session, select

    # ─── Telemetry ──────────────────────────────────────────────
    TELEMETRY_URL = os.environ.get("TELEMETRY_URL", "")
    TELEMETRY_API_KEY = os.environ.get("TELEMETRY_API_KEY", "")
    _telemetry_queue: list[dict] = []

    def _enqueue_telemetry(method: str, path: str, status_code: int, duration_ms: int):
        if not TELEMETRY_URL:
            return
        _telemetry_queue.append({
            "method": method, "path": path,
            "status_code": status_code, "duration_ms": duration_ms,
        })

    def _flush_telemetry():
        if not TELEMETRY_URL or not _telemetry_queue:
            return
        batch = _telemetry_queue[:]
        _telemetry_queue.clear()
        try:
            payload: dict = {"logs": batch}
            if TELEMETRY_API_KEY:
                payload["api_key"] = TELEMETRY_API_KEY
            else:
                with Session(engine) as s:
                    p = s.get(Project, project_id)
                    if p and p.api_key:
                        payload["api_key"] = p.api_key
            httpx.post(
                urljoin(TELEMETRY_URL.rstrip("/") + "/", "ingest"),
                json=payload, timeout=5,
            )
        except Exception:
            pass

    app = FastAPI(title=title or f"DoApi - {project_id}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Telemetry middleware
    @app.middleware("http")
    async def telemetry_middleware(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = int((time.time() - start) * 1000)
        if request.url.path not in ("/health",):
            _enqueue_telemetry(request.method, request.url.path, response.status_code, duration_ms)
        return response

    @app.on_event("startup")
    def init_data():
        with Session(engine) as session:
            resolved = _resolve_project_id(session, project_id)
            start_mock_server_fn(session, resolved)
        import threading
        if TELEMETRY_URL:
            threading.Thread(target=lambda: None, daemon=True).start()
            def _telemetry_worker():
                while True:
                    time.sleep(30)
                    _flush_telemetry()
            t = threading.Thread(target=_telemetry_worker, daemon=True)
            t.start()

    async def _check_auth(request: Request):
        """Verify auth headers based on the project's configured auth method."""
        with Session(engine) as session:
            resolved = _resolve_project_id(session, project_id)
            project = session.get(Project, resolved)
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            if project.auth_method == "apikey":
                api_key = request.headers.get("X-API-Key")
                if not api_key or api_key != project.api_key:
                    raise HTTPException(status_code=401, detail="Invalid or missing API Key")
            elif project.auth_method == "jwt":
                auth_header = request.headers.get("Authorization")
                if not auth_header or not auth_header.startswith("Bearer "):
                    raise HTTPException(status_code=401, detail="Missing or invalid Bearer Token")
                token = auth_header.split(" ", 1)[1] if " " in auth_header else ""
                if project.jwt_secret:
                    from .services.jwt_service import decode_token
                    try:
                        decode_token(token, secret=project.jwt_secret)
                    except HTTPException:
                        raise
                    except Exception:
                        raise HTTPException(status_code=401, detail="Invalid or expired JWT token")

    HANDLERS = {
        "GET": mock_get,
        "POST": mock_post,
        "PUT": mock_put,
        "DELETE": mock_delete,
    }

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def handle_all(path: str, request: Request):
        await _check_auth(request)
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
        print(f"   '{project.name}' as standalone API")
        print(f"   http://{host}:{port}/api")
        print(f"   Separate port from builder (port 8000)")
        print(f"{'='*50}\n")

        uvicorn.run(app, host=host, port=port)
