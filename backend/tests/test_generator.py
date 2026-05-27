"""Tests for code generator templates - verifies all stacks render without errors."""

import json

from app.services.code_generator import render_bundle


def _make_sample_data():
    return [
        {
            "dataset": type("obj", (object,), {
                "id": "ds-1", "name": "Users", "source_type": "manual",
                "sample_rows": json.dumps([{"name": "Alice", "email": "a@test.com"}]),
                "saved_requests": None,
            })(),
            "fields": [
                type("obj", (object,), {"name": "name", "field_type": "string", "required": True, "description": "Full name", "references": None})(),
                type("obj", (object,), {"name": "email", "field_type": "string", "required": True, "description": "Email address", "references": None})(),
            ],
        }
    ]


def _make_endpoints():
    return [
        type("obj", (object,), {
            "id": "ep-1", "name": "List Users", "method": "GET", "path": "/users",
            "summary": "List all users", "operation_type": "list", "target_dataset_id": "ds-1",
        })(),
        type("obj", (object,), {
            "id": "ep-2", "name": "Create User", "method": "POST", "path": "/users",
            "summary": "Create a user", "operation_type": "create", "target_dataset_id": "ds-1",
        })(),
    ]


def test_fastapi_bundle_renders() -> None:
    """FastAPI bundle should render without errors."""
    zip_bytes = render_bundle(
        "fastapi", "TestAPI", "A test API", "none", None, None, 0,
        _make_sample_data(), _make_endpoints(), True,
    )
    assert len(zip_bytes) > 0

    import zipfile
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        assert "main.py" in names
        assert "requirements.txt" in names
        assert "Dockerfile" in names
        assert "data.json" in names
        assert "README.md" in names


def test_express_bundle_renders() -> None:
    """Express bundle should render without errors."""
    zip_bytes = render_bundle(
        "express", "TestAPI", "A test API", "apikey", "test-key-123", None, 10,
        _make_sample_data(), _make_endpoints(), True,
    )
    assert len(zip_bytes) > 0

    import zipfile
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        assert "app.js" in names
        assert "package.json" in names


def test_nestjs_bundle_renders() -> None:
    """NestJS bundle should render without errors."""
    zip_bytes = render_bundle(
        "nest", "TestAPI", "A test API", "jwt", None, "jwt-secret-123", 0,
        _make_sample_data(), _make_endpoints(), True,
    )
    assert len(zip_bytes) > 0

    import zipfile
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        names = zf.namelist()
        assert "src/main.ts" in names
        assert "src/app.controller.ts" in names
        assert "src/app.module.ts" in names
        assert "package.json" in names


def test_bundle_contains_sample_data() -> None:
    """Bundle should include data.json with sample rows."""
    zip_bytes = render_bundle(
        "fastapi", "TestAPI", "A test API", "none", None, None, 0,
        _make_sample_data(), _make_endpoints(), True,
    )
    import zipfile
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        data = json.loads(zf.read("data.json"))
        assert "Users" in data
        assert len(data["Users"]) == 1
        assert data["Users"][0]["name"] == "Alice"


def test_bundle_auth_settings_reflected() -> None:
    """Auth settings should appear in the generated files."""
    zip_bytes = render_bundle(
        "express", "TestAPI", "", "apikey", "my-secret-key", None, 0,
        _make_sample_data(), _make_endpoints(), False,
    )
    import zipfile
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        app_js = zf.read("app.js").decode("utf-8")
        assert "my-secret-key" in app_js
        assert "apikey" in app_js


