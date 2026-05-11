# API Maker

Plataforma que permite definir datasets, endpoints y generar APIs listas para desplegar en distintos stacks (FastAPI, Express, Nest). El repositorio incluye el backend en FastAPI, un frontend React/Vite y espacio para el generador de artefactos.

## Estructura

- `backend/`: servicio FastAPI con endpoints para proyectos, datasets y generación.
- `frontend/`: interfaz React que permite diseñar la API visualmente.
- `generator/`: espacio reservado para plantillas y scripts de scaffolding.
- `infra/`: definiciones de infraestructura/IaC.
- `docs/`: documentación funcional y técnica.

## Requisitos

- **Python 3.11 o superior**: El proyecto utiliza funcionalidades de tipado y rendimiento que requieren esta versión mínima.
- **Node.js**: Para el desarrollo del frontend.

## Puesta en marcha

### Backend

#### Windows (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -e ".[dev]"
.\start.ps1
```

#### Linux
```bash
cd backend
# Asegúrate de tener python3-venv instalado
python3 -m venv .venv
source .venv/bin/activate
pip3 install -e ".[dev]"
./start.sh
```

#### macOS (Zsh/Bash)
```bash
cd backend
# Usamos python3.11 para evitar la versión antigua del sistema
python3.11 -m venv .venv
source .venv/bin/activate
pip3 install -e ".[dev]"
./start.sh
```

*Si defines `APIMAKER_BUILDER_TOKEN`, todas las operaciones de escritura del backend requerirán el encabezado `X-API-Key` con ese valor; las rutas públicas (/projects, /openapi.json, /docs) y el simulador de mocks siguen siendo de acceso público.*

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> **Nota de Seguridad**: La librería `xlsx` se instala directamente desde el CDN oficial de SheetJS para garantizar que se utiliza la versión parcheada contra vulnerabilidades de *Prototype Pollution*, ya que la versión del registro estándar de npm está obsoleta.

## Próximos pasos

1. **Generador de Código Real**: Implementar plantillas Jinja2 para exportar el diseño a repositorios listos para producción.
2. **Sistema de Equipos**: Roles de Editor y Viewer para colaboración profesional.
3. **Webhooks**: Permitir que el servidor mock notifique a servicios externos cuando cambien los datos.
