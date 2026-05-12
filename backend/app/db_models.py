"""SQLModel database models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    """Application user with JWT authentication."""

    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    username: str = Field(unique=True, index=True)
    email: Optional[str] = Field(default=None)
    password_hash: str  # bcrypt hash
    role: str = "user"  # admin | user
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Workspace(SQLModel, table=True):
    """Workspace for organizing projects (multi-tenancy)."""

    __tablename__ = "workspaces"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    owner_id: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WorkspaceMember(SQLModel, table=True):
    """Users belonging to a workspace."""

    __tablename__ = "workspace_members"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    user_id: str = Field(foreign_key="users.id")
    role: str = "member"  # owner | admin | member
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DatasetField(SQLModel, table=True):
    """Individual field within a dataset."""

    __tablename__ = "dataset_fields"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    dataset_id: Optional[str] = Field(default=None, foreign_key="datasets.id")
    name: str
    field_type: str
    required: bool = True
    description: Optional[str] = None
    is_primary_key: bool = False
    default_value: Optional[str] = None
    faker_category: Optional[str] = None
    enum_values: Optional[str] = None  # JSON array of allowed values
    references: Optional[str] = None  # JSON: {"datasetId": "id", "fieldName": "name"}


class FieldMappingRule(SQLModel, table=True):
    """Mapping rule between a source field and a target field across datasets."""

    __tablename__ = "field_mapping_rules"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    source_dataset_id: str = Field(foreign_key="datasets.id")
    source_field_id: str = Field(foreign_key="dataset_fields.id")
    target_dataset_id: str = Field(foreign_key="datasets.id")
    target_field_id: str = Field(foreign_key="dataset_fields.id")
    transformation: Optional[str] = None  # JSON: {"type": "direct|cast|concat|format|expression", "config": {}}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Dataset(SQLModel, table=True):
    """Dataset attached to a project."""

    __tablename__ = "datasets"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    name: str
    source_type: str = "manual"
    sample_rows: Optional[str] = Field(default=None)  # JSON-serialized sample data
    saved_requests: Optional[str] = Field(default=None)  # JSON-serialized list of SavedRequest objects


class Endpoint(SQLModel, table=True):
    """API endpoint definition."""

    __tablename__ = "endpoints"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    name: str
    method: str = "GET"
    path: str
    summary: Optional[str] = None
    operation_type: str = "custom"
    target_dataset_id: Optional[str] = Field(default=None, foreign_key="datasets.id")


class Project(SQLModel, table=True):
    """Main project model."""

    __tablename__ = "projects"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    slug: Optional[str] = Field(default=None, index=True, unique=True)
    description: Optional[str] = None
    auth_method: str = "none" # none | apikey | jwt
    api_key: Optional[str] = None
    jwt_secret: Optional[str] = None
    rate_limit: Optional[int] = None
    status: str = Field(default="draft")
    target_stack: str = Field(default="fastapi")
    include_data: bool = Field(default=True)
    workspace_id: str | None = Field(default=None, foreign_key="workspaces.id")
    created_by: Optional[str] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShareSnapshot(SQLModel, table=True):
    """Shareable read-only snapshot of a project."""

    __tablename__ = "share_snapshots"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    slug: str = Field(unique=True, index=True)
    snapshot_data: str  # JSON-serialized project snapshot
    password_hash: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    views_count: int = Field(default=0)


class Webhook(SQLModel, table=True):
    """Webhook configuration for a project."""

    __tablename__ = "webhooks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    url: str
    events: str  # JSON array: ["create", "update", "delete"]
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MockRecord(SQLModel, table=True):
    """Persistent mock data records for the mock server."""

    __tablename__ = "mock_records"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    dataset_id: str = Field(foreign_key="datasets.id", index=True)
    record_id: str = Field(default_factory=lambda: str(uuid4())[:8])
    data: str  # JSON-serialized record data
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectVersion(SQLModel, table=True):
    """Snapshot of a project at a point in time."""

    __tablename__ = "project_versions"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    version: int
    message: str = ""
    snapshot_data: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
