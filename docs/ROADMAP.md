# Roadmap

## Done

- React/Vite visual builder.
- FastAPI backend with SQLModel.
- User authentication with JWT.
- Basic workspaces.
- CRUD for projects, datasets, and endpoints.
- Persistent mock server with type validation.
- Per-project security: public, API Key, and JWT.
- OpenAPI 3.1 and Redoc per project.
- FastAPI, Express, and NestJS bundle generation.
- TypeScript and Python SDKs.
- ZIP download of generated server.
- `doapi init`, `deploy`, and `serve` CLI.
- Local Docker deploy from UI.
- Deploy with SQLite, PostgreSQL, and MySQL.
- Redeploy / apply changes to existing deployment.
- Webhooks with delivery history.
- Versions and releases.
- Share links.
- Datasources, saved queries, runtime logs, imports, and automations.
- Windows/Linux installers and uninstallers.

## Next sprint recommended

1. **Deploy UX**
   - Show differences between current project and deployment.
   - "Pending changes to apply" warning.
   - Redeploy history.

2. **Advanced security**
   - Endpoint to issue test JWT per project.
   - Guided API Key/JWT secret rotation.
   - Per-project CORS.
   - Sensitive change audit.

3. **Automations**
   - Visual action editor.
   - Retries and backoff for HTTP/webhook.
   - Scheduler/cron.
   - Secure per-project variables.

4. **Datasources**
   - More complete REST/SQL introspection.
   - Query bindings from path/query/body.
   - Result preview.
   - Datasource-to-endpoint transformations.

5. **Remote deploy**
   - Real SSH deploy from UI with progress.
   - Log streaming.
   - Rollback to previous deployment.
   - Traefik/Nginx/HTTPS support.

6. **Bundle quality**
   - End-to-end tests of generated ZIP per stack.
   - Docker build validation per stack.
   - More complete generated README.
   - Parameterizable CI/CD templates.

7. **Observability**
   - Runtime logs dashboard.
   - Per-endpoint metrics.
   - Per-deployment errors.
   - Log export.

8. **Multi-user**
   - Per-workspace/project permissions.
   - Invitations.
   - Editor/viewer/admin roles.
   - Per-user audit.

## Future ideas

- Template marketplace.
- Installable plugins.
- SaaS connectors.
- Deploy to Render/Railway/Fly with OAuth/API tokens.
- Admin frontend generation on top of the API.
- Billing/multi-tenant SaaS.
