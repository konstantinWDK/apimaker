"""SQLModel database models."""

from __future__ import annotations

from datetime import datetime
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Workspace(SQLModel, table=True):
    """Workspace for organizing projects (multi-tenancy)."""

    __tablename__ = "workspaces"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    owner_id: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WorkspaceMember(SQLModel, table=True):
    """Users belonging to a workspace."""

    __tablename__ = "workspace_members"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    user_id: str = Field(foreign_key="users.id")
    role: str = "member"  # owner | admin | member
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class DatasetField(SQLModel, table=True):
    """Individual field within a dataset."""

    __tablename__ = "dataset_fields"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    dataset_id: Optional[str] = Field(default=None, foreign_key="datasets.id")
    name: str
    field_type: str
    required: bool = True
    description: Optional[str] = None


class Dataset(SQLModel, table=True):
    """Dataset attached to a project."""

    __tablename__ = "datasets"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    name: str
    source_type: str = "manual"
    sample_rows: Optional[str] = Field(default=None)  # JSON-serialized sample data


class Endpoint(SQLModel, table=True):
    """API endpoint definition."""

    __tablename__ = "endpoints"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: Optional[str] = Field(default=None, foreign_key="projects.id")
    name: str
    method: str = "GET"
    path: str
    summary: Optional[str] = None


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
    target_stack: str = "fastapi"
    status: str = "draft"
    workspace_id: Optional[str] = Field(default=None, foreign_key="workspaces.id")
    created_by: Optional[str] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ShareSnapshot(SQLModel, table=True):
    """Shareable read-only snapshot of a project."""

    __tablename__ = "share_snapshots"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    slug: str = Field(unique=True, index=True)
    snapshot_data: str  # JSON-serialized project snapshot
    password_hash: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    views_count: int = Field(default=0)
