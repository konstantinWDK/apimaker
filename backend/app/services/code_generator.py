"""Code generator service — renders Jinja2 templates and produces zip bundles."""

from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..config import get_settings
from ..db_models import Dataset, DatasetField, Endpoint
from ..models import GenerationRequest, GenerationResult
from .project_service import project_service


TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "generator" / "templates"

FIELD_TYPE_MAP = {
    "string": "str",
    "integer": "int",
    "float": "float",
    "boolean": "bool",
    "datetime": "datetime",
}


def _get_python_type(field_type: str) -> str:
    return FIELD_TYPE_MAP.get(field_type, "str")


def _extract_path_param(path: str) -> str:
    """Extract path param name from a route like /items/{id}."""
    if "{" in path:
        return path.split("{")[1].split("}")[0]
    return "item_id"


def _build_context(
    project_name: str,
    project_description: str | None,
    dataset: Dataset | None,
    fields: list[DatasetField],
    endpoints: list[Endpoint],
) -> dict:
    """Build the Jinja2 template context."""
    dataset_context = None
    if dataset:
        dataset_context = {
            "name": dataset.name,
            "fields": [
                {
                    "name": f.name,
                    "type": f.field_type,
                    "python_type": _get_python_type(f.field_type),
                    "required": f.required,
                    "description": f.description,
                }
                for f in fields
            ],
            "sample_rows": dataset.sample_rows if isinstance(dataset.sample_rows, list) else [],
        }
        # Handle case where sample_rows might be a JSON string in DB
        if isinstance(dataset.sample_rows, str):
            import json
            try:
                dataset_context["sample_rows"] = json.loads(dataset.sample_rows)
            except:
                dataset_context["sample_rows"] = []

    endpoints_context = [
        {
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
        }
        for ep in endpoints
    ]

    return {
        "project_name": project_name,
        "project_description": project_description or "",
        "dataset": dataset_context,
        "endpoints": endpoints_context,
    }


