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


def _dataset_schema(project: Project) -> dict | None:
    dataset = project.dataset
    if not dataset or not dataset.fields:
        return None
    properties: dict[str, dict[str, str]] = {}
    required: list[str] = []
    for field in dataset.fields:
        properties[field.name] = FIELD_TYPE_MAP.get(field.type, {"type": "string"}).copy()
        if field.description:
            properties[field.name]["description"] = field.description
        if field.required:
            required.append(field.name)
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
    dataset_schema = _dataset_schema(project)
    component_schema = None
    dataset_name = project.dataset.name if project.dataset else "items"
    if dataset_schema:
        component_schema = {"$ref": "#/components/schemas/Record"}

    paths: dict[str, dict[str, object]] = {}
    for endpoint in project.endpoints:
        method = endpoint.method.lower()
        op_type = getattr(endpoint, "operation_type", "custom")
        
        # Determine if response is a list or a single item
        is_list = op_type == "list" or (method == "get" and "{" not in endpoint.path and op_type == "custom")
        
        content_schema = component_schema or {"type": "object"}
        response_content = {
            "application/json": {
                "schema": {"type": "array", "items": content_schema}
                if is_list
                else content_schema
            }
        }
        operation = {
            "summary": endpoint.summary or endpoint.name,
            "tags": [dataset_name] if dataset_name else ["default"],
            "responses": {
                "200": {
                    "description": endpoint.summary or "Successful response",
                    "content": response_content,
                }
            },
        }
        request_body = _wrap_body(endpoint.method, component_schema or dataset_schema)
        if request_body:
            operation["requestBody"] = request_body
        paths.setdefault(endpoint.path, {})[method] = operation

    document: dict[str, object] = {
        "openapi": "3.1.0",
        "info": {
            "title": project.name,
            "description": project.description or "Generated with API Maker",
            "version": project.updated_at.isoformat() if project.updated_at else "1.0.0",
        },
        "paths": paths or {"/": {"get": {"responses": {"200": {"description": "OK"}}}}},
        "components": {},
        "servers": [{"url": "http://localhost"}],
    }

    if dataset_schema:
        document["components"] = {"schemas": {"Record": dataset_schema}}

    return document
