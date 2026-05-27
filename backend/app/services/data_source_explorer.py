"""Database datasource inspection and import helpers."""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import sqlalchemy as sa
from sqlalchemy import MetaData, Table, create_engine, inspect, select as sa_select, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, select as sqlmodel_select

from ..db_models import Dataset, Datasource, DbConnection, Endpoint
from ..models import ColumnInfo, FieldType, TableInfo, TableSchema
from ..services.project_service import project_service
from ..services.product_ops import create_runtime_log


class DataSourceExplorer:
    """Inspect external SQL databases and import tables into projects."""

    def __init__(self, url_builder, password_decrypter) -> None:
        self._url_builder = url_builder
        self._password_decrypter = password_decrypter

    def build_engine(self, conn: DbConnection) -> Engine:
        password = self._password_decrypter(conn.password_encrypted) if conn.password_encrypted else None
        return create_engine(self._url_builder(conn, password), pool_pre_ping=True)

    def test_connection(self, conn: DbConnection) -> dict[str, Any]:
        engine = self.build_engine(conn)
        try:
            with engine.connect() as connection:
                if conn.db_type == "sqlite":
                    version = connection.execute(text("select sqlite_version()")).scalar()
                else:
                    version = connection.execute(text("select version()")).scalar()
            return {"success": True, "message": "Connection successful", "server_version": str(version or "")[:100]}
        except Exception as exc:
            return {"success": False, "message": str(exc)[:200], "server_version": None}
        finally:
            engine.dispose()

    def list_tables(self, conn: DbConnection, include_counts: bool = False) -> list[TableInfo]:
        engine = self.build_engine(conn)
        try:
            inspector = inspect(engine)
            tables = [
                self._table_info(engine, inspector, table_name, "table", include_counts)
                for table_name in inspector.get_table_names()
            ]
            views = [
                self._table_info(engine, inspector, view_name, "view", include_counts)
                for view_name in inspector.get_view_names()
            ]
            return tables + views
        finally:
            engine.dispose()

    def get_schema(self, conn: DbConnection, table_name: str) -> TableSchema:
        engine = self.build_engine(conn)
        try:
            inspector = inspect(engine)
            columns = inspector.get_columns(table_name)
            primary_keys = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))
            foreign_keys = inspector.get_foreign_keys(table_name)
            fk_map: dict[str, str] = {}
            for foreign_key in foreign_keys:
                referred_table = foreign_key.get("referred_table")
                for column, referred_column in zip(
                    foreign_key.get("constrained_columns", []),
                    foreign_key.get("referred_columns", []),
                ):
                    fk_map[column] = f"{referred_table}.{referred_column}"

            return TableSchema(
                table=table_name,
                columns=[
                    ColumnInfo(
                        name=column["name"],
                        type=str(column["type"]),
                        nullable=column.get("nullable", True),
                        is_primary_key=column["name"] in primary_keys,
                        default=str(column.get("default", "")) if column.get("default") is not None else None,
                        foreign_key=fk_map.get(column["name"]),
                    )
                    for column in columns
                ],
            )
        finally:
            engine.dispose()

    def preview_table(self, conn: DbConnection, table_name: str, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        engine = self.build_engine(conn)
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        try:
            table = self._autoload_table(engine, table_name)
            with engine.connect() as connection:
                result = connection.execute(sa_select(table).limit(limit).offset(offset))
                rows = [self._json_safe_row(dict(row._mapping)) for row in result]
            return {"table": table_name, "columns": [column.name for column in table.columns], "rows": rows}
        finally:
            engine.dispose()

    def import_table(
        self,
        session: Session,
        project_id: str,
        conn: DbConnection,
        table_name: str,
        dataset_name: str | None = None,
        sample_limit: int = 25,
        create_endpoints: bool = True,
    ) -> dict[str, Any]:
        schema = self.get_schema(conn, table_name)
        preview = self.preview_table(conn, table_name, limit=sample_limit)
        fields = [self._column_to_field(column) for column in schema.columns]
        final_dataset_name = dataset_name or self._title_from_identifier(table_name)

        project_service.attach_dataset(
            session,
            project_id=project_id,
            name=final_dataset_name,
            source_type="database",
            fields=fields,
            sample_rows=preview["rows"],
        )
        dataset = session.exec(
            sqlmodel_select(Dataset).where(Dataset.project_id == project_id, Dataset.name == final_dataset_name)
        ).first()
        if not dataset:
            raise RuntimeError("Imported dataset could not be loaded")

        self._upsert_import_datasource(
            session,
            project_id=project_id,
            conn=conn,
            dataset=dataset,
            table_name=table_name,
            schema=schema,
        )

        created_endpoints = []
        if create_endpoints:
            created_endpoints = self._ensure_crud_endpoints(session, project_id, dataset.id, table_name)

        create_runtime_log(
            session,
            project_id,
            "datasource.table_imported",
            message=table_name,
            metadata={"connection_id": conn.id, "dataset_id": dataset.id, "table": table_name},
        )
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "table": table_name,
            "fields_imported": len(fields),
            "sample_rows": len(preview["rows"]),
            "endpoints_created": created_endpoints,
        }

    def _upsert_import_datasource(
        self,
        session: Session,
        project_id: str,
        conn: DbConnection,
        dataset: Dataset,
        table_name: str,
        schema: TableSchema,
    ) -> None:
        config = {
            "dataset_id": dataset.id,
            "table_name": table_name,
            "database_url_env": self._database_url_env(dataset.name),
        }
        snapshot = {
            "table": table_name,
            "columns": [column.model_dump() for column in schema.columns],
        }
        existing = session.exec(
            sqlmodel_select(Datasource).where(Datasource.project_id == project_id, Datasource.name == dataset.name)
        ).first()
        if existing:
            existing.source_type = "database"
            existing.connection_id = conn.id
            existing.config = json.dumps(config)
            existing.schema_snapshot = json.dumps(snapshot)
            session.add(existing)
        else:
            session.add(
                Datasource(
                    project_id=project_id,
                    name=dataset.name,
                    source_type="database",
                    connection_id=conn.id,
                    config=json.dumps(config),
                    schema_snapshot=json.dumps(snapshot),
                )
            )
        session.commit()

    def _table_info(
        self,
        engine: Engine,
        inspector: sa.Inspector,
        table_name: str,
        kind: str,
        include_counts: bool,
    ) -> TableInfo:
        columns = inspector.get_columns(table_name)
        row_count = None
        if include_counts and kind == "table":
            table = self._autoload_table(engine, table_name)
            with engine.connect() as connection:
                row_count = int(connection.execute(sa_select(sa.func.count()).select_from(table)).scalar() or 0)
        return TableInfo(name=table_name, kind=kind, column_count=len(columns), row_count=row_count)

    def _autoload_table(self, engine: Engine, table_name: str) -> Table:
        metadata = MetaData()
        return Table(table_name, metadata, autoload_with=engine)

    def _column_to_field(self, column: ColumnInfo) -> dict[str, Any]:
        return {
            "name": column.name,
            "type": self._field_type_from_sql(column.type),
            "required": not column.nullable and not column.is_primary_key,
            "description": column.foreign_key,
            "is_primary_key": column.is_primary_key,
            "default_value": column.default,
            "references": self._reference_payload(column.foreign_key),
        }

    def _field_type_from_sql(self, sql_type: str) -> str:
        normalized = sql_type.lower()
        if any(token in normalized for token in ["int", "serial"]):
            return FieldType.INTEGER.value
        if any(token in normalized for token in ["float", "double", "real", "numeric", "decimal"]):
            return FieldType.FLOAT.value
        if any(token in normalized for token in ["bool"]):
            return FieldType.BOOLEAN.value
        if any(token in normalized for token in ["date", "time"]):
            return FieldType.DATETIME.value
        return FieldType.STRING.value

    def _reference_payload(self, foreign_key: str | None) -> str | None:
        if not foreign_key or "." not in foreign_key:
            return None
        table_name, column_name = foreign_key.split(".", 1)
        return json.dumps({"table": table_name, "column": column_name})

    def _ensure_crud_endpoints(
        self,
        session: Session,
        project_id: str,
        dataset_id: str,
        table_name: str,
    ) -> list[dict[str, str]]:
        base_path = "/" + self._slugify(table_name)
        endpoint_specs = [
            ("list", "GET", base_path, f"List {table_name}"),
            ("get", "GET", f"{base_path}/{{id}}", f"Get {table_name} by id"),
            ("create", "POST", base_path, f"Create {table_name}"),
            ("update", "PUT", f"{base_path}/{{id}}", f"Update {table_name}"),
            ("delete", "DELETE", f"{base_path}/{{id}}", f"Delete {table_name}"),
        ]
        created = []
        for operation_type, method, path, summary in endpoint_specs:
            exists = session.exec(
                sqlmodel_select(Endpoint).where(
                    Endpoint.project_id == project_id,
                    Endpoint.method == method,
                    Endpoint.path == path,
                )
            ).first()
            if exists:
                continue
            endpoint = Endpoint(
                project_id=project_id,
                name=summary,
                method=method,
                path=path,
                summary=summary,
                operation_type=operation_type,
                target_dataset_id=dataset_id,
            )
            session.add(endpoint)
            created.append({"method": method, "path": path, "operation_type": operation_type})
        session.commit()
        return created

    def _slugify(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return slug or "items"

    def _database_url_env(self, dataset_name: str) -> str:
        token = re.sub(r"[^A-Z0-9]+", "_", dataset_name.upper()).strip("_")
        return f"{token or 'DATASET'}_DATABASE_URL"

    def _title_from_identifier(self, value: str) -> str:
        return re.sub(r"[_-]+", " ", value).strip().title() or value

    def _json_safe_row(self, row: dict[str, Any]) -> dict[str, Any]:
        return {key: self._json_safe_value(value) for key, value in row.items()}

    def _json_safe_value(self, value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, bytes):
            return value.decode(errors="replace")
        return value
