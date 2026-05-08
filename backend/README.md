# API Maker Backend

Servicio FastAPI que centraliza la definición de proyectos, datasets y generación de artefactos para APIs creadas desde el generador.

## Requisitos

- Python 3.11+
- `uv` o `pip`

## Instalación rápida

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

Tests:

```bash
pytest
```
