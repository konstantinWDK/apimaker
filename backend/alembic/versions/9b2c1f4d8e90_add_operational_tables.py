"""add operational tables

Revision ID: 9b2c1f4d8e90
Revises: c143c46a7732
Create Date: 2026-05-27 13:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision: str = "9b2c1f4d8e90"
down_revision: Union[str, Sequence[str], None] = "c143c46a7732"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    return sa.inspect(bind).has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    return any(column["name"] == column_name for column in sa.inspect(bind).get_columns(table_name))


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    bind = op.get_bind()
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}
    if index_name not in indexes:
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("projects", schema=None) as batch_op:
        for column_name, column in [
            ("auth_method", sa.Column("auth_method", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="none")),
            ("api_key", sa.Column("api_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
            ("jwt_secret", sa.Column("jwt_secret", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
            ("rate_limit", sa.Column("rate_limit", sa.Integer(), nullable=True)),
        ]:
            if not _has_column("projects", column_name):
                batch_op.add_column(column)

    with op.batch_alter_table("datasets", schema=None) as batch_op:
        if not _has_column("datasets", "sample_rows"):
            batch_op.add_column(sa.Column("sample_rows", sqlmodel.sql.sqltypes.AutoString(), nullable=True))

    with op.batch_alter_table("dataset_fields", schema=None) as batch_op:
        for column_name, column in [
            ("is_primary_key", sa.Column("is_primary_key", sa.Boolean(), nullable=False, server_default="0")),
            ("default_value", sa.Column("default_value", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
            ("faker_category", sa.Column("faker_category", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
            ("enum_values", sa.Column("enum_values", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
            ("references", sa.Column("references", sqlmodel.sql.sqltypes.AutoString(), nullable=True)),
        ]:
            if not _has_column("dataset_fields", column_name):
                batch_op.add_column(column)

    with op.batch_alter_table("endpoints", schema=None) as batch_op:
        if not _has_column("endpoints", "operation_type"):
            batch_op.add_column(sa.Column("operation_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default="custom"))

    if not _has_table("field_mapping_rules"):
        op.create_table(
            "field_mapping_rules",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("source_dataset_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("source_field_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("target_dataset_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("target_field_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("transformation", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["source_dataset_id"], ["datasets.id"]),
            sa.ForeignKeyConstraint(["source_field_id"], ["dataset_fields.id"]),
            sa.ForeignKeyConstraint(["target_dataset_id"], ["datasets.id"]),
            sa.ForeignKeyConstraint(["target_field_id"], ["dataset_fields.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_field_mapping_rules_project_id", "field_mapping_rules", ["project_id"])

    if not _has_table("webhooks"):
        op.create_table(
            "webhooks",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("url", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("events", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_webhooks_project_id", "webhooks", ["project_id"])

    if not _has_table("mock_records"):
        op.create_table(
            "mock_records",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("dataset_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("record_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("data", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_mock_records_dataset_id", "mock_records", ["dataset_id"])
    _create_index_if_missing("ix_mock_records_project_id", "mock_records", ["project_id"])

    if not _has_table("db_connections"):
        op.create_table(
            "db_connections",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("db_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("host", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("port", sa.Integer(), nullable=True),
            sa.Column("username", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("password_encrypted", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("database", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("ssl_mode", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_db_connections_project_id", "db_connections", ["project_id"])

    if not _has_table("project_versions"):
        op.create_table(
            "project_versions",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("message", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("snapshot_data", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_project_versions_project_id", "project_versions", ["project_id"])

    if not _has_table("datasources"):
        op.create_table(
            "datasources",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("source_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("connection_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("config", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("schema_snapshot", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["connection_id"], ["db_connections.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_datasources_project_id", "datasources", ["project_id"])

    if not _has_table("saved_queries"):
        op.create_table(
            "saved_queries",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("datasource_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("connection_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("query_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("statement", sa.Text(), nullable=True),
            sa.Column("bindings", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["connection_id"], ["db_connections.id"]),
            sa.ForeignKeyConstraint(["datasource_id"], ["datasources.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_saved_queries_project_id", "saved_queries", ["project_id"])

    if not _has_table("runtime_logs"):
        op.create_table(
            "runtime_logs",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("event_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("method", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("message", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("metadata", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_runtime_logs_event_type", "runtime_logs", ["event_type"])
    _create_index_if_missing("ix_runtime_logs_project_id", "runtime_logs", ["project_id"])

    if not _has_table("project_releases"):
        op.create_table(
            "project_releases",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("message", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("snapshot_data", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_by", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_project_releases_is_active", "project_releases", ["is_active"])
    _create_index_if_missing("ix_project_releases_project_id", "project_releases", ["project_id"])

    if not _has_table("automations"):
        op.create_table(
            "automations",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("trigger_event", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("actions", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_automations_project_id", "automations", ["project_id"])
    _create_index_if_missing("ix_automations_trigger_event", "automations", ["trigger_event"])

    if not _has_table("automation_runs"):
        op.create_table(
            "automation_runs",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("automation_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("input_data", sa.Text(), nullable=True),
            sa.Column("output_data", sa.Text(), nullable=True),
            sa.Column("error", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["automation_id"], ["automations.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_automation_runs_automation_id", "automation_runs", ["automation_id"])
    _create_index_if_missing("ix_automation_runs_project_id", "automation_runs", ["project_id"])

    if not _has_table("webhook_deliveries"):
        op.create_table(
            "webhook_deliveries",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("webhook_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("event", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("request_body", sa.Text(), nullable=True),
            sa.Column("response_body", sa.Text(), nullable=True),
            sa.Column("error", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["webhook_id"], ["webhooks.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_webhook_deliveries_project_id", "webhook_deliveries", ["project_id"])
    _create_index_if_missing("ix_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"])

    if not _has_table("generation_jobs"):
        op.create_table(
            "generation_jobs",
            sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("project_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("result_json", sa.Text(), nullable=True),
            sa.Column("error", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_by", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    _create_index_if_missing("ix_generation_jobs_project_id", "generation_jobs", ["project_id"])
    _create_index_if_missing("ix_generation_jobs_status", "generation_jobs", ["status"])


def downgrade() -> None:
    """Downgrade schema."""
    for table_name in [
        "generation_jobs",
        "webhook_deliveries",
        "automation_runs",
        "automations",
        "project_releases",
        "runtime_logs",
        "saved_queries",
        "datasources",
        "project_versions",
        "db_connections",
        "mock_records",
        "webhooks",
        "field_mapping_rules",
    ]:
        if _has_table(table_name):
            op.drop_table(table_name)
