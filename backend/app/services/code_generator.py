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
    auth_method: str,
    api_key: str | None,
    jwt_secret: str | None,
    rate_limit: int | None,
    datasets_with_fields: list[dict],
    endpoints: list[Endpoint],
    target_stack: str = "fastapi",
    include_data: bool = True,
) -> dict:
    """Build the Jinja2 template context."""
    processed_datasets = []
    for entry in datasets_with_fields:
        ds = entry["dataset"]
        fields = entry["fields"]
        
        ds_ctx = {
            "id": ds.id,
            "name": ds.name,
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
            "sample_rows": [],
        }
        
        if ds.sample_rows:
            import json
            try:
                ds_ctx["sample_rows"] = json.loads(ds.sample_rows) if isinstance(ds.sample_rows, str) else ds.sample_rows
            except:
                ds_ctx["sample_rows"] = []
        
        processed_datasets.append(ds_ctx)

    endpoints_context = [
        {
            "id": ep.id,
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
            "operation_type": ep.operation_type or "custom",
            "target_dataset_id": ep.target_dataset_id,
        }
        for ep in endpoints
    ]

    return {
        "project_name": project_name,
        "project_description": project_description or "",
        "auth_method": auth_method,
        "api_key": api_key or "",
        "jwt_secret": jwt_secret or "",
        "rate_limit": rate_limit,
        "target_stack": target_stack,
        "datasets": processed_datasets,
        "endpoints": endpoints_context,
        "include_data": include_data,
    }