def test_fastapi_bundle_uses_imported_table_metadata() -> None:
    """Imported DB datasets should render CRUD against their source table."""
    imported_data = [
        {
            "dataset": type("obj", (object,), {
                "id": "ds-orders", "name": "Orders", "source_type": "database",
                "sample_rows": json.dumps([{"id": 1, "total": 19.95}]),
                "saved_requests": None,
            })(),
            "fields": [
                type("obj", (object,), {"name": "id", "field_type": "integer", "required": True, "description": None, "references": None, "is_primary_key": True})(),
                type("obj", (object,), {"name": "total", "field_type": "float", "required": True, "description": None, "references": None, "is_primary_key": False})(),
            ],
        }
    ]
    endpoints = [
        type("obj", (object,), {
            "id": "ep-1", "name": "Get Order", "method": "GET", "path": "/orders/{id}",
            "summary": "Get order", "operation_type": "get", "target_dataset_id": "ds-orders",
        })(),
    ]
    zip_bytes = render_bundle(
        "fastapi", "TestAPI", "A test API", "none", None, None, 0,
        imported_data, endpoints, True,
        {"ds-orders": {"table_name": "orders", "database_url_env": "ORDERS_DATABASE_URL"}},
    )
    import py_compile
    import tempfile
    import zipfile
    from io import BytesIO
    from pathlib import Path

    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        main_py = zf.read("main.py").decode("utf-8")
        env_example = zf.read(".env.example").decode("utf-8")
        assert '__tablename__ = "orders"' in main_py
        assert "ORDERS_DATABASE_URL" in main_py
        assert "OrdersRecord.id == id" in main_py
        assert main_py.count("id: Mapped[int] = mapped_column(primary_key=True") == 1
        assert "ORDERS_DATABASE_URL=sqlite:///./data.db" in env_example
        tmp_file = Path(tempfile.gettempdir()) / "doapi_generated_external_main.py"
        tmp_file.write_text(main_py, encoding="utf-8")
        py_compile.compile(str(tmp_file), doraise=True)


def test_typescript_sdk_renders() -> None:
    """TypeScript SDK template should render without errors."""
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    from pathlib import Path
    sdk_dir = Path(__file__).resolve().parent.parent.parent / "generator" / "templates" / "sdk"
    env = Environment(loader=FileSystemLoader(str(sdk_dir)), autoescape=select_autoescape())
    env.filters["capitalize"] = lambda s: s.capitalize() if s else ""
    env.filters["lower"] = lambda s: s.lower() if s else ""
    env.filters["replace"] = lambda s, old, new: s.replace(old, new) if s else ""
    context = _build_context_for_sdk()
    ts_code = env.get_template("typescript.ts.j2").render(context)
    assert "ApiClient" in ts_code
    assert "export class" in ts_code


def test_python_sdk_renders() -> None:
    """Python SDK template should render without errors."""
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    from pathlib import Path
    sdk_dir = Path(__file__).resolve().parent.parent.parent / "generator" / "templates" / "sdk"
    env = Environment(loader=FileSystemLoader(str(sdk_dir)), autoescape=select_autoescape())
    env.filters["capitalize"] = lambda s: s.capitalize() if s else ""
    env.filters["lower"] = lambda s: s.lower() if s else ""
    env.filters["replace"] = lambda s, old, new: s.replace(old, new) if s else ""
    context = _build_context_for_sdk()
    py_code = env.get_template("python.py.j2").render(context)
    assert "class ApiClient" in py_code
    assert "import requests" in py_code


def _build_context_for_sdk():
    return {
        "project_name": "TestAPI",
        "project_description": "A test",
        "auth_method": "none",
        "api_key": "",
        "jwt_secret": "",
        "rate_limit": 0,
        "target_stack": "fastapi",
        "include_data": True,
        "datasets": [
            {
                "id": "ds-1",
                "name": "Users",
                "fields": [
                    {"name": "name", "type": "string", "python_type": "str", "required": True, "description": ""},
                    {"name": "email", "type": "email", "python_type": "str", "required": True, "description": ""},
                ],
                "sample_rows": [],
            }
        ],
        "endpoints": [
            {
                "id": "ep-1",
                "name": "List Users",
                "method": "GET",
                "path": "/users",
                "summary": "List all users",
                "operation_type": "list",
                "target_dataset_id": "ds-1",
            },
            {
                "id": "ep-2",
                "name": "Create User",
                "method": "POST",
                "path": "/users",
                "summary": "Create a user",
                "operation_type": "create",
                "target_dataset_id": "ds-1",
            },
        ],
    }
