"""Pydantic models shared across routers."""

from __future__ import annotations

from datetime import datetime, timezone
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateMappingRuleRequest(BaseModel):
    source_dataset_id: str
    source_field_id: str
    target_dataset_id: str
    target_field_id: str
    transformation: str | None = None


class DatasetMeta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    source_type: Literal["upload", "manual", "database"] = "manual"
    fields: list[FieldSchema] = Field(default_factory=list)
    sample_rows: list[dict] = Field(default_factory=list)
    saved_requests: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApiEndpoint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    path: str
    summary: str | None = None
    operation_type: Literal["list", "get", "create", "update", "delete", "list_related", "custom"] = "custom"
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



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


class GenerationJobResponse(BaseModel):
    id: str
    project_id: str
    status: str
    result: GenerationResult | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
    errors: list[dict] | None = None


# ── Database Connection Schemas ──

class DbConnectionCreate(BaseModel):
    name: str
    db_type: str = "postgresql"
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    database: str | None = None
    ssl_mode: str | None = None


class DbConnectionUpdate(BaseModel):
    name: str | None = None
    db_type: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    database: str | None = None
    ssl_mode: str | None = None


class DbConnectionResponse(BaseModel):
    id: str
    name: str
    db_type: str
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database: str | None = None
    ssl_mode: str | None = None
    created_at: datetime
    updated_at: datetime


class TableInfo(BaseModel):
    name: str
    kind: str | None = None
    column_count: int | None = None
    row_count: int | None = None


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool = True
    is_primary_key: bool = False
    default: str | None = None
    foreign_key: str | None = None


class TableSchema(BaseModel):
    table: str
    columns: list[ColumnInfo]


class TablePreview(BaseModel):
    table: str
    columns: list[str]
    rows: list[dict]


class ImportTableRequest(BaseModel):
    table_name: str
    dataset_name: str | None = None
    sample_limit: int = Field(default=25, ge=0, le=200)
    create_endpoints: bool = True


class ImportTableResult(BaseModel):
    dataset_id: str
    dataset_name: str
    table: str
    fields_imported: int
    sample_rows: int
    endpoints_created: list[dict[str, str]]


class QueryRequest(BaseModel):
    sql: str


class TestConnectionResult(BaseModel):
    success: bool
    message: str
    server_version: str | None = None
