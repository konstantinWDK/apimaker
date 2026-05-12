"""Utility to transform Project definitions into OpenAPI documents."""

from __future__ import annotations

from datetime import datetime

from .models import FieldType, Project


FIELD_TYPE_MAP: dict[FieldType, dict[str, str]] = {
    FieldType.STRING: {"type": "string"},
    FieldType.INTEGER: {"type": "integer"},
    FieldType.FLOAT: {"type": "number", "format": "float"},
    FieldType.BOOLEAN: {"type": "boolean"},
    FieldType.DATETIME: {"type": "string", "format": "date-time"},
}


def _dataset_schema(fields: list) -> dict | None:
    if not fields:
        return None
    properties: dict[str, dict[str, str]] = {}
    required: list[str] = []
    for field in fields:
        # Support both Pydantic models and plain dicts
        if isinstance(field, dict):
            fname = field.get('name')
            ftype = field.get('type')
            fdesc = field.get('description')
            freq = field.get('required', False)
        else:
            fname = getattr(field, 'name', None)
            ftype = getattr(field, 'type', None)
            fdesc = getattr(field, 'description', None)
            freq = getattr(field, 'required', False)

        if not fname:
            continue

        properties[fname] = FIELD_TYPE_MAP.get(ftype, {"type": "string"}).copy()
        if fdesc:
            properties[fname]["description"] = fdesc
        if freq:
            required.append(fname)
    schema: dict[str, object] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _response_schema(endpoint_method: str, dataset_schema: dict | None) -> dict:
    if not dataset_schema:
        return {"type": "object"}
    if endpoint_method == "GET":
        # Heuristic: treat collection endpoints as arrays when no path params are present
        return dataset_schema
    return dataset_schema


def _wrap_body(method: str, dataset_schema: dict | None) -> dict | None:
    if method in {"POST", "PUT", "PATCH"} and dataset_schema:
        return {
            "required": True,
            "content": {
                "application/json": {
                    "schema": dataset_schema,
                }
            },
        }
    return None


def build_openapi_document(project: Project) -> dict:
    schemas = {}
    dataset_name = "items"
    
    if hasattr(project, 'datasets') and project.datasets:
        for ds in project.datasets:
            ds_name = ds.name if hasattr(ds, 'name') else ds.get('name')
            ds_fields = ds.fields if hasattr(ds, 'fields') else ds.get('fields')
            if ds_fields:
                schema = _dataset_schema(ds_fields)
                if schema:
                    schemas[ds_name] = schema
        # Fallback to the first dataset name
        first = project.datasets[0]
        dataset_name = first.name if hasattr(first, 'name') else first.get('name', 'items')

    paths: dict[str, dict[str, object]] = {}
    for endpoint in project.endpoints:
        method = endpoint.method.lower()
        op_type = getattr(endpoint, "operation_type", "custom")

        # List vs single-item heuristic
        is_list = op_type == "list" or (method == "get" and "{" not in endpoint.path and op_type == "custom")

        # Resolve dataset schema for this endpoint via target_dataset_id
        ref_name = dataset_name
        target_ds_id = getattr(endpoint, "target_dataset_id", None)
        if target_ds_id and hasattr(project, 'datasets'):
            for ds in project.datasets:
                ds_id = ds.id if hasattr(ds, 'id') else ds.get('id')
                ds_n = ds.name if hasattr(ds, 'name') else ds.get('name')
                if ds_id == target_ds_id and ds_n in schemas:
                    ref_name = ds_n
                    break
        elif not target_ds_id and hasattr(project, 'datasets'):
            # Fallback: Try to match dataset by path name (e.g. /pokemon -> Pokemon)
            path_root = endpoint.path.strip('/').split('/')[0].lower()
            for ds in project.datasets:
                ds_n = ds.name if hasattr(ds, 'name') else ds.get('name', '')
                if ds_n.lower() == path_root and ds_n in schemas:
                    ref_name = ds_n
                    break

        component_ref = {"$ref": f"#/components/schemas/{ref_name}"} if ref_name in schemas else {"type": "object"}
        content_schema = {"type": "array", "items": component_ref} if is_list else component_ref

        operation = {
            "summary": endpoint.summary or endpoint.name,
            "tags": [ref_name.capitalize()],
            "responses": {
                "200": {
                    "description": endpoint.summary or "Successful response",
                    "content": {"application/json": {"schema": content_schema}},
                }
            },
        }
        body_schema = schemas.get(ref_name)
        request_body = _wrap_body(endpoint.method, body_schema)
        if request_body:
            operation["requestBody"] = request_body
        paths.setdefault(endpoint.path, {})[method] = operation

    # Build security schemes
    security_schemes: dict[str, object] = {}
    security_global: list[dict[str, list[str]]] | None = None
    auth_method = getattr(project, "auth_method", "none")
    if auth_method == "apikey":
        security_schemes["ApiKeyAuth"] = {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
        }
        security_global = [{"ApiKeyAuth": []}]
    elif auth_method == "jwt":
        security_schemes["BearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
        security_global = [{"BearerAuth": []}]

    components: dict[str, object] = {"schemas": schemas} if schemas else {}
    if security_schemes:
        components["securitySchemes"] = security_schemes  # type: ignore

    document: dict[str, object] = {
        "openapi": "3.1.0",
        "info": {
            "title": project.name,
            "description": project.description or "Generated with API Maker",
            "version": project.updated_at.isoformat() if project.updated_at else "1.0.0",
        },
        "paths": paths or {"/": {"get": {"responses": {"200": {"description": "OK"}}}}},
        "components": components,
        "servers": [{"url": "http://localhost"}],
    }
    if security_global:
        document["security"] = security_global

    return document
