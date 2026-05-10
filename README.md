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

# Opcional: configurar token de administrador
export APIMAKER_BUILDER_TOKEN="mi_token_super_seguro"

# Aplicar las migraciones de base de datos
alembic upgrade head

# Iniciar servidor de desarrollo
./start.sh
```

*Si defines `APIMAKER_BUILDER_TOKEN`, todas las operaciones de escritura del backend requerirán el encabezado `X-API-Key` con ese valor; las rutas públicas (/projects, /openapi.json, /docs) y el simulador de mocks siguen siendo de acceso público.*

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Características recientes

- **Arquitectura Multi-Dataset**: Posibilidad de gestionar múltiples tablas (datasets) por proyecto.
- **Introspección de Base de Datos**: Importación automática de esquemas de tablas externas directamente en el API builder.
- **Base de Datos Relacional**: Migración desde JSON plano a una base de datos SQLite manejada mediante SQLModel y Alembic.
- **Simulador API Integrado**: Mock server en tiempo real e interactivo para todas las rutas generadas.
- **Documentación Dinámica**: Documentación autónoma por proyecto en `/projects/{slug}/docs` (Redoc) alimentada por `/projects/{slug}/openapi.json`.
- **Vista de Compartir**: URLs públicas `(/share/...)` de solo lectura generadas automáticamente para proyectos API.

## Próximos pasos sugeridos

1. Implementar el generador real (plantillas Jinja + empaquetado Docker/CI) que compile y suba la API real al cloud.
2. Añadir autenticación multiusuario con roles y control de espacios de trabajo para instalaciones compartidas en equipos.
3. Soporte para más dialectos de conexión a bases de datos remotas.
