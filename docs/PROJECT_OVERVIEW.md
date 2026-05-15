# API Maker - Estado actual

API Maker es una plataforma local y open source para construir, probar, documentar y desplegar APIs REST a partir de modelos visuales. El usuario define datasets, endpoints, seguridad y datos de ejemplo; la app permite simular la API, generar bundles por stack y desplegar APIs independientes con Docker o CLI.

## Componentes principales

- **Frontend React/Vite**: builder visual con estado en Zustand, rutas por secciones, simulador, seguridad, deploys, docs y operaciones.
- **Backend FastAPI**: API de administracion, autenticacion JWT, persistencia SQLModel, generacion de artefactos, mock server y despliegues.
- **Generator Jinja2**: plantillas para FastAPI, Express, NestJS, SDK TypeScript/Python y archivos de deploy.
- **CLI `apimaker`**: comandos para exportar, servir y desplegar proyectos como APIs independientes.

## Funciones implementadas

### Builder visual

- Creacion y edicion de proyectos.
- Datasets manuales, upload/import y conexion a bases externas.
- Campos tipados: string, integer, float, boolean, datetime, email, enum, relaciones y campos requeridos.
- Datos de ejemplo y seeds.
- Endpoints CRUD y personalizados vinculados a datasets.
- Vista previa de payloads, OpenAPI y ejemplos de consumo.
- Historial local y sincronizacion con backend.

### Seguridad

- Autenticacion del builder con usuarios y JWT.
- Roles basicos y workspace inicial.
- Seguridad por proyecto para APIs generadas/mock:
  - Publica (`none`)
  - API Key por cabecera `X-API-Key`
  - JWT por cabecera `Authorization: Bearer <token>`
- Generacion y rotacion de API keys/JWT secrets desde la UI.
- Rate limit configurable por proyecto.
- Mock server y deploy standalone respetan la seguridad configurada.

### Mock server y pruebas

- Rutas mock en `/api/mock/{project_id_or_slug}/{path}`.
- Datos persistentes en base de datos.
- Seed automatico desde `sample_rows`.
- Validacion de tipos y campos requeridos.
- Filtros, paginacion y lectura por ID/campo.
- Soporte de GET, POST, PUT, PATCH/DELETE segun endpoint definido.
- Runtime logs y eventos para llamadas, errores y automatizaciones.

### Operaciones tipo internal-tool builder

- Datasources por proyecto.
- Saved queries y ejecucion controlada de SELECT.
- Runtime logs filtrables.
- Releases publicadas con snapshot.
- Automations por trigger:
  - `endpoint.called`
  - `record.created`
  - `record.updated`
  - `record.deleted`
  - `manual`
- Actions iniciales: HTTP/webhook y runtime log.
- Imports de contratos OpenAPI/Postman.
- Registro de plugins y deploy providers.

### Webhooks, versiones y share

- Webhooks por proyecto para eventos de mock.
- Historial de entregas de webhooks.
- Versiones/snapshots de proyecto.
- Share links de solo lectura con password opcional y expiracion.

### Generacion de codigo

Stacks soportados:

- **FastAPI**: SQLAlchemy, Pydantic, Dockerfile, docker-compose, setup.sh, tests y docs.
- **Express**: Sequelize, Swagger, JWT/API Key, Dockerfile, docker-compose y tests.
- **NestJS**: TypeORM, Swagger decorators, AuthGuard, Dockerfile y estructura modular.

Cada bundle puede incluir:

- Codigo del servidor.
- `README.md` del proyecto generado.
- `.env.example`.
- `Dockerfile`.
- `docker-compose.yml`.
- `setup.sh`.
- CI GitHub Actions.
- `data.json` con seeds si `include_data` esta activo.
- SDK TypeScript y Python.
- Configs de deploy para Render/Railway.

### Deploy

- Deploy local con Docker desde la UI.
- Deploy con SQLite, PostgreSQL existente, PostgreSQL en contenedor, MySQL existente o MySQL en contenedor.
- Tracking de deployments en `deployments/.deployments.json`.
- Acciones de deployment:
  - Iniciar
  - Detener
  - Reiniciar
  - Eliminar
  - Aplicar cambios / redeploy
- Redeploy seguro:
  - Guarda el proyecto.
  - Reexporta `project.json`.
  - Recrea el contenedor.
  - Mantiene el mismo puerto si pertenece al mismo deployment.
- Deploy remoto via SSH/CLI.

## Persistencia

- Base principal configurable:
  - SQLite
  - PostgreSQL
  - MySQL/MariaDB
- Instaladores interactivos robustos:
  - `install.sh` y `install.bat`: configuran el entorno, gestionan conflictos de puertos en Docker y generan scripts de arranque personalizados.
  - `start.sh` y `start.bat`: arranque unificado y profesional mediante `concurrently` (logs coloreados y etiquetados del Backend y Frontend en una sola terminal).
  - `uninstall.sh` y `uninstall.bat`: limpieza completa del entorno, bases de datos y contenedores.
- En Windows, `install.bat` usa el Python del venv directamente, repara `pip` si falta e instala `wheel` antes del backend.

## Validacion actual

Suite automatica:

- Tests de health/auth.
- Tests de migracion.
- Tests de generacion de bundles para FastAPI, Express y NestJS.
- Tests de mock server.
- Tests de operaciones productivas.
- Tests de seguridad persistida y deploy standalone.

Comandos habituales:

```bash
cd backend
pytest -q

cd ../frontend
npm run lint
```

## Limitaciones conocidas

- El deploy remoto SSH real depende del servidor del usuario y no se valida en CI local.
- Render/Railway se entregan como configs y guias; la publicacion final se hace en la plataforma externa.
- JWT para APIs generadas requiere tokens firmados con el `jwt_secret` del proyecto.
- Los cambios en una API ya desplegada requieren pulsar **Aplicar cambios** para redeployar el contenedor.
