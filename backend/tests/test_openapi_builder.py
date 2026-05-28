"""Tests for generated OpenAPI documents."""

from __future__ import annotations

from app.models import ApiEndpoint, DatasetMeta, FieldSchema, Project
from app.openapi_builder import build_openapi_document


def test_openapi_document_describes_crud_operations() -> None:
    dataset = DatasetMeta(
        id="ds-users",
        name="users",
        fields=[
            FieldSchema(name="id", type="integer", required=True, description="User identifier"),
            FieldSchema(name="email", type="string", required=True, description="User email"),
        ],
    )
    project = Project(
        name="Documented API",
        auth_method="apikey",
        datasets=[dataset],
        endpoints=[
            ApiEndpoint(
                name="List users",
                method="GET",
                path="/users",
                summary="List users",
                operation_type="list",
                target_dataset_id="ds-users",
            ),
            ApiEndpoint(
                name="Create user",
                method="POST",
                path="/users",
                summary="Create user",
                operation_type="create",
                target_dataset_id="ds-users",
            ),
            ApiEndpoint(
                name="Delete user",
                method="DELETE",
                path="/users/{id}",
                summary="Delete user",
                operation_type="delete",
                target_dataset_id="ds-users",
            ),
        ],
    )

    document = build_openapi_document(project)
    list_operation = document["paths"]["/users"]["get"]
    create_operation = document["paths"]["/users"]["post"]
    delete_operation = document["paths"]["/users/{id}"]["delete"]

    assert list_operation["operationId"] == "get_users"
    assert {param["name"] for param in list_operation["parameters"]} >= {"page", "limit", "include", "email"}
    assert list_operation["responses"]["200"]["content"]["application/json"]["schema"]["properties"]["data"]["type"] == "array"
    assert create_operation["responses"]["201"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/users"
    assert delete_operation["responses"]["204"]["description"] == "Delete user"
    assert delete_operation["parameters"][0]["name"] == "id"
    assert document["components"]["schemas"]["Error"]["required"] == ["detail"]
    assert document["components"]["securitySchemes"]["ApiKeyAuth"]["name"] == "X-API-Key"
