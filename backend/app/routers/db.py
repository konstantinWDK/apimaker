from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional, Dict, Any
import sqlalchemy
from sqlalchemy.engine import make_url
from sqlalchemy.engine import Engine

router = APIRouter(prefix="/db", tags=["Database Introspection"])

@router.post("/test-connection")
async def test_connection(connection_url: str = Body(..., embed=True)):
    """
    Test if we can connect to the provided DB URL.
    Example: postgresql://user:pass@host:port/dbname
    """
    try:
        url = make_url(connection_url)
        engine = sqlalchemy.create_engine(url)
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        return {"ok": True, "message": "Conexión exitosa"}
    except Exception as e:
        return {"ok": False, "message": str(e)}

@router.post("/introspect")
async def introspect_db(connection_url: str = Body(..., embed=True)):
    """
    List tables and their columns from the external database.
    """
    try:
        url = make_url(connection_url)
        engine = sqlalchemy.create_engine(url)
        inspector = sqlalchemy.inspect(engine)
        
        tables = []
        for table_name in inspector.get_table_names():
            columns = []
            for col in inspector.get_columns(table_name):
                # Map SQL types to our frontend types
                sql_type = str(col['type']).lower()
                our_type = 'string'
                if 'int' in sql_type: our_type = 'integer'
                elif 'float' in sql_type or 'decimal' in sql_type: our_type = 'float'
                elif 'bool' in sql_type: our_type = 'boolean'
                elif 'date' in sql_type or 'time' in sql_type: our_type = 'datetime'
                
                columns.append({
                    "name": col['name'],
                    "type": our_type,
                    "required": not col.get('nullable', True),
                    "is_primary": col.get('primary_key', False)
                })
            
            tables.append({
                "name": table_name,
                "columns": columns
            })
            
        return {"ok": True, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
