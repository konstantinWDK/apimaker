"""SQLModel database models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text


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
    data: str = Field(sa_column=Column(Text))  # JSON-serialized record data
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DbConnection(SQLModel, table=True):
    """External database connection configuration."""

    __tablename__ = "db_connections"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    name: str
    db_type: str = "postgresql"  # postgresql | mysql | sqlite | mssql
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password_encrypted: str | None = None  # encrypted via cryptography.fernet
    database: str | None = None
    ssl_mode: str | None = None
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


class GenerationJob(SQLModel, table=True):
    """Background code generation job for a project."""

    __tablename__ = "generation_jobs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    status: str = Field(default="pending", index=True)  # pending | running | success | failed
    payload_json: str = Field(default="{}", sa_column=Column(Text))
    result_json: str | None = Field(default=None, sa_column=Column(Text))
    error: str | None = None
    created_by: str | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    finished_at: datetime | None = None


class Datasource(SQLModel, table=True):
    """Unified data source attached to a project."""

    __tablename__ = "datasources"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    name: str
    source_type: str = "manual"  # manual | csv | database | rest
    connection_id: str | None = Field(default=None, foreign_key="db_connections.id")
    config: str | None = None  # JSON config for REST/CSV/manual sources
    schema_snapshot: str | None = None  # JSON introspection result
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SavedQuery(SQLModel, table=True):
    """Reusable query with request parameter bindings."""

    __tablename__ = "saved_queries"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    datasource_id: str | None = Field(default=None, foreign_key="datasources.id")
    connection_id: str | None = Field(default=None, foreign_key="db_connections.id")
    name: str
    query_type: str = "sql"  # sql | rest
    statement: str = Field(sa_column=Column(Text))
    bindings: str | None = None  # JSON mapping for path/query/body/header params
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RuntimeLog(SQLModel, table=True):
    """Runtime event log for mock calls, deploys, webhooks, automations, imports."""

    __tablename__ = "runtime_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    event_type: str = Field(index=True)
    method: str | None = None
    path: str | None = None
    status_code: int | None = None
    duration_ms: int | None = None
    message: str = ""
    metadata_json: str | None = Field(default=None, sa_column=Column("metadata", Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectRelease(SQLModel, table=True):
    """Published immutable project release."""

    __tablename__ = "project_releases"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    version: int
    message: str = ""
    snapshot_data: str = Field(sa_column=Column(Text))
    is_active: bool = Field(default=False, index=True)
    created_by: str | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Automation(SQLModel, table=True):
    """Project automation with a trigger and ordered actions."""

    __tablename__ = "automations"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    name: str
    trigger_event: str = Field(index=True)  # record.created | endpoint.called | manual | cron
    actions: str = Field(default="[]", sa_column=Column(Text))  # JSON action list
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AutomationRun(SQLModel, table=True):
    """Execution log for an automation."""

    __tablename__ = "automation_runs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    automation_id: str = Field(foreign_key="automations.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    status: str = "pending"  # pending | success | failed
    input_data: str | None = Field(default=None, sa_column=Column(Text))
    output_data: str | None = Field(default=None, sa_column=Column(Text))
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WebhookDelivery(SQLModel, table=True):
    """Delivery attempt for a configured webhook."""

    __tablename__ = "webhook_deliveries"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    webhook_id: str = Field(foreign_key="webhooks.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    event: str
    status: str = "pending"  # pending | success | failed
    status_code: int | None = None
    request_body: str | None = Field(default=None, sa_column=Column(Text))
    response_body: str | None = Field(default=None, sa_column=Column(Text))
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Deployment(SQLModel, table=True):
    """Track a deployed instance of a project."""

    __tablename__ = "deployments"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    slug: str = Field(index=True)
    name: str
    url: str | None = None
    port: int | None = None
    stack: str | None = None
    status: str = "unknown"  # running | stopped | unknown | error
    db_type: str = "sqlite"
    db_credentials: str | None = None  # JSON
    auth_method: str = "none"
    endpoints: str | None = None  # JSON list
    host: str | None = None  # for remote deploys
    is_remote: bool = False
    share_token: str | None = Field(default=None, index=True)  # for public share URL
    custom_domain: str | None = None  # e.g. "api.midominio.com"
    ssl_enabled: bool = False
    version_id: str | None = None  # ProjectVersion.id for rollback
    version_number: int | None = None  # Human-readable version number
    deployed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApiAccessLog(SQLModel, table=True):
    """Access log entry for a deployed API."""

    __tablename__ = "api_access_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    deployment_id: str = Field(foreign_key="deployments.id", index=True)
    method: str
    path: str
    status_code: int | None = None
    client_ip: str | None = None
    user_agent: str | None = None
    latency_ms: int | None = None
    request_body: str | None = None
    response_body: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
