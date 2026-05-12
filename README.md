# API Maker

Plataforma visual y open source para diseñar datasets, endpoints REST y generar APIs listas para desplegar en FastAPI, Express o NestJS. Incluye backend en FastAPI, frontend React/Vite, mock server integrado y generador de código.

## Instalación rápida

```bash
./install.sh
```

El instalador guía paso a paso: crea el entorno virtual, instala dependencias, configura el administrador y la base de datos (SQLite o PostgreSQL), e importa datos de ejemplo.

**Windows:** `install.bat`

Al terminar, levanta la app con Docker Compose o manualmente:

```bash
# Docker
docker compose up -d --build

# Manual
cd backend && ./start.sh    # Backend en :8000
cd frontend && npm run dev  # Frontend en :5173
```

## Características

- **Datasets visuales** — Define esquemas con tipos, validaciones, relaciones y datos de ejemplo. Importa desde CSV, Excel o bases de datos externas (PostgreSQL, MySQL, SQLite).
- **Endpoints REST** — CRUD automático vinculado a datasets + rutas personalizadas. Cada endpoint con método, path y parámetros configurables.
- **Mock server** — Simula tu API en vivo con datos realistas generados por Faker. Filtros, paginación y autenticación incluidos.
- **Seguridad** — JWT, API Key, rate limiting configurable desde el panel. Secretos rotables y cambio de credenciales integrado.
- **Generación de código** — Bundle .zip con código listo para producción: modelos, controladores, Dockerfile, docker-compose, seeds y tests.
- **SDKs automáticos** — Clientes TypeScript y Python generados para consumir tu API.
- **OpenAPI 3.1** — Documentación Redoc automática en `/projects/{id}/docs` y spec en `/projects/{id}/openapi.json`.
- **Versionado** — Historial de snapshots del proyecto con restauración de versiones anteriores.
- **Mappings** — Relaciones visuales entre campos de datasets con transformaciones (direct, cast, concat, format).
- **Webhooks** — Notifica URLs externas en eventos create/update/delete del mock server.
- **Share links** — Snapshots de solo lectura con contraseña y expiración para compartir sin exponer el editor.
- **Docker listo** — Docker Compose multi-etapa con health checks, seeds automáticos y configuración de entorno.
- **Setup Wizard** — Configuración guiada del administrador y base de datos en el primer arranque.
- **Instalador multiplataforma** — Scripts `install.sh` / `install.bat` para Linux, macOS y Windows.

## Estructura

```
apimaker/
├── backend/          # FastAPI + SQLModel + Alembic
│   ├── app/
│   │   ├── routers/  # auth, projects, mock, share, webhooks, versions, setup, admin, db
│   │   ├── services/ # code_generator, mock_server, project_service, jwt, share
│   │   └── scripts/  # seed_admin
│   └── alembic/      # Migraciones
├── frontend/         # React 18 + Vite + Zustand + React Router
│   └── src/
│       ├── components/  # 37 componentes modulares
│       ├── hooks/       # useAuth, useProjectBuilder (Zustand)
│       └── lib/         # api, auth, faker, preview, slug
├── generator/        # Plantillas Jinja2 (fastapi, express, nest, sdk, deploy)
├── docker-compose.yml
├── install.sh / install.bat
└── docs/             # API.md, ROADMAP.md, PROJECT_OVERVIEW.md
```

## Puesta en marcha manual

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./start.sh
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. El primer arranque mostrará el Setup Wizard para crear el administrador.

## Requisitos

- **Python 3.11+**
- **Node.js 18+**
- **Docker** (opcional, para despliegue con Docker Compose)
