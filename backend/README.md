# API Maker Backend

Servicio FastAPI que centraliza la definición de proyectos, datasets y generación de artefactos para APIs creadas desde el generador.

## Base de datos

- **Desarrollo**: SQLite (`app/data/apimaker.db`) — auto-creada al iniciar.
- **Producción**: PostgreSQL vía `APIMAKER_DATABASE_URL`.
- **Migraciones**: Alembic (`alembic upgrade head`).

## Requisitos

- Python 3.11+
- `pip` o `uv`

## Instalación rápida

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[dev]

# Crear/migrar la base de datos
alembic upgrade head

# (Opcional) Migrar datos antiguas de JSON → DB
python migrate_json_to_db.py

uvicorn app.main:app --reload
```

Tests:

```bash
pytest
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `APIMAKER_DATABASE_URL` | `sqlite:///app/data/apimaker.db` | URL de la base de datos |
| `APIMAKER_BUILDER_TOKEN` | `None` | API key para operaciones de escritura |
| `APIMAKER_ENVIRONMENT` | `development` | Entorno |
