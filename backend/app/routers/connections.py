"""Router for external database connection management."""

from __future__ import annotations

import base64
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL
from sqlmodel import Session, select

from ..config import get_settings
from ..db import get_session
from ..db_models import DbConnection
from ..models import (
    ColumnInfo,
    DbConnectionCreate,
    DbConnectionResponse,
    DbConnectionUpdate,
    QueryRequest,
    TableInfo,
    TableSchema,
    TestConnectionResult,
)
from ..security import CurrentUser, get_current_user_from_header, require_connection_access, require_project_access

logger = logging.getLogger("doapi.connections")
router = APIRouter(prefix="/connections", tags=["connections"])

# ── Password encryption ──

def _fernet_key_from_secret(secret: str) -> bytes:
    """Derive a 32-byte Fernet-compatible key from the encryption key."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _encrypt_password(plain: str) -> str:
    from cryptography.fernet import Fernet
    key = _fernet_key_from_secret(get_settings().encryption_key)
    f = Fernet(key)
    return f.encrypt(plain.encode()).decode()


def _decrypt_password(encrypted: str) -> str:
    from cryptography.fernet import Fernet
    key = _fernet_key_from_secret(get_settings().encryption_key)
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()


def _db_connection_to_response(conn: DbConnection) -> DbConnectionResponse:
    return DbConnectionResponse(
        id=conn.id,
        name=conn.name,
        db_type=conn.db_type,
        host=conn.host,
        port=conn.port,
        username=conn.username,
        database=conn.database,
        ssl_mode=conn.ssl_mode,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


def _build_sqlalchemy_url(conn: DbConnection, password: str | None = None) -> str:
    """Build a SQLAlchemy database URL from a DbConnection."""
    db_type = conn.db_type
    if db_type == "sqlite":
        if conn.database:
            return f"sqlite:///{conn.database}"
        return "sqlite://"

    host = conn.host or "localhost"
    port = conn.port or {"postgresql": 5432, "mysql": 3306, "mssql": 1433}.get(db_type, 5432)
    db = conn.database or ""

    if db_type == "postgresql":
        return str(URL.create("postgresql+psycopg2", username=conn.username, password=password or "", host=host, port=port, database=db))
    elif db_type == "mysql":
        return str(URL.create("mysql+pymysql", username=conn.username, password=password or "", host=host, port=port, database=db))
    elif db_type == "mssql":
        return str(URL.create("mssql+pymssql", username=conn.username, password=password or "", host=host, port=port, database=db))
    return str(URL.create("postgresql+psycopg2", username=conn.username, password=password or "", host=host, port=port, database=db))


# ── CRUD Endpoints ──

@router.get("/project/{project_id}", response_model=list[DbConnectionResponse])
def list_connections(project_id: str, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), _project=Depends(require_project_access)):
    connections = session.exec(select(DbConnection).where(DbConnection.project_id == _project.id)).all()
    return [_db_connection_to_response(c) for c in connections]


@router.post("/project/{project_id}", response_model=DbConnectionResponse, status_code=201)
def create_connection(project_id: str, req: DbConnectionCreate, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), _project=Depends(require_project_access)):
    conn = DbConnection(
        project_id=_project.id,
        name=req.name,
        db_type=req.db_type or "postgresql",
        host=req.host,
        port=req.port,
        username=req.username,
        password_encrypted=_encrypt_password(req.password) if req.password else None,
        database=req.database,
        ssl_mode=req.ssl_mode,
    )
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return _db_connection_to_response(conn)


@router.put("/{connection_id}", response_model=DbConnectionResponse)
def update_connection(connection_id: str, req: DbConnectionUpdate, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):
    if req.name is not None:
        conn.name = req.name
    if req.db_type is not None:
        conn.db_type = req.db_type
    if req.host is not None:
        conn.host = req.host
    if req.port is not None:
        conn.port = req.port
    if req.username is not None:
        conn.username = req.username
    if req.password is not None:
        conn.password_encrypted = _encrypt_password(req.password)
    if req.database is not None:
        conn.database = req.database
    if req.ssl_mode is not None:
        conn.ssl_mode = req.ssl_mode
    conn.updated_at = datetime.now(timezone.utc)
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return _db_connection_to_response(conn)


@router.delete("/{connection_id}")
def delete_connection(connection_id: str, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):
    session.delete(conn)
    session.commit()
    return {"ok": True}


# ── Test connection ──

@router.post("/{connection_id}/test", response_model=TestConnectionResult)
def test_connection(connection_id: str, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):

    password = _decrypt_password(conn.password_encrypted) if conn.password_encrypted else None
    url = _build_sqlalchemy_url(conn, password)

    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as c:
            result = c.execute(text("SELECT version()"))
            version = result.scalar() or ""
        engine.dispose()
        return TestConnectionResult(success=True, message="Connection successful", server_version=str(version)[:100])
    except Exception as e:
        return TestConnectionResult(success=False, message=str(e)[:200])


# ── Introspect tables ──

@router.get("/{connection_id}/tables", response_model=list[TableInfo])
def list_tables(connection_id: str, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):

    password = _decrypt_password(conn.password_encrypted) if conn.password_encrypted else None
    url = _build_sqlalchemy_url(conn, password)

    try:
        engine = create_engine(url, pool_pre_ping=True)
        inspector = inspect(engine)
        tables = []
        for tname in inspector.get_table_names():
            tables.append(TableInfo(name=tname))
        for vname in inspector.get_view_names():
            tables.append(TableInfo(name=vname, kind="view"))
        engine.dispose()
        return tables
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al conectar: {str(e)[:200]}")


@router.get("/{connection_id}/tables/{table_name}/schema", response_model=TableSchema)
def get_table_schema(connection_id: str, table_name: str, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):

    password = _decrypt_password(conn.password_encrypted) if conn.password_encrypted else None
    url = _build_sqlalchemy_url(conn, password)

    try:
        engine = create_engine(url, pool_pre_ping=True)
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        pk_cols = {c["name"] for c in inspector.get_pk_constraint(table_name).get("constrained_columns", [])}
        fks = inspector.get_foreign_keys(table_name)

        fk_map: dict[str, str] = {}
        for fk in fks:
            for col, ref_col in zip(fk.get("constrained_columns", []), fk.get("referred_columns", [])):
                fk_map[col] = f"{fk['referred_table']}.{ref_col}"

        col_infos = []
        for col in columns:
            col_infos.append(ColumnInfo(
                name=col["name"],
                type=str(col["type"]),
                nullable=col.get("nullable", True),
                is_primary_key=col["name"] in pk_cols,
                default=str(col.get("default", "")) if col.get("default") is not None else None,
                foreign_key=fk_map.get(col["name"]),
            ))

        engine.dispose()
        return TableSchema(table=table_name, columns=col_infos)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al obtener esquema: {str(e)[:200]}")


# ── Query ──

@router.post("/{connection_id}/query")
def run_query(connection_id: str, req: QueryRequest, session: Session = Depends(get_session), user: CurrentUser = Depends(get_current_user_from_header), conn: DbConnection = Depends(require_connection_access)):

    sql_upper = req.sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Solo queries SELECT estan permitidas")

    password = _decrypt_password(conn.password_encrypted) if conn.password_encrypted else None
    url = _build_sqlalchemy_url(conn, password)

    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as c:
            result = c.execute(text(req.sql))
            rows = [dict(row._mapping) for row in result]
        engine.dispose()
        return {"columns": list(rows[0].keys()) if rows else [], "rows": rows}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)[:300])
