# Backend Architecture

This document describes the target backend structure for DoApi. It should guide new features and refactors so the codebase keeps moving toward a modular, testable API builder.

## Layers

Use these layers for new backend work:

- `app/routers`: HTTP transport only. Validate inputs, enforce dependencies, translate exceptions into HTTP responses, and call services.
- `app/services`: Use cases and business orchestration. Services decide what needs to happen and when to commit.
- `app/repositories`: SQLModel persistence. Repositories own query shape, filtering, ordering, pagination, and graph loading.
- `app/db_models.py`: Database tables only. Avoid putting business behavior here.
- `app/models.py`: API schemas and DTOs used by routers and generated OpenAPI docs.

## Routing

All routers are exposed under both legacy paths and `/api/v1` while the frontend migrates. New clients should use `/api/v1`.

Examples:

- Legacy: `/projects`
- Versioned: `/api/v1/projects`
- Legacy mock runtime: `/api/mock/{project_id}`
- Versioned mock runtime: `/api/v1/mock/{project_id}`

Do not add hardcoded `/api` prefixes inside routers. Define routers with domain prefixes such as `/projects`, `/deploy`, or `/connections`; `app/main.py` is responsible for mounting legacy and versioned namespaces.

## Repository Pattern

Add a repository when code needs direct database queries beyond trivial object creation. Repositories should:

- Accept a `Session` from the caller.
- Return SQLModel entities or simple dict graphs.
- Contain query details such as `where`, `order_by`, `limit`, `offset`, and batch loading.
- Avoid HTTP exceptions and FastAPI dependencies.

Current examples:

- `ProjectRepository`: project access checks, batch project graph loading, listing.
- `VersionRepository`: project version lookup and version numbering.

## Service Layer

Services should coordinate use cases across repositories and models. They can:

- Build snapshots.
- Restore project state.
- Generate artifacts.
- Apply business rules.
- Commit transactions for one complete use case.

Services should not depend on FastAPI request objects or response classes.

## Performance Rules

For list endpoints:

- Provide pagination with `limit` and `offset`.
- Avoid per-row graph loading. Use batch queries with `IN (...)`.
- Provide a lightweight response option when detailed nested data is optional.

`GET /projects` supports:

- `include=data`: full project data, compatible default.
- `include=summary`: lightweight project list without datasets/endpoints.
- `limit` and `offset`: bounded pagination.

## Startup Rules

Application startup should be deterministic and quick. It can initialize tables in development, but it should not import demo data, run subprocess migrations, or perform expensive repair jobs.

Operational tasks belong in explicit commands:

- `doapi init-db`
- `doapi seed-demo`

Installers can call these commands, but `app/main.py` should not run demo imports automatically.

## Artifact Generation

Generated bundles are stored per run:

```text
artifacts/{project_slug}/runs/{run_id}/
```

The latest run is tracked through `latest.json`. A legacy bundle copy remains at `artifacts/{project_slug}/{stack}-bundle.zip` so existing download flows continue to work.

## Adding A New Backend Module

For a new feature:

1. Add DB models only if persistence is required.
2. Add a repository for queries.
3. Add a service for use cases.
4. Add a router that calls the service.
5. Add focused tests at the router or service level.
6. Mount the router through `include_legacy_and_v1` in `app/main.py`.

Keep routers small. If a route starts building snapshots, joining multiple entities, or running several queries, that logic belongs in a service or repository.
