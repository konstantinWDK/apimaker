"""Pydantic models shared across routers."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class FieldType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATETIME = "datetime"


class FieldSchema(BaseModel):
    name: str
    type: FieldType = Field(default=FieldType.STRING)
    required: bool = True
    description: str | None = None
    is_primary_key: bool = False
    default_value: str | None = None
    faker_category: str | None = None
    enum_values: str | None = None  # JSON array of allowed values
    references: str | None = None  # JSON: {"datasetId": "id", "fieldName": "name"}


class MappingRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str | None = None
    source_dataset_id: str
    source_field_id: str
    target_dataset_id: str
    target_field_id: str
    transformation: str | None = None  # JSON: {"type": "direct|cast|concat|format|expression", "config": {}}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateMappingRuleRequest(BaseModel):
    source_dataset_id: str
    source_field_id: str
    target_dataset_id: str
    target_field_id: str
    transformation: str | None = None


class DatasetMeta(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    source_type: Literal["upload", "manual", "database"] = "manual"
    fields: list[FieldSchema] = Field(default_factory=list)
    sample_rows: list[dict] = Field(default_factory=list)
    saved_requests: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ApiEndpoint(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    path: str
    summary: str | None = None
    operation_type: Literal["list", "get", "create", "update", "delete", "custom"] = "custom"
    target_dataset_id: str | None = None


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    READY = "ready"
    BUILDING = "building"


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    slug: str | None = None
    description: str | None = None
    auth_method: Literal["none", "apikey", "jwt"] = "none"
    api_key: str | None = None
    jwt_secret: str | None = None
    rate_limit: int | None = None
    target_stack: Literal["fastapi", "express", "nest"] = "fastapi"
    include_data: bool = True
    datasets: list[DatasetMeta] = Field(default_factory=list)
    endpoints: list[ApiEndpoint] = Field(default_factory=list)
    status: ProjectStatus = ProjectStatus.DRAFT
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)



class CreateProjectRequest(BaseModel):
    name: str
    slug: str | None = None
    description: str | None = None
    auth_method: Literal["none", "apikey", "jwt"] = "none"
    api_key: str | None = None
    jwt_secret: str | None = None
    rate_limit: int | None = None
    target_stack: Literal["fastapi", "express", "nest"] = "fastapi"
    include_data: bool = True
    workspace_id: str | None = None
    datasets: list[DatasetMeta] = Field(default_factory=list)


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    auth_method: str | None = None
    api_key: str | None = None
    jwt_secret: str | None = None
    rate_limit: int | None = None
    target_stack: str | None = None
    include_data: bool | None = None
    status: str | None = None


class UploadDatasetRequest(BaseModel):
    id: str | None = None
    name: str
    source_type: Literal["upload", "manual", "database"] = "manual"
    fields: list[FieldSchema]
    sample_rows: list[dict] | None = None
    saved_requests: list[dict] | None = None


class DefineEndpointsRequest(BaseModel):
    endpoints: list[ApiEndpoint]


class GenerationRequest(BaseModel):
    include_mock_server: bool = True
    include_sdk: bool = True
    include_data: bool = True


class GenerationResult(BaseModel):
    project_id: str
    openapi_path: str
    bundle_path: str
    sdk_paths: list[str]


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
    errors: list[dict] | None = None
