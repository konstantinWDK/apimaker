# DoApi

DoApi is a visual, open-source platform for designing, testing, documenting, generating, and deploying production-ready REST APIs. It includes a React editor, FastAPI backend, persistent mock server, per-project security, multi-stack ZIP generation, local Docker deploy, fast redeploy, and internal-tool builder features.

## Quick start

### Windows

1. Run `install.bat`.
2. Once installation finishes, use `start.bat` to launch the application.

### Linux/macOS

1. Run `./install.sh`.
2. Once installation finishes, use `./start.sh` to launch the application.

The installer sets up the environment, installs dependencies, creates the admin user, and manages the database. If you choose Docker, it will automatically detect whether ports are in use and let you choose alternative ports.

Supported databases:

- Local SQLite
- Existing PostgreSQL
- PostgreSQL in Docker container
- Existing MySQL/MariaDB
- MySQL in Docker container

If you choose a Docker-based database, credentials are saved in `.env`.

When finished, open:

```text
http://localhost:5173
```

## Starting the application

The most professional and recommended way to start is using the scripts generated during installation:

- **Windows**: `start.bat`
- **Linux/macOS**: `./start.sh`

These scripts use `concurrently` to unify Backend and Frontend logs in a single terminal with colors and prefixes.

### Manual start (Development)

If you prefer to start each service separately:

**Backend:**

```bash
cd backend
source .venv/bin/activate && pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Uninstallation

To restore the project to its initial state, removing databases, containers, and virtual environments:

- **Windows**: `uninstall.bat`
- **Linux/macOS**: `./uninstall.sh`

## Main features

### Visual builder

- Projects with name, slug, description, stack, and configuration.
- Manual/imported datasets with typed fields, relationships, enums, defaults, and sample data.
- CRUD and custom endpoints linked to datasets.
- Visual field mappings.
- Payload preview, cURL examples, and endpoint gallery.
- Backend synchronization.

### Security

- User login with JWT.
- Per-project security:
  - `none`: public API
  - `apikey`: `X-API-Key` header
  - `jwt`: `Authorization: Bearer <token>` header
- API key/JWT secret generation and rotation from UI.
- Configurable rate limit.
- Mock server and standalone deploy respect configured security.

### Mock server

- Routes at `/api/mock/{project_id_or_slug}/{path}`.
- Persistent data in database.
- Seeds from `sample_rows`.
- Type and required field validation.
- Filters, pagination, and reading by ID/field.
- Events for logs, webhooks, and automations.

### Operations

DoApi includes an **Operations** section inspired by tools like Budibase:

- Per-project datasources.
- Saved queries.
- Controlled SELECT query execution.
- Runtime logs.
- Releases with snapshot.
- Event-driven automations.
- OpenAPI/Postman imports.
- Plugin and deploy provider registry.

### Webhooks, releases, and sharing

- Webhooks for `record.created`, `record.updated`, `record.deleted` events.
- Webhook delivery history.
- Restorable versions/snapshots.
- Published releases.
- Read-only share links with optional password and expiration.

## Code generation

Supported stacks:

- **FastAPI**: SQLAlchemy, Pydantic, auth, Docker, setup, and tests.
- **Express**: Sequelize, Swagger, auth, and Docker.
- **NestJS**: TypeORM, Swagger decorators, AuthGuard, and Docker.

Generated ZIPs can include:

- Full server.
- `README.md`.
- `.env.example`.
- `Dockerfile`.
- `docker-compose.yml`.
- `setup.sh`.
- GitHub Actions CI.
- Seeds (`data.json`).
- TypeScript SDK.
- Python SDK.
- Render/Railway configs.

Bundle download:

```text
GET /projects/{project_id}/download
```

## Deploy

### From the UI

The **Deploy** page lets you:

- Local deploy with Docker.
- Use SQLite, PostgreSQL, or MySQL.
- Create PostgreSQL/MySQL in a container.
- View active deployments.
- Start, stop, restart, and delete deployments.
- Apply changes to an already deployed API without changing ports.

When you change endpoints, datasets, security, or configuration, use:

```text
Apply changes
```

This saves the project, re-exports `project.json`, and recreates the container on the same port.

### CLI

```bash
doapi init <slug> -o project.json
doapi deploy project.json --port 8080
doapi serve <slug> --port 8081
doapi deploy project.json --ssh user@host --port 80
```

## Documentation

- App docs: `/docs` route in the frontend.
- Per-project Redoc: `/projects/{project_id}/docs`.
- Per-project OpenAPI: `/projects/{project_id}/openapi.json`.
- Backend API: `docs/API.md`.
- Deploy guide (VPS, security, production): `docs/DEPLOY_GUIDE.md`.
- Feature status: `docs/PROJECT_OVERVIEW.md`.
- Roadmap: `docs/ROADMAP.md`.

## Structure

```text
doapi/
|-- backend/
|   |-- app/
|   |   |-- routers/      # auth, projects, mock, deploy, product_ops, webhooks, versions, share
|   |   |-- services/     # project_service, mock_server, code_generator, product_ops, jwt_service
|   |   |-- cli.py
|   |   `-- scripts/
|   |-- alembic/
|   `-- tests/
|-- frontend/
|   `-- src/
|       |-- components/
|       |-- hooks/
|       |-- lib/
|       `-- types/
|-- generator/templates/
|   |-- fastapi/
|   |-- express/
|   |-- nest/
|   |-- sdk/
|   `-- deploy/
|-- docs/
|-- deployments/
|-- docker-compose.yml
|-- install.bat / install.sh
`-- uninstall.bat / uninstall.sh
```

## Tests

Backend:

```bash
cd backend
pytest -q
```

Frontend:

```bash
cd frontend
npm run lint
```

Current coverage:

- Health/auth.
- JSON to DB migration.
- FastAPI/Express/NestJS bundle generation.
- Mock server.
- Product operations.
- Persisted security.
- Standalone deploy.

## Requirements

- Python 3.11+
- Node.js 18+
- Docker Desktop optional, required for local container deploy

## Important notes

- Changes to an already deployed API are not applied automatically: click **Apply changes** on the Deploy page.
- If you use JWT on a generated API, you need to send a token signed with the project's `jwt_secret`.
- Credentials generated by installation/deploy are saved in `.env` or the deployments registry.