def render_bundle(
    stack: str,
    project_name: str,
    project_description: str | None,
    dataset: Dataset | None,
    fields: list[DatasetField],
    endpoints: list[Endpoint],
) -> bytes:
    """Render a project bundle as zip bytes based on the selected stack."""
    stack_dir = TEMPLATE_DIR / stack
    if not stack_dir.exists():
        # Fallback to fastapi if stack doesn't exist
        stack = "fastapi"
        stack_dir = TEMPLATE_DIR / stack

    env = Environment(
        loader=FileSystemLoader(str(stack_dir)),
        autoescape=select_autoescape(),
    )
    env.filters["capitalize"] = lambda s: s.capitalize() if s else ""
    env.filters["lower"] = lambda s: s.lower() if s else ""
    env.filters["replace"] = lambda s, old, new: s.replace(old, new) if s else ""
    env.filters["extract_path_param"] = _extract_path_param

    context = _build_context(project_name, project_description, dataset, fields, endpoints)

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Determine files to render based on stack
        files_to_render = []
        if stack == "fastapi":
            files_to_render = [
                ("main.py.j2", "main.py"),
                ("requirements.txt.j2", "requirements.txt"),
                ("Dockerfile.j2", "Dockerfile"),
                ("env.example.j2", ".env.example"),
            ]
        elif stack == "express":
            files_to_render = [
                ("app.js.j2", "app.js"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("env.example.j2", ".env.example"),
            ]
        elif stack == "nest":
            files_to_render = [
                ("src/main.ts.j2", "src/main.ts"),
                ("src/app.controller.ts.j2", "src/app.controller.ts"),
                ("src/app.module.ts.j2", "src/app.module.ts"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("env.example.j2", ".env.example"),
            ]

        for tpl_name, target_name in files_to_render:
            try:
                tpl = env.get_template(tpl_name)
                zf.writestr(target_name, tpl.render(**context))
            except Exception:
                # Skip if template not found
                pass

        # Add data.json if we have sample rows
        if context["dataset"] and context["dataset"]["sample_rows"]:
            import json
            zf.writestr("data.json", json.dumps(context["dataset"]["sample_rows"], indent=2, ensure_ascii=False))

        # Add common files
        if stack == "fastapi":
            zf.writestr("tests/__init__.py", "")
            zf.writestr(
                "tests/test_main.py",
                f'"""Tests for {project_name}."""\n'
                "from fastapi.testclient import TestClient\n"
                "from main import app\n\n"
                "client = TestClient(app)\n\n"
                "def test_health():\n"
                '    response = client.get("/health")\n'
                "    assert response.status_code == 200\n"
                '    assert response.json()["status"] == "ok"\n',
            )
        
        # README
        readme_content = f"# {project_name}\n\nAuto-generated by API Maker ({stack}).\n\n"
        if project_description:
            readme_content += f"{project_description}\n\n"
        
        if context["dataset"] and context["dataset"]["sample_rows"]:
            readme_content += "## Initial Data\n\nEste bundle incluye un archivo `data.json` con los datos cargados en el builder. La API los importará automáticamente en el primer arranque si la base de datos está vacía.\n\n"

        readme_content += "## Quick Start\n\n"
        if stack == "fastapi":
            readme_content += (
                "```bash\n"
                "# 1. Instalar dependencias\n"
                "pip install -r requirements.txt\n\n"
                "# 2. Configurar entorno (opcional)\n"
                "cp .env.example .env\n\n"
                "# 3. Ejecutar\n"
                "uvicorn main:app --reload\n"
                "```\n\n"
                "La API estará disponible en `http://localhost:8000`. Visita `/docs` para la documentación interactiva.\n"
            )
        elif stack == "express":
            readme_content += (
                "```bash\n"
                "# 1. Instalar dependencias\n"
                "npm install\n\n"
                "# 2. Ejecutar\n"
                "npm start\n"
                "```\n\n"
                "La API estará disponible en `http://localhost:8000`.\n"
            )
        elif stack == "nest":
            readme_content += (
                "```bash\n"
                "# 1. Instalar dependencias\n"
                "npm install\n\n"
                "# 2. Ejecutar en modo desarrollo\n"
                "npm run start:dev\n"
                "```\n\n"
                "La API estará disponible en `http://localhost:8000`.\n"
            )
        
        readme_content += "\n## Docker\n\n```bash\ndocker build -t api-generated .\ndocker run -p 8000:8000 api-generated\n```\n"
        
        zf.writestr("README.md", readme_content)

    buf.seek(0)
    return buf.getvalue()


def run_generation(
    session, project_id, payload: GenerationRequest
) -> GenerationResult:
    """Generate code bundle for a project."""
    from sqlmodel import select

    project_service.mark_status(session, project_id, "building")

    # Get project data
    data = project_service.get_project_with_data(session, project_id)
    project = data["project"]
    dataset = data["dataset"]
    fields = data["fields"]
    endpoints = data["endpoints"]

    # If no endpoints defined, create a default one
    if not endpoints:
        from ..db_models import Endpoint as DBEndpoint
        session.add(DBEndpoint(
            project_id=str(project.id),
            name="Default",
            method="GET",
            path="/records",
            summary="Default endpoint",
        ))
        session.flush()
        endpoints = session.exec(
            select(DBEndpoint).where(DBEndpoint.project_id == str(project.id))
        ).all()

    try:
        # Generate bundle based on target_stack
        zip_bytes = render_bundle(
            project.target_stack or "fastapi",
            project.name,
            project.description,
            dataset,
            fields,
            endpoints,
        )

        # Save to artifacts (use slug for folder name to remove UUID traces)
        settings = get_settings()
        folder_name = project.slug or str(project.id)
        artifacts_root = Path(settings.artifacts_dir) / folder_name
        artifacts_root.mkdir(parents=True, exist_ok=True)

        bundle_path = artifacts_root / f"{project.target_stack}-bundle.zip"
        bundle_path.write_bytes(zip_bytes)

        # Save OpenAPI spec
        from ..openapi_builder import build_openapi_document
        from ..models import Project as PydanticProject

        pydantic_project = PydanticProject(
            id=project.id,
            name=project.name,
            description=project.description,
            target_stack=project.target_stack,
            dataset=None,
            endpoints=[
                {"id": ep.id, "name": ep.name, "method": ep.method, "path": ep.path, "summary": ep.summary}
                for ep in endpoints
            ],
            status=project.status,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
        import json
        openapi_doc = build_openapi_document(pydantic_project)
        openapi_path = artifacts_root / "openapi.json"
        openapi_path.write_text(json.dumps(openapi_doc, indent=2, ensure_ascii=False))
    except Exception:
        project_service.mark_status(session, project_id, "draft")
        raise

    sdk_paths = []
    if payload.include_sdk:
        sdk_dir = artifacts_root / "sdks"
        sdk_dir.mkdir(parents=True, exist_ok=True)
        sdk_paths.append(str(sdk_dir / "typescript"))
        sdk_paths.append(str(sdk_dir / "python"))

    project_service.mark_status(session, project_id, "ready")

    return GenerationResult(
        project_id=project.id,
        openapi_path=str(openapi_path),
        bundle_path=str(bundle_path),
        sdk_paths=sdk_paths,
    )
