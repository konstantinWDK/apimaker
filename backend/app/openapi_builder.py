"""Utility to transform Project definitions into OpenAPI documents."""

from __future__ import annotations

import re

from .models import FieldType, Project


FIELD_TYPE_MAP: dict[FieldType, dict[str, str]] = {
    FieldType.STRING: {"type": "string"},
    FieldType.INTEGER: {"type": "integer"},
    FieldType.FLOAT: {"type": "number", "format": "float"},
    FieldType.BOOLEAN: {"type": "boolean"},
    FieldType.DATETIME: {"type": "string", "format": "date-time"},
}


def _get_attr(item, name: str, default=None):
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def _operation_id(method: str, path: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9]+", "_", f"{method}_{path.strip('/')}").strip("_").lower()
    return token or f"{method}_root"


def _path_parameters(path: str) -> list[dict[str, object]]:
    return [
        {
            "name": name,
            "in": "path",
            "required": True,
            "schema": {"type": "string"},
            "description": f"{name} identifier",
        }
        for name in re.findall(r"{([^}]+)}", path)
    ]


def _query_parameters(op_type: str, fields: list) -> list[dict[str, object]]:
    if op_type not in {"list", "list_related"}:
        return []
    parameters: list[dict[str, object]] = [
        {
            "name": "page",
            "in": "query",
            "required": False,
            "schema": {"type": "integer", "minimum": 1, "default": 1},
            "description": "Page number, starting at 1.",
        },
        {
            "name": "limit",
            "in": "query",
            "required": False,
            "schema": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100},
            "description": "Maximum records per page.",
        },
        {
            "name": "include",
            "in": "query",
            "required": False,
            "schema": {"type": "string"},
            "description": "Comma-separated relations to include.",
        },
    ]
    for field in fields:
        name = _get_attr(field, "name")
        if not name:
            continue
        ftype = _get_attr(field, "type")
        schema = FIELD_TYPE_MAP.get(ftype, {"type": "string"}).copy()
        parameters.append(
            {
                "name": name,
                "in": "query",
                "required": False,
                "schema": schema,
                "description": _get_attr(field, "description") or f"Filter by {name}.",
            }
        )
    return parameters


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


def _paginated_schema(component_ref: dict) -> dict:
    return {
        "type": "object",
        "properties": {
            "data": {"type": "array", "items": component_ref},
            "total": {"type": "integer"},
            "page": {"type": "integer"},
            "pages": {"type": "integer"},
        },
        "required": ["data", "total", "page", "pages"],
    }


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
    dataset_fields_by_name: dict[str, list] = {}
    dataset_name = "items"
    
    if hasattr(project, 'datasets') and project.datasets:
        for ds in project.datasets:
            ds_name = ds.name if hasattr(ds, 'name') else ds.get('name')
            ds_fields = ds.fields if hasattr(ds, 'fields') else ds.get('fields')
            if ds_fields:
                schema = _dataset_schema(ds_fields)
                if schema:
                    schemas[ds_name] = schema
                    dataset_fields_by_name[ds_name] = ds_fields
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
        content_schema = _paginated_schema(component_ref) if is_list else component_ref
        fields = dataset_fields_by_name.get(ref_name, [])
        success_status = "201" if method == "post" else "204" if method == "delete" else "200"
        responses: dict[str, object] = {
            success_status: {
                "description": endpoint.summary or "Successful response",
            }
        }
        if success_status != "204":
            responses[success_status]["content"] = {"application/json": {"schema": content_schema}}  # type: ignore[index]
        if op_type in {"get", "update", "delete"} or "{" in endpoint.path:
            responses["404"] = {
                "description": "Resource not found",
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
            }
        if method in {"post", "put", "patch"}:
            responses["422"] = {
                "description": "Validation error",
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
            }

        operation = {
            "summary": endpoint.summary or endpoint.name,
            "operationId": _operation_id(method, endpoint.path),
            "tags": [ref_name.capitalize()],
            "parameters": _path_parameters(endpoint.path) + _query_parameters(op_type, fields),
            "responses": responses,
        }
        if op_type:
            operation["description"] = f"Generated {op_type.replace('_', ' ')} endpoint for {ref_name}."
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

    schemas["Error"] = {
        "type": "object",
        "properties": {
            "detail": {"type": "string"},
            "error_code": {"type": "string"},
        },
        "required": ["detail"],
    }
    components: dict[str, object] = {"schemas": schemas}
    if security_schemes:
        components["securitySchemes"] = security_schemes  # type: ignore

    document: dict[str, object] = {
        "openapi": "3.1.0",
        "info": {
            "title": project.name,
            "description": project.description or "Generated with DoApi",
            "version": project.updated_at.isoformat() if project.updated_at else "1.0.0",
        },
        "paths": paths or {"/": {"get": {"responses": {"200": {"description": "OK"}}}}},
        "components": components,
        "servers": [{"url": "http://localhost"}],
    }
    if security_global:
        document["security"] = security_global

    return document
