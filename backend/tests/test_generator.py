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
                type("obj", (object,), {"name": "name", "field_type": "string", "required": True, "description": "Full name"})(),
                type("obj", (object,), {"name": "email", "field_type": "string", "required": True, "description": "Email address"})(),
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
