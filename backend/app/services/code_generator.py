"""Code generator service — renders Jinja2 templates and produces zip bundles."""

from __future__ import annotations

import zipfile
from functools import lru_cache
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


@lru_cache(maxsize=8)
def _get_template_env(template_dir: str, include_route_filters: bool = False) -> Environment:
    env = Environment(
        loader=FileSystemLoader(template_dir),
        autoescape=select_autoescape(),
    )
    env.filters["capitalize"] = lambda s: s.capitalize() if s else ""
    env.filters["lower"] = lambda s: s.lower() if s else ""
    env.filters["replace"] = lambda s, old, new: s.replace(old, new) if s else ""
    if include_route_filters:
        env.filters["extract_path_param"] = _extract_path_param
        env.filters["js_bool"] = lambda v: "true" if v else "false"
    return env


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
    import json
    
    # Build a name lookup for datasets (id -> name) to resolve FK references
    dataset_name_map = {}
    for entry in datasets_with_fields:
        ds = entry["dataset"]
        dataset_name_map[ds.id] = ds.name
    
    # First pass: collect all field references
    field_references = {}  # child_dataset_id -> [(child_field_name, ref_dataset_id, ref_field_name)]
    for entry in datasets_with_fields:
        ds = entry["dataset"]
        fields = entry["fields"]
        for f in fields:
            ref_raw = f.references
            ref_parsed = None
            if ref_raw:
                try:
                    ref_parsed = json.loads(ref_raw) if isinstance(ref_raw, str) else ref_raw
                except Exception:
                    pass
            if ref_parsed:
                ref_ds_id = ref_parsed.get("datasetId")
                ref_field = ref_parsed.get("fieldName", "id")
                if ref_ds_id and ref_ds_id in dataset_name_map:
                    field_references.setdefault(ds.id, []).append(
                        (f.name, ref_ds_id, ref_field)
                    )
    
    # Build reverse references: for each dataset, which child datasets reference it
    reverse_refs = {}  # ref_dataset_id -> [(child_ds_name, child_field_name)]
    for child_id, refs in field_references.items():
        child_name = dataset_name_map.get(child_id)
        if not child_name:
            continue
        for (field_name, ref_ds_id, ref_field) in refs:
            reverse_refs.setdefault(ref_ds_id, []).append({
                "dataset_name": child_name,
                "field_name": field_name,
            })
    
    processed_datasets = []
    for entry in datasets_with_fields:
        ds = entry["dataset"]
        fields = entry["fields"]
        
        ds_fields = []
        for f in fields:
            ref_raw = f.references
            ref_parsed = None
            if ref_raw:
                try:
                    ref_parsed = json.loads(ref_raw) if isinstance(ref_raw, str) else ref_raw
                except Exception:
                    pass
            
            resolved_ref = None
            if ref_parsed:
                ref_ds_id = ref_parsed.get("datasetId")
                ref_field_name = ref_parsed.get("fieldName", "id")
                ref_ds_name = dataset_name_map.get(ref_ds_id) if ref_ds_id else None
                if ref_ds_name:
                    resolved_ref = {
                        "dataset_id": ref_ds_id,
                        "dataset_name": ref_ds_name,
                        "field_name": ref_field_name,
                    }
            
            ds_fields.append({
                "name": f.name,
                "type": f.field_type,
                "python_type": _get_python_type(f.field_type),
                "required": f.required,
                "description": f.description,
                "references": resolved_ref,
            })
        
        ds_ctx = {
            "id": ds.id,
            "name": ds.name,
            "fields": ds_fields,
            "sample_rows": [],
            "referenced_by": reverse_refs.get(ds.id, []),
            "filterable_fields": [f["name"] for f in ds_fields],
        }
        
        if ds.sample_rows:
            try:
                ds_ctx["sample_rows"] = json.loads(ds.sample_rows) if isinstance(ds.sample_rows, str) else ds.sample_rows
            except:
                ds_ctx["sample_rows"] = []
        
        processed_datasets.append(ds_ctx)

    # Build dataset lookup by ID so endpoints can reference their target dataset directly
    dataset_lookup = {d["id"]: d for d in processed_datasets}

    endpoints_context = [
        {
            "id": ep.id,
            "name": ep.name,
            "method": ep.method,
            "path": ep.path,
            "summary": ep.summary,
            "operation_type": ep.operation_type or "custom",
            "target_dataset_id": ep.target_dataset_id,
            "target_dataset": dataset_lookup.get(ep.target_dataset_id),
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

    env = _get_template_env(str(stack_dir), include_route_filters=True)

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
                ("ci.yml.j2", ".github/workflows/ci.yml"),
            ]
        elif stack == "express":
            files_to_render = [
                ("app.js.j2", "app.js"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("docker-compose.yml.j2", "docker-compose.yml"),
                ("setup.sh.j2", "setup.sh"),
                ("env.example.j2", ".env.example"),
                ("ci.yml.j2", ".github/workflows/ci.yml"),
            ]
        elif stack == "nest":
            files_to_render = [
                ("src/main.ts.j2", "src/main.ts"),
                ("src/app.controller.ts.j2", "src/app.controller.ts"),
                ("src/app.module.ts.j2", "src/app.module.ts"),
                ("tsconfig.json.j2", "tsconfig.json"),
                ("package.json.j2", "package.json"),
                ("Dockerfile.j2", "Dockerfile"),
                ("docker-compose.yml.j2", "docker-compose.yml"),
                ("setup.sh.j2", "setup.sh"),
                ("env.example.j2", ".env.example"),
                ("ci.yml.j2", ".github/workflows/ci.yml"),
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
            seed_data: dict[str, list[dict]] = {}
            for d in context["datasets"]:
                if not d["sample_rows"]:
                    continue
                normalized: list[dict] = []
                for row in d["sample_rows"]:
                    item = dict(row)
                    for k, v in item.items():
                        if isinstance(v, str) and v.lower() in ("true", "false"):
                            item[k] = v.lower() == "true"
                    normalized.append(item)
                seed_data[d["name"]] = normalized
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
        elif stack == "express":
            zf.writestr(
                "tests/test_main.js",
                'const request = require("supertest");\n'
                'const app = require("../app");\n\n'
                'describe("Health", () => {\n'
                '  it("should return 200", async () => {\n'
                '    const res = await request(app).get("/health");\n'
                "    expect(res.status).toBe(200);\n"
                '    expect(res.body.status).toBe("ok");\n'
                "  });\n"
                "});\n",
            )
            zf.writestr(
                "jest.config.js",
                "module.exports = { testEnvironment: 'node' };\n",
            )
        
        # README
        if project_description:
            readme_content = f"#  {project_name}\n\n"
        else:
            readme_content = f"# {project_name}\n\n"
        readme_content += f"{project_description or 'API generated with DoApi.'}\n\n"
        readme_content += "This project contains a complete professional API, ready to be deployed to production.\n\n"
        
        readme_content += "##  Quick Start\n\n"
        readme_content += "The easiest way to set up and run the API is using the interactive installer:\n\n"
        readme_content += "```bash\n"
        readme_content += "chmod +x setup.sh && ./setup.sh\n"
        readme_content += "```\n\n"
        readme_content += "This script will configure the environment, environment variables (`.env`), and let you choose between local execution or Docker.\n\n"

        readme_content += "##  Docker Deployment\n\n"
        readme_content += "If you prefer to use Docker directly:\n\n"
        readme_content += "```bash\n"
        readme_content += "docker-compose up -d --build\n"
        readme_content += "```\n"
        readme_content += "The API will be available at `http://localhost:8000`.\n\n"

        readme_content += "##  Interactive Documentation\n\n"
        readme_content += "Once the API is running, you can access the full documentation for all your resources at:\n"
        readme_content += "- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)\n"
        readme_content += "- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)\n\n"

        readme_content += "##  Project Structure\n\n"
        readme_content += f"- Stack: **{context['target_stack'].upper()}**\n"
        readme_content += "- Database: SQLite (development) / PostgreSQL (production via Docker)\n"
        readme_content += f"- Authentication: {context['auth_method']}\n"
        readme_content += "- Included Datasets: " + ", ".join([ds['name'] for ds in context['datasets']]) + "\n\n"

        readme_content += "##  Manual Installation\n\n"
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
            readme_content += "\n##  Initial Data (Seeds)\n"
            readme_content += "This project includes a `data.json` file. The API will import this data automatically on first startup if the database is empty.\n"

        readme_content += "\n##  Cloud Deployment\n\n"
        readme_content += "### Railway\n"
        readme_content += "```bash\n"
        readme_content += "# Install Railway CLI and run:\nrailway login\nrailway up\n```\n"
        readme_content += "Railway automatically detects the Dockerfile included in the project.\n\n"
        readme_content += "### Render\n"
        readme_content += "1. Push this repository to GitHub\n"
        readme_content += "2. Connect your repo at https://render.com\n"
        readme_content += "3. Render will use the `deploy/render.yaml` file to configure the service automatically.\n\n"
        readme_content += "### Docker Compose (self-hosted)\n"
        readme_content += "```bash\n"
        readme_content += "docker compose up -d --build\n"
        readme_content += "```\n"

        readme_content += "\n---\n*Generated with  by DoApi*"
        
        zf.writestr("README.md", readme_content)

        # Add deployment configs
        deploy_dir = TEMPLATE_DIR / "deploy"
        if deploy_dir.exists():
            try:
                deploy_env = _get_template_env(str(deploy_dir))
                for tpl in deploy_env.list_templates():
                    target = tpl.replace(".j2", "")
                    content = deploy_env.get_template(tpl).render(context)
                    zf.writestr(f"deploy/{target}", content)
            except Exception:
                pass

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

        # Render TypeScript SDK
        try:
            ts_env = _get_template_env(str(TEMPLATE_DIR / "sdk"))

            ts_context = _build_context(
                project.name, project.description, project.auth_method,
                project.api_key, project.jwt_secret, project.rate_limit,
                datasets_with_fields, endpoints, project.target_stack or "fastapi",
                project.include_data if hasattr(project, "include_data") else True,
            )
            ts_code = ts_env.get_template("typescript.ts.j2").render(ts_context)
            ts_path = sdk_dir / "api-client.ts"
            ts_path.write_text(ts_code)
            sdk_paths.append(str(ts_path))
        except Exception as e:
            import logging
            logging.warning(f"TypeScript SDK generation failed: {e}")

        # Render Python SDK
        try:
            py_env = _get_template_env(str(TEMPLATE_DIR / "sdk"))

            py_context = _build_context(
                project.name, project.description, project.auth_method,
                project.api_key, project.jwt_secret, project.rate_limit,
                datasets_with_fields, endpoints, project.target_stack or "fastapi",
                project.include_data if hasattr(project, "include_data") else True,
            )
            py_code = py_env.get_template("python.py.j2").render(py_context)
            py_path = sdk_dir / "api_client.py"
            py_path.write_text(py_code)
            sdk_paths.append(str(py_path))
        except Exception as e:
            import logging
            logging.warning(f"Python SDK generation failed: {e}")

    project_service.mark_status(session, project_id, "ready")

    return GenerationResult(
        project_id=project.id,
        openapi_path=str(openapi_path),
        bundle_path=str(bundle_path),
        sdk_paths=sdk_paths,
    )
