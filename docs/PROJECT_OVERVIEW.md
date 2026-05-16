# DoApi - Current status

DoApi is a local, open-source platform for building, testing, documenting, and deploying REST APIs from visual models. The user defines datasets, endpoints, security, and sample data; the app lets you simulate the API, generate bundles per stack, and deploy standalone APIs with Docker or CLI.

## Main components

- **React/Vite Frontend**: visual builder with Zustand state management, section-based routing, simulator, security, deploys, docs, and operations.
- **FastAPI Backend**: administration API, JWT authentication, SQLModel persistence, artifact generation, mock server, and deployments.
- **Jinja2 Generator**: templates for FastAPI, Express, NestJS, TypeScript/Python SDKs, and deploy files.
- **`doapi` CLI**: commands to export, serve, and deploy projects as standalone APIs.

## Implemented features

### Visual builder

- Project creation and editing.
- Manual datasets, upload/import, and external database connections.
- Typed fields: string, integer, float, boolean, datetime, email, enum, relationships, and required fields.
- Sample data and seeds.
- CRUD and custom endpoints linked to datasets.
- Payload preview, OpenAPI, and consumption examples.
- Local history and backend synchronization.

### Security

- Builder authentication with users and JWT.
- Basic roles and initial workspace.
- Per-project security for generated/mock APIs:
  - Public (`none`)
  - API Key via `X-API-Key` header
  - JWT via `Authorization: Bearer <token>` header
- API key/JWT secret generation and rotation from the UI.
- Configurable per-project rate limit.
- Mock server and standalone deploy respect configured security.

### Mock server and testing

- Mock routes at `/api/mock/{project_id_or_slug}/{path}`.
- Persistent data in database.
- Automatic seed from `sample_rows`.
- Type and required field validation.
- Filters, pagination, and reading by ID/field.
- GET, POST, PUT, PATCH/DELETE support per defined endpoint.
- Runtime logs and events for calls, errors, and automations.

### Internal-tool builder operations

- Per-project datasources.
- Saved queries and controlled SELECT execution.
- Filterable runtime logs.
- Published releases with snapshot.
- Trigger-based automations:
  - `endpoint.called`
  - `record.created`
  - `record.updated`
  - `record.deleted`
  - `manual`
- Initial actions: HTTP/webhook and runtime log.
- OpenAPI/Postman contract imports.
- Plugin and deploy provider registry.

### Webhooks, versions, and sharing

- Per-project webhooks for mock events.
- Webhook delivery history.
- Project versions/snapshots.
- Read-only share links with optional password and expiration.

### Code generation

Supported stacks:

- **FastAPI**: SQLAlchemy, Pydantic, Dockerfile, docker-compose, setup.sh, tests, and docs.
- **Express**: Sequelize, Swagger, JWT/API Key, Dockerfile, docker-compose, and tests.
- **NestJS**: TypeORM, Swagger decorators, AuthGuard, Dockerfile, and modular structure.

Each bundle can include:

- Server code.
- Generated project `README.md`.
- `.env.example`.
- `Dockerfile`.
- `docker-compose.yml`.
- `setup.sh`.
- GitHub Actions CI.
- `data.json` with seeds if `include_data` is active.
- TypeScript and Python SDKs.
- Render/Railway deploy configs.

### Deploy

- Local Docker deploy from the UI.
- Deploy with SQLite, existing PostgreSQL, PostgreSQL in container, existing MySQL, or MySQL in container.
- Deployment tracking in `deployments/.deployments.json`.
- Deployment actions:
  - Start
  - Stop
  - Restart
  - Delete
  - Apply changes / redeploy
- Safe redeploy:
  - Saves the project.
  - Re-exports `project.json`.
  - Recreates the container.
  - Keeps the same port if it belongs to the same deployment.
- Remote deploy via SSH/CLI.

## Persistence

- Configurable main database:
  - SQLite
  - PostgreSQL
  - MySQL/MariaDB
- Robust interactive installers:
  - `install.sh` and `install.bat`: set up the environment, handle Docker port conflicts, and generate custom startup scripts.
  - `start.sh` and `start.bat`: unified, professional startup via `concurrently` (color-coded and labeled Backend and Frontend logs in a single terminal).
  - `uninstall.sh` and `uninstall.bat`: complete cleanup of environment, databases, and containers.
- On Windows, `install.bat` uses the venv's Python directly, repairs `pip` if missing, and installs `wheel` before the backend.

## Current validation

Automated test suite:

- Health/auth tests.
- Migration tests.
- Bundle generation tests for FastAPI, Express, and NestJS.
- Mock server tests.
- Product operations tests.
- Persisted security and standalone deploy tests.

Common commands:

```bash
cd backend
pytest -q

cd ../frontend
npm run lint
```

## Known limitations

- Actual remote SSH deployment depends on the user's server and is not validated in local CI.
- Render/Railway are delivered as configs and guides; final publishing is done on the external platform.
- JWT for generated APIs requires tokens signed with the project's `jwt_secret`.
- Changes to an already deployed API require clicking **Apply changes** to redeploy the container.
