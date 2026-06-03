# API Reference

Summary reference of the main DoApi backend routes.

## Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Registers user if setup allows it |
| `POST` | `/auth/login` | Returns access/refresh token |
| `POST` | `/auth/refresh` | Renews access token |
| `GET` | `/auth/me` | Authenticated user |

Most management routes require `Authorization: Bearer <token>`.

## Projects

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/projects` | Lists accessible projects |
| `POST` | `/projects` | Creates project with stack, security, and optional datasets |
| `GET` | `/projects/{project_id}` | Gets full project |
| `PATCH` | `/projects/{project_id}` | Updates name, slug, description, stack, security, rate limit, and include_data |
| `DELETE` | `/projects/{project_id}` | Deletes project |
| `POST` | `/projects/{project_id}/dataset` | Creates/updates dataset and fields |
| `POST` | `/projects/{project_id}/endpoints` | Replaces project endpoints |
| `POST` | `/projects/{project_id}/generate` | Generates bundle, OpenAPI, and SDKs |
| `GET` | `/projects/{project_id}/download` | Downloads generated ZIP |
| `GET` | `/projects/{project_id}/export` | Exports project JSON |
| `POST` | `/projects/import` | Imports project JSON |
| `GET` | `/projects/{project_id}/openapi.json` | Project OpenAPI 3.1 |
| `GET` | `/projects/{project_id}/docs` | Project Redoc |

## Mock API

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/projects/{project_id}/mock/start` | Initializes mock server |
| `POST` | `/projects/{project_id}/mock/stop` | Stops mock server |
| `GET` | `/projects/{project_id}/mock/status` | Mock status |
| `GET` | `/api/mock/{project}/{path}` | Executes GET mock endpoint |
| `POST` | `/api/mock/{project}/{path}` | Executes POST mock endpoint |
| `PUT` | `/api/mock/{project}/{path}` | Executes PUT mock endpoint |
| `DELETE` | `/api/mock/{project}/{path}` | Executes DELETE mock endpoint |

If the project uses security:

- API Key: send `X-API-Key: <api_key>`.
- JWT: send `Authorization: Bearer <token>`.

## Operations

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/datasources` | Lists datasources |
| `POST` | `/projects/{project_id}/datasources` | Creates datasource |
| `PATCH` | `/projects/{project_id}/datasources/{datasource_id}` | Updates datasource |
| `DELETE` | `/projects/{project_id}/datasources/{datasource_id}` | Deletes datasource |
| `GET` | `/projects/{project_id}/queries` | Lists saved queries |
| `POST` | `/projects/{project_id}/queries` | Creates saved query |
| `POST` | `/projects/{project_id}/queries/{query_id}/run` | Runs SELECT query |
| `GET` | `/projects/{project_id}/runtime-logs` | Lists runtime logs |
| `GET` | `/projects/{project_id}/releases` | Lists releases |
| `POST` | `/projects/{project_id}/releases` | Publishes release |
| `GET` | `/projects/{project_id}/releases/{release_id}` | Gets release snapshot |
| `GET` | `/projects/{project_id}/automations` | Lists automations |
| `POST` | `/projects/{project_id}/automations` | Creates automation |
| `POST` | `/projects/{project_id}/automations/{automation_id}/test` | Runs manual test |
| `GET` | `/projects/{project_id}/automations/{automation_id}/runs` | Lists executions |
| `POST` | `/projects/{project_id}/imports` | Imports OpenAPI/Postman |
| `GET` | `/projects/{project_id}/snapshot` | Full snapshot |

## Webhooks

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/webhooks` | Lists webhooks |
| `POST` | `/projects/{project_id}/webhooks` | Creates webhook |
| `DELETE` | `/projects/{project_id}/webhooks/{webhook_id}` | Deletes webhook |
| `GET` | `/projects/{project_id}/webhooks/{webhook_id}/deliveries` | Delivery history |

## Versions and sharing

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/projects/{project_id}/versions` | Lists versions |
| `POST` | `/projects/{project_id}/versions` | Creates version |
| `POST` | `/projects/{project_id}/versions/{version_id}/restore` | Restores version |
| `POST` | `/share/projects/{project_id}` | Creates share link |
| `GET` | `/share/{snapshot_id}/{slug}` | Reads shared snapshot |

## Deploy

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/deploy/docker-status` | Docker status |
| `GET` | `/api/deploy/list` | Lists deployments |
| `GET` | `/api/deploy/local/ports` | Used/free ports |
| `GET` | `/api/deploy/local/check-port` | Checks port |
| `POST` | `/api/deploy/local` | Local Docker deploy |
| `POST` | `/api/deploy/local/redeploy` | Applies changes to existing deployment |
| `POST` | `/api/deploy/local/start` | Starts deployment |
| `POST` | `/api/deploy/local/stop` | Stops deployment |
| `POST` | `/api/deploy/local/restart` | Restarts deployment |
| `POST` | `/api/deploy/local/delete` | Deletes deployment |
| `POST` | `/api/deploy/local/rebuild-image` | Rebuilds base image |
| `POST` | `/api/deploy/remote` | Remote deploy via SSH |

## Platform

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/platform/deploy-providers` | Available/planned providers |
| `GET` | `/api/platform/plugins` | Plugin/connector registry |
