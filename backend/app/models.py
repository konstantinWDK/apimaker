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
    source_type: Literal["upload", "manual"] = "manual"
    fields: list[FieldSchema] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ApiEndpoint(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    path: str
    summary: str | None = None


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    READY = "ready"
    BUILDING = "building"


class Project(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: str | None = None
    target_stack: Literal["fastapi", "express", "nest"] = "fastapi"
    dataset: DatasetMeta | None = None
    endpoints: list[ApiEndpoint] = Field(default_factory=list)
    status: ProjectStatus = ProjectStatus.DRAFT
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None
    target_stack: Literal["fastapi", "express", "nest"] = "fastapi"


class UploadDatasetRequest(BaseModel):
    name: str
    source_type: Literal["upload", "manual"] = "manual"
    fields: list[FieldSchema]


class DefineEndpointsRequest(BaseModel):
    endpoints: list[ApiEndpoint]


class GenerationRequest(BaseModel):
    include_mock_server: bool = True
    include_sdk: bool = True


class GenerationResult(BaseModel):
    project_id: UUID
    openapi_path: str
    bundle_path: str
    sdk_paths: list[str]
