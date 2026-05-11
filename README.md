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

#### Windows (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .[dev]

# Iniciar servidor
.\start.ps1
```

#### Linux / macOS (Bash)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]

# Iniciar servidor
./start.sh
```

*Si defines `APIMAKER_BUILDER_TOKEN`, todas las operaciones de escritura del backend requerirán el encabezado `X-API-Key` con ese valor; las rutas públicas (/projects, /openapi.json, /docs) y el simulador de mocks siguen siendo de acceso público.*

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Próximos pasos

1. **Generador de Código Real**: Implementar plantillas Jinja2 para exportar el diseño a repositorios listos para producción.
2. **Sistema de Equipos**: Roles de Editor y Viewer para colaboración profesional.
3. **Webhooks**: Permitir que el servidor mock notifique a servicios externos cuando cambien los datos.
