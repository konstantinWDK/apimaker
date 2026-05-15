# API Maker

Plataforma visual y open source para diseñar datasets, endpoints REST y desplegar APIs listas para producción. Incluye editor visual (React), backend en FastAPI, mock server integrado, CLI para deploy y generación de código para FastAPI/Express/NestJS.

## Inicio rápido

```bash
./install.sh
```

El instalador guía paso a paso: crea el entorno virtual, instala dependencias, configura administrador y base de datos (SQLite o PostgreSQL), e importa el proyecto demo.

**Windows:** `install.bat`

Al terminar, puedes levantar la app con Docker o manualmente:

```bash
# Docker (con PostgreSQL opcional)
docker compose up -d --build

# Manual
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

Accede a **http://localhost:5173** y completa el Setup Wizard.

## Características principales

### Editor visual
- **Datasets** — Define esquemas con tipos, relaciones y datos de ejemplo. Importa desde CSV, Excel o bases de datos externas (PostgreSQL, MySQL, SQLite).
- **Endpoints REST** — CRUD automático vinculado a datasets + rutas personalizadas con método, path y parámetros.
- **Mappings** — Relaciones visuales entre campos con transformaciones (direct, cast, concat, format).

### Simulador y pruebas
- **Mock server** — Simula tu API en vivo con datos persistentes en base de datos (MockRecord). Filtros, paginación y autenticación real. Los datos sobreviven reinicios.
- **Validación de tipos** — Los endpoints mock validan tipos de campos (integer, float, boolean, string, enum) y campos requeridos, devolviendo errores 422.

### Seguridad
- **Autenticación** — JWT con refresh tokens, API Key para machine-to-machine, o pública.
- **Rate limiting** — Configurable por proyecto.
- **Gestión de credenciales** — Generación y copia de API keys y JWT secrets desde la UI.
- **Mock server protegido** — Los endpoints mock respetan la configuración de seguridad del proyecto.

### CLI — Despliegue sin dependencias
```bash
apimaker init <slug>              # Exporta proyecto a JSON
apimaker deploy <file.json>       # Despliega como API independiente
apimaker serve <slug>             # Sirve proyecto desde la DB del builder
apimaker deploy --ssh <user@host> # Despliega en VPS remoto vía SSH
```
El CLI está incluido en el paquete `apimaker-backend`.

### Despliegue desde la UI
- **Local (Docker)** — Despliega la API en el mismo servidor. Detección automática de puertos libres, tracking de contenedores, health checks.
- **Remoto (SSH)** — Instrucciones paso a paso con comandos listos para copiar. Soporta autenticación por contraseña o clave SSH privada.

### Gestión de APIs desplegadas
- Lista de todas las APIs desplegadas con estado real de Docker (🟢 corriendo / 🔴 detenido / ⚫ desconocido)
- Acciones: Abrir, Iniciar, Detener, Reconstruir, Eliminar
- Health check desde la UI

### Generación de código
- **Stack FastAPI** (Python) — SQLAlchemy 2.0, Pydantic v2, JWT, rate limiting, Alembic.
- **Stack Express** (Node.js) — Sequelize ORM, Swagger automático, JWT.
- **Stack NestJS** — TypeORM, decoradores Swagger, AuthGuard.
- Los bundles incluyen: Dockerfile, docker-compose, seeds, tests, CI/CD, SDKs.

### Documentación y recursos
- **OpenAPI 3.1** — Documentación Redoc automática en `/projects/{id}/docs`.
- **Página de documentación** — Secciones organizadas: Visión General, Tutorial, CLI, Código, Despliegue.
- **SDKs** — Clientes TypeScript y Python generados automáticamente.

### Extras
- **Webhooks** — Notifica URLs externas en eventos create/update/delete del mock server.
- **Share links** — Snapshots de solo lectura con contraseña y expiración.
- **Versionado** — Historial de snapshots del proyecto con restauración.
- **Setup Wizard** — Configuración guiada en el primer arranque.

## Estructura del proyecto

```
apimaker/
├── backend/              # FastAPI + SQLModel + Alembic
│   ├── app/
│   │   ├── routers/      # auth, projects, mock, deploy, share, webhooks, versions, setup, admin, db
│   │   ├── services/     # code_generator, mock_server, project_service, jwt_service, standalone_server
│   │   ├── cli.py        # CLI entrypoint (deploy, serve, init)
│   │   └── scripts/      # seed_admin, migrate_json_to_db, repair_pokedex
│   ├── alembic/          # Migraciones (6 versiones)
│   └── tests/            # test_health, test_auth, test_generator, test_migration, test_mock
├── frontend/             # React 18 + Vite + Zustand + React Router
│   └── src/components/   # 40+ componentes modulares
├── generator/templates/  # Jinja2: fastapi, express, nest, sdk, deploy
├── docker-compose.yml    # Dev: backend + frontend
├── docker-compose.override.yml   # Dev: hot-reload, volumenes
├── docker-compose.prod.yml       # Prod: con PostgreSQL
├── install.sh / install.bat
└── .env.example
```

## Puesta en marcha manual

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Despliegue

```bash
# Desplegar localmente (Docker)
docker compose up -d --build

# Con PostgreSQL integrado
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# O usando el CLI
apimaker deploy proyecto.json --port 8080
apimaker deploy proyecto.json --ssh usuario@midominio.com --port 80
```

## Requisitos

- Python 3.11+
- Node.js 18+
- Docker (opcional, para deploy con Docker)

## Tests

```bash
cd backend
pytest -v
# 32 tests: health, auth, generator, migration, mock
```

