from fastapi import APIRouter, HTTPException, Body
import sqlalchemy
from sqlalchemy.engine import make_url

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
async def test_connection(connection_url: str = Body(..., embed=True)):
    """
    Test if we can connect to the provided DB URL.
    Supports: postgresql://, mysql://, sqlite:///
    """
    try:
        url = make_url(_normalize_url(connection_url))
        engine = sqlalchemy.create_engine(url, connect_args={"connect_timeout": 8})
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        engine.dispose()
        return {"ok": True, "message": "Conexión exitosa"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.post("/introspect")
async def introspect_db(connection_url: str = Body(..., embed=True)):
    """
    List tables and their columns from the external database.
    """
    try:
        url = make_url(_normalize_url(connection_url))
        engine = sqlalchemy.create_engine(url, connect_args={"connect_timeout": 8})
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
        return {"ok": True, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
