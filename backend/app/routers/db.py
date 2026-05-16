from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
import sqlalchemy
from sqlalchemy.engine import make_url
import tempfile
import os

from ..security import CurrentUser, get_current_user_from_header

router = APIRouter(prefix="/db", tags=["Database Introspection"])


def _normalize_url(connection_url: str) -> str:
    """
    Normalise dialect prefixes so SQLAlchemy picks the right driver:
      mysql://   → mysql+pymysql://
      postgres:// → postgresql://   (common alias)
    """
    if connection_url.startswith("mysql://"):
        connection_url = connection_url.replace("mysql://", "mysql+pymysql://", 1)
    elif connection_url.startswith("postgres://"):
        connection_url = connection_url.replace("postgres://", "postgresql://", 1)
    return connection_url


def _map_sql_type(sql_type: str) -> str:
    t = sql_type.lower()
    if "int" in t:
        return "integer"
    if "float" in t or "double" in t or "decimal" in t or "numeric" in t or "real" in t:
        return "float"
    if "bool" in t or "bit" in t:
        return "boolean"
    if "date" in t or "time" in t or "timestamp" in t:
        return "datetime"
    return "string"


@router.post("/test-connection")
async def test_connection(
    connection_url: str = Body(None, embed=True),
    file: UploadFile = File(None),
    dialect: str = Form(None),
    user: CurrentUser = Depends(get_current_user_from_header),
):
    """
    Test if we can connect to the provided DB URL or uploaded SQLite file.
    Supports: postgresql://, mysql://, sqlite:///
    """
    try:
        # Handle uploaded SQLite file
        if file and dialect == 'sqlite':
            content = await file.read()
            with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                url = f"sqlite:///{tmp_path}"
                engine = sqlalchemy.create_engine(url)
                with engine.connect() as conn:
                    conn.execute(sqlalchemy.text("SELECT 1"))
                engine.dispose()
                os.unlink(tmp_path)  # Clean up temp file
                return {"ok": True, "message": "Connection successful"}
            except Exception:
                os.unlink(tmp_path)  # Clean up on error
                raise

        # Handle connection URL
        if not connection_url:
            raise HTTPException(status_code=400, detail="connection_url or file required")

        url = make_url(_normalize_url(connection_url))
        # SQLite doesn't support connect_timeout
        connect_args = {} if url.drivername.startswith("sqlite") else {"connect_timeout": 8}
        engine = sqlalchemy.create_engine(url, connect_args=connect_args)
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        engine.dispose()
        return {"ok": True, "message": "Connection successful"}
    except HTTPException:
        raise
    except Exception as e:
        return {"ok": False, "message": "Could not establish connection. Check the credentials."}


@router.post("/introspect")
async def introspect_db(
    connection_url: str = Body(None, embed=True),
    file: UploadFile = File(None),
    dialect: str = Form(None),
    user: CurrentUser = Depends(get_current_user_from_header),
):
    """
    List tables and their columns from the external database or uploaded SQLite file.
    """
    tmp_path = None
    try:
        # Handle uploaded SQLite file
        if file and dialect == 'sqlite':
            content = await file.read()
            with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            connection_url = f"sqlite:///{tmp_path}"

        if not connection_url:
            raise HTTPException(status_code=400, detail="connection_url or file required")

        url = make_url(_normalize_url(connection_url))
        
        # SQLite doesn't support connect_timeout
        connect_args = {} if url.drivername.startswith("sqlite") else {"connect_timeout": 8}
        engine = sqlalchemy.create_engine(url, connect_args=connect_args)
        inspector = sqlalchemy.inspect(engine)

        tables = []
        for table_name in inspector.get_table_names():
            pk_cols = set(inspector.get_pk_constraint(table_name).get("constrained_columns", []))
            columns = []
            for col in inspector.get_columns(table_name):
                col_name = col["name"]
                columns.append({
                    "name": col_name,
                    "type": _map_sql_type(str(col["type"])),
                    "required": not col.get("nullable", True),
                    "is_primary": col_name in pk_cols,
                })

            tables.append({"name": table_name, "columns": columns})

        engine.dispose()
        
        # Clean up temp file after introspection
        if tmp_path:
            os.unlink(tmp_path)
        
        return {"ok": True, "tables": tables}
    except HTTPException:
        raise
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=400, detail=str(e))
