# API Maker

Plataforma que permite definir datasets, endpoints y generar APIs listas para desplegar en distintos stacks (FastAPI, Express, Nest). El repositorio incluye el backend en FastAPI, un frontend React/Vite y espacio para el generador de artefactos.

## Estructura

- `backend/`: servicio FastAPI con endpoints para proyectos, datasets y generación.
- `frontend/`: interfaz React que permite diseñar la API visualmente.
- `generator/`: espacio reservado para plantillas y scripts de scaffolding.
- `infra/`: definiciones de infraestructura/IaC.
- `docs/`: documentación funcional y técnica.

## Puesta en marcha

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[dev]
export APIMAKER_BUILDER_TOKEN="mi_token_super_seguro"  # opcional, pero recomendado
uvicorn app.main:app --reload
```

*Si defines `APIMAKER_BUILDER_TOKEN`, todas las operaciones de escritura del backend requerirán el encabezado `X-API-Key` con ese valor; las rutas públicas (/projects, /openapi.json, /docs) siguen siendo de solo lectura.*

### Frontend

```bash
cd frontend
npm install
npm run dev -- --open
```

## Características recientes

- Persistencia local de proyectos (`backend/app/data/projects.json`).
- Documentación autónoma por proyecto en `/projects/{id}/docs` (Redoc) alimentada por `/projects/{id}/openapi.json`.
- Seguridad opcional por API key para crear/modificar/borrar proyectos.

## Próximos pasos sugeridos

1. Exponer estos endpoints desde el frontend (fetch/React Query o Zustand + fetch nativo).
2. Extender la persistencia hacia una base de datos real (PostgreSQL/SQLite) conservando la exportación en JSON.
3. Implementar el generador real (plantillas Jinja + empaquetado Docker/CI).
4. Añadir autenticación multiusuario y control de espacios de trabajo para instalaciones compartidas.
