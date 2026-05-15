# API Maker

API Maker es una plataforma visual y open source para disenar, probar, documentar, generar y desplegar APIs REST listas para produccion. Incluye editor React, backend FastAPI, mock server persistente, seguridad por proyecto, generacion de ZIPs para varios stacks, deploy local con Docker, redeploy rapido y herramientas tipo internal-tool builder.

## Inicio rapido

### Windows

1. Ejecuta `install.bat`.
2. Una vez terminada la instalacion, usa `start.bat` para arrancar la aplicacion.

### Linux/macOS

1. Ejecuta `./install.sh`.
2. Una vez terminada la instalacion, usa `./start.sh` para arrancar la aplicacion.

El instalador configura el entorno, instala dependencias, crea el usuario administrador y gestiona la base de datos. Si eliges Docker, detectara automaticamente si los puertos estan ocupados y te permitira elegir puertos alternativos.

Bases soportadas:

- SQLite local
- PostgreSQL existente
- PostgreSQL en contenedor Docker
- MySQL/MariaDB existente
- MySQL en contenedor Docker

Si eliges una base Docker, las credenciales se guardan en `.env`.

Al terminar, abre:

```text
http://localhost:5173
```

## Arranque de la aplicacion

La forma mas profesional y recomendada de arrancar es usar los scripts generados durante la instalacion:

- **Windows**: `start.bat`
- **Linux/macOS**: `./start.sh`

Estos scripts utilizan `concurrently` para unificar los logs del Backend y Frontend en una sola terminal con colores y prefijos.

### Arranque manual (Desarrollo)

Si prefieres arrancar cada servicio por separado:

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

## Desinstalacion

Para restaurar el proyecto al estado inicial, eliminando bases de datos, contenedores y entornos virtuales:

- **Windows**: `uninstall.bat`
- **Linux/macOS**: `./uninstall.sh`

## Funciones principales

### Builder visual

- Proyectos con nombre, slug, descripcion, stack y configuracion.
- Datasets manuales/importados con campos tipados, relaciones, enums, defaults y datos de ejemplo.
- Endpoints CRUD y personalizados vinculados a datasets.
- Mappings visuales entre campos.
- Preview de payloads, ejemplos cURL y galeria de endpoints.
- Sincronizacion con backend.

### Seguridad

- Login de usuarios con JWT.
- Seguridad por proyecto:
  - `none`: API publica
  - `apikey`: cabecera `X-API-Key`
  - `jwt`: cabecera `Authorization: Bearer <token>`
- Generacion y rotacion de API keys/JWT secrets desde UI.
- Rate limit configurable.
- Mock server y deploy standalone respetan la seguridad configurada.

### Mock server

- Rutas en `/api/mock/{project_id_or_slug}/{path}`.
- Datos persistentes en base de datos.
- Seeds desde `sample_rows`.
- Validacion de tipos y requeridos.
- Filtros, paginacion y lectura por ID/campo.
- Eventos para logs, webhooks y automations.

### Operaciones

API Maker incluye una seccion **Operaciones** inspirada en herramientas como Budibase:

- Datasources por proyecto.
- Saved queries.
- Ejecucion controlada de queries SELECT.
- Runtime logs.
- Releases con snapshot.
- Automations por eventos.
- Imports OpenAPI/Postman.
- Registro de plugins y deploy providers.

### Webhooks, releases y share

- Webhooks por eventos `record.created`, `record.updated`, `record.deleted`.
- Historial de entregas de webhooks.
- Versiones/snapshots restaurables.
- Releases publicadas.
- Share links de solo lectura con password y expiracion opcional.

## Generacion de codigo

Stacks soportados:

- **FastAPI**: SQLAlchemy, Pydantic, auth, Docker, setup y tests.
- **Express**: Sequelize, Swagger, auth y Docker.
- **NestJS**: TypeORM, Swagger decorators, AuthGuard y Docker.

Los ZIPs generados pueden incluir:

- Servidor completo.
- `README.md`.
- `.env.example`.
- `Dockerfile`.
- `docker-compose.yml`.
- `setup.sh`.
- CI GitHub Actions.
- Seeds (`data.json`).
- SDK TypeScript.
- SDK Python.
- Configs para Render/Railway.

Descarga del bundle:

```text
GET /projects/{project_id}/download
```

## Deploy

### Desde la UI

La pagina **Despliegue** permite:

- Deploy local con Docker.
- Usar SQLite, PostgreSQL o MySQL.
- Crear PostgreSQL/MySQL en contenedor.
- Ver deployments activos.
- Iniciar, detener, reiniciar y eliminar deployments.
- Aplicar cambios a una API ya desplegada sin cambiar de puerto.

Cuando cambias endpoints, datasets, seguridad o configuracion, usa:

```text
Aplicar cambios
```

Esto guarda el proyecto, reexporta `project.json` y recrea el contenedor en el mismo puerto.

### CLI

```bash
apimaker init <slug> -o proyecto.json
apimaker deploy proyecto.json --port 8080
apimaker serve <slug> --port 8081
apimaker deploy proyecto.json --ssh usuario@host --port 80
```

## Documentacion

- App docs: ruta `/docs` del frontend.
- Redoc por proyecto: `/projects/{project_id}/docs`.
- OpenAPI por proyecto: `/projects/{project_id}/openapi.json`.
- API backend: `docs/API.md`.
- Estado funcional: `docs/PROJECT_OVERVIEW.md`.
- Roadmap: `docs/ROADMAP.md`.

## Estructura

```text
apimaker/
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

Cobertura actual:

- Health/auth.
- Migracion JSON a DB.
- Generacion de bundles FastAPI/Express/NestJS.
- Mock server.
- Product operations.
- Seguridad persistida.
- Deploy standalone.

## Requisitos

- Python 3.11+
- Node.js 18+
- Docker Desktop opcional, necesario para deploy local con contenedores

## Notas importantes

- Los cambios en una API ya desplegada no se aplican solos: pulsa **Aplicar cambios** en la pagina de Deploy.
- Si usas JWT en una API generada, necesitas enviar un token firmado con el `jwt_secret` del proyecto.
- Las credenciales generadas por instalacion/deploy se guardan en `.env` o en el registro de deployments.