def render_bundle(
    stack: str,
    project_name: str,
    project_description: str | None,
    auth_method: str,
    api_key: str | None,
    jwt_secret: str | None,
    rate_limit: int | None,
    datasets_with_fields: list[dict],
    endpoints: list[Endpoint],
    include_data: bool = True,
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

    context = _build_context(
        project_name, project_description, auth_method, api_key, jwt_secret, rate_limit, 
        datasets_with_fields, endpoints, stack, include_data
    )

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Determine files to render based on stack
        files_to_render = []
        if stack == "fastapi":
            files_to_render = [
                ("main.py.j2", "main.py"),
                ("requirements.txt.j2", "requirements.txt"),
                ("Dockerfile.j2", "Dockerfile"),
                ("docker-compose.yml.j2", "docker-compose.yml"),
                ("setup.sh.j2", "setup.sh"),
                ("env.example.j2", ".env.example"),
            ]
        elif stack == "express":
            files_to_render = [
                ("app.js.j2", "app.js"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("docker-compose.yml.j2", "docker-compose.yml"),
                ("setup.sh.j2", "setup.sh"),
                ("env.example.j2", ".env.example"),
            ]
        elif stack == "nest":
            files_to_render = [
                ("src/main.ts.j2", "src/main.ts"),
                ("src/app.controller.ts.j2", "src/app.controller.ts"),
                ("src/app.module.ts.j2", "src/app.module.ts"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("docker-compose.yml.j2", "docker-compose.yml"),
                ("setup.sh.j2", "setup.sh"),
                ("env.example.j2", ".env.example"),
            ]

        for tpl_name, target_name in files_to_render:
            try:
                # Normal files
                if target_name == "setup.sh":
                    # Set executable bit for setup.sh (chmod +x)
                    zfi = zipfile.ZipInfo(target_name)
                    zfi.external_attr = 0o100755 << 16
                    zfi.compress_type = zipfile.ZIP_DEFLATED
                    zf.writestr(zfi, env.get_template(tpl_name).render(context))
                else:
                    zf.writestr(target_name, env.get_template(tpl_name).render(context))
            except Exception:
                # Skip if template not found
                pass

        # Add data.json if requested and we have datasets with sample rows
        if include_data and any(d["sample_rows"] for d in context["datasets"]):
            import json
            seed_data = {d["name"]: d["sample_rows"] for d in context["datasets"] if d["sample_rows"]}
            zf.writestr("data.json", json.dumps(seed_data, indent=2, ensure_ascii=False))

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
        if project_description:
            readme_content = f"# 🚀 {project_name}\n\n"
        else:
            readme_content = f"# {project_name}\n\n"
        readme_content += f"{project_description or 'API generada con API Maker.'}\n\n"
        readme_content += "Este proyecto contiene una API profesional completa, lista para ser desplegada en producción.\n\n"
        
        readme_content += "## ⚡ Arranque Rápido\n\n"
        readme_content += "La forma más sencilla de configurar y levantar la API es usando el instalador interactivo:\n\n"
        readme_content += "```bash\n"
        readme_content += "chmod +x setup.sh && ./setup.sh\n"
        readme_content += "```\n\n"
        readme_content += "Este script configurará el entorno, las variables de entorno (`.env`) y te permitirá elegir entre ejecución local o con Docker.\n\n"

        readme_content += "## 🐳 Despliegue con Docker\n\n"
        readme_content += "Si prefieres usar Docker directamente:\n\n"
        readme_content += "```bash\n"
        readme_content += "docker-compose up -d --build\n"
        readme_content += "```\n"
        readme_content += "La API estará disponible en `http://localhost:8000`.\n\n"

        readme_content += "## 📚 Documentación Interactiva\n\n"
        readme_content += "Una vez levantada la API, puedes acceder a la documentación completa de todos tus recursos en:\n"
        readme_content += "- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)\n"
        readme_content += "- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)\n\n"

        readme_content += "## 🛠️ Estructura del Proyecto\n\n"
        readme_content += f"- Stack: **{context['target_stack'].upper()}**\n"
        readme_content += "- Base de Datos: SQLite (desarrollo) / PostgreSQL (producción vía Docker)\n"
        readme_content += f"- Autenticación: {context['auth_method']}\n"
        readme_content += "- Datasets incluidos: " + ", ".join([ds['name'] for ds in context['datasets']]) + "\n\n"

        readme_content += "## 🛠️ Instalación Manual\n\n"
        if stack == "fastapi":
            readme_content += (
                "```bash\n"
                "# 1. Instalar dependencias\n"
                "pip install -r requirements.txt\n\n"
                "# 2. Ejecutar\n"
                "uvicorn main:app --reload\n"
                "```\n"
            )
        else:
            readme_content += (
                "```bash\n"
                "# 1. Instalar dependencias\n"
                "npm install\n\n"
                "# 2. Ejecutar\n"
                "npm start\n"
                "```\n"
            )

        if context["include_data"] and any(d["sample_rows"] for d in context["datasets"]):
            readme_content += "\n## 📦 Datos Iniciales (Seeds)\n"
            readme_content += "Este proyecto incluye un archivo `data.json`. La API importará estos datos automáticamente en el primer arranque si la base de datos está vacía.\n"

        readme_content += "\n---\n*Generado con ❤️ por API Maker Studio*"
        
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
    datasets_with_fields = data["datasets"]
    endpoints = data["endpoints"]

    datasets_with_fields = data["datasets"]
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
            project.auth_method,
            project.api_key,
            project.jwt_secret,
            project.rate_limit,
            datasets_with_fields,
            endpoints,
            project.include_data if hasattr(project, "include_data") else True,
        )

        # Save to artifacts (use slug for folder name)
        settings = get_settings()
        folder_name = project.slug or str(project.id)
        artifacts_root = Path(settings.artifacts_dir) / folder_name
        artifacts_root.mkdir(parents=True, exist_ok=True)

        bundle_path = artifacts_root / f"{project.target_stack}-bundle.zip"
        bundle_path.write_bytes(zip_bytes)

        # Build datasets list for OpenAPI doc
        import json
        from ..openapi_builder import build_openapi_document
        from ..models import Project as PydanticProject

        pydantic_datasets = []
        for entry in datasets_with_fields:
            ds = entry["dataset"]
            ds_fields = entry["fields"]
            try:
                sample_rows = json.loads(ds.sample_rows) if ds.sample_rows else []
            except Exception:
                sample_rows = []
            pydantic_datasets.append({
                "id": ds.id,
                "name": ds.name,
                "source_type": ds.source_type,
                "fields": [{"name": f.name, "type": f.field_type, "required": f.required, "description": f.description} for f in ds_fields],
                "sample_rows": sample_rows,
            })

        pydantic_project = PydanticProject(
            id=project.id,
            name=project.name,
            description=project.description,
            target_stack=project.target_stack,
            datasets=pydantic_datasets,
            endpoints=[
                {
                    "id": ep.id,
                    "name": ep.name,
                    "method": ep.method,
                    "path": ep.path,
                    "summary": ep.summary,
                    "operation_type": ep.operation_type or "custom",
                    "target_dataset_id": ep.target_dataset_id,
                }
                for ep in endpoints
            ],
            status=project.status,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
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
