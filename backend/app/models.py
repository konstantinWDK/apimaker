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


class GenerationResult(BaseModel):
    project_id: str
    openapi_path: str
    bundle_path: str
    sdk_paths: list[str]
