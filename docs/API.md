# API Reference

Referencia resumida de rutas principales del backend de API Maker.

## Auth

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/auth/register` | Registra usuario si el setup lo permite |
| `POST` | `/auth/login` | Devuelve access/refresh token |
| `POST` | `/auth/refresh` | Renueva access token |
| `GET` | `/auth/me` | Usuario autenticado |

La mayoria de rutas de gestion requieren `Authorization: Bearer <token>`.

## Proyectos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/projects` | Lista proyectos accesibles |
| `POST` | `/projects` | Crea proyecto con stack, seguridad y datasets opcionales |
| `GET` | `/projects/{project_id}` | Obtiene proyecto completo |
| `PATCH` | `/projects/{project_id}` | Actualiza nombre, slug, descripcion, stack, seguridad, rate limit e include_data |
| `DELETE` | `/projects/{project_id}` | Elimina proyecto |
| `POST` | `/projects/{project_id}/dataset` | Crea/actualiza dataset y campos |
| `POST` | `/projects/{project_id}/endpoints` | Reemplaza endpoints del proyecto |
| `POST` | `/projects/{project_id}/generate` | Genera bundle, OpenAPI y SDKs |
| `GET` | `/projects/{project_id}/download` | Descarga ZIP generado |
| `GET` | `/projects/{project_id}/export` | Exporta proyecto JSON |
| `POST` | `/projects/import` | Importa proyecto JSON |
| `GET` | `/projects/{project_id}/openapi.json` | OpenAPI 3.1 del proyecto |
| `GET` | `/projects/{project_id}/docs` | Redoc del proyecto |

## Mock API

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/projects/{project_id}/mock/start` | Inicializa mock server |
| `POST` | `/projects/{project_id}/mock/stop` | Detiene mock server |
| `GET` | `/projects/{project_id}/mock/status` | Estado mock |
| `GET` | `/api/mock/{project}/{path}` | Ejecuta endpoint mock GET |
| `POST` | `/api/mock/{project}/{path}` | Ejecuta endpoint mock POST |
| `PUT` | `/api/mock/{project}/{path}` | Ejecuta endpoint mock PUT |
| `DELETE` | `/api/mock/{project}/{path}` | Ejecuta endpoint mock DELETE |

Si el proyecto usa seguridad:

- API Key: enviar `X-API-Key: <api_key>`.
- JWT: enviar `Authorization: Bearer <token>`.

## Operaciones

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/datasources` | Lista datasources |
| `POST` | `/projects/{project_id}/datasources` | Crea datasource |
| `PATCH` | `/projects/{project_id}/datasources/{datasource_id}` | Actualiza datasource |
| `DELETE` | `/projects/{project_id}/datasources/{datasource_id}` | Elimina datasource |
| `GET` | `/projects/{project_id}/queries` | Lista saved queries |
| `POST` | `/projects/{project_id}/queries` | Crea saved query |
| `POST` | `/projects/{project_id}/queries/{query_id}/run` | Ejecuta query SELECT |
| `GET` | `/projects/{project_id}/runtime-logs` | Lista logs de runtime |
| `GET` | `/projects/{project_id}/releases` | Lista releases |
| `POST` | `/projects/{project_id}/releases` | Publica release |
| `GET` | `/projects/{project_id}/releases/{release_id}` | Obtiene snapshot de release |
| `GET` | `/projects/{project_id}/automations` | Lista automations |
| `POST` | `/projects/{project_id}/automations` | Crea automation |
| `POST` | `/projects/{project_id}/automations/{automation_id}/test` | Ejecuta test manual |
| `GET` | `/projects/{project_id}/automations/{automation_id}/runs` | Lista ejecuciones |
| `POST` | `/projects/{project_id}/imports` | Importa OpenAPI/Postman |
| `GET` | `/projects/{project_id}/snapshot` | Snapshot completo |

## Webhooks

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/webhooks` | Lista webhooks |
| `POST` | `/projects/{project_id}/webhooks` | Crea webhook |
| `DELETE` | `/projects/{project_id}/webhooks/{webhook_id}` | Elimina webhook |
| `GET` | `/projects/{project_id}/webhooks/{webhook_id}/deliveries` | Historial de entregas |

## Versiones y share

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/versions` | Lista versiones |
| `POST` | `/projects/{project_id}/versions` | Crea version |
| `POST` | `/projects/{project_id}/versions/{version_id}/restore` | Restaura version |
| `POST` | `/share/projects/{project_id}` | Crea share link |
| `GET` | `/share/{snapshot_id}/{slug}` | Lee snapshot compartido |

## Deploy

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/deploy/docker-status` | Estado Docker |
| `GET` | `/api/deploy/list` | Lista deployments |
| `GET` | `/api/deploy/local/ports` | Puertos usados/libres |
| `GET` | `/api/deploy/local/check-port` | Comprueba puerto |
| `POST` | `/api/deploy/local` | Deploy local Docker |
| `POST` | `/api/deploy/local/redeploy` | Aplica cambios a deployment existente |
| `POST` | `/api/deploy/local/start` | Inicia deployment |
| `POST` | `/api/deploy/local/stop` | Detiene deployment |
| `POST` | `/api/deploy/local/restart` | Reinicia deployment |
| `POST` | `/api/deploy/local/delete` | Elimina deployment |
| `POST` | `/api/deploy/local/rebuild-image` | Reconstruye imagen base |
| `POST` | `/api/deploy/remote` | Deploy remoto via SSH |

## Plataforma

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/platform/deploy-providers` | Providers disponibles/planificados |
| `GET` | `/api/platform/plugins` | Registro de plugins/conectores |
