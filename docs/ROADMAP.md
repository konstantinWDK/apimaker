# Roadmap

## Hecho

- Builder visual React/Vite.
- Backend FastAPI con SQLModel.
- Autenticacion de usuarios con JWT.
- Workspaces basicos.
- CRUD de proyectos, datasets y endpoints.
- Mock server persistente con validacion de tipos.
- Seguridad por proyecto: publica, API Key y JWT.
- OpenAPI 3.1 y Redoc por proyecto.
- Generacion de bundles FastAPI, Express y NestJS.
- SDK TypeScript y Python.
- Descarga ZIP del servidor generado.
- CLI `apimaker init`, `deploy` y `serve`.
- Deploy local Docker desde UI.
- Deploy con SQLite, PostgreSQL y MySQL.
- Redeploy / aplicar cambios sobre deployment existente.
- Webhooks con historial de entregas.
- Versiones y releases.
- Share links.
- Datasources, saved queries, runtime logs, imports y automations.
- Instaladores Windows/Linux y uninstallers.

## Siguiente sprint recomendado

1. **UX de deploy**
   - Mostrar diferencias entre proyecto actual y deployment.
   - Aviso "hay cambios pendientes por aplicar".
   - Historial de redeploys.

2. **Seguridad avanzada**
   - Endpoint para emitir JWT de prueba por proyecto.
   - Rotacion guiada de API Key/JWT secret.
   - CORS por proyecto.
   - Auditoria de cambios sensibles.

3. **Automations**
   - Editor visual de actions.
   - Retries y backoff para HTTP/webhook.
   - Scheduler/cron.
   - Variables seguras por proyecto.

4. **Datasources**
   - Introspeccion REST/SQL mas completa.
   - Query bindings desde path/query/body.
   - Preview de resultados.
   - Transformaciones entre datasource y endpoint.

5. **Deploy remoto**
   - Deploy SSH real desde UI con progreso.
   - Logs streaming.
   - Rollback al deployment anterior.
   - Soporte Traefik/Nginx/HTTPS.

6. **Calidad de bundles**
   - Tests end-to-end de ZIP generado por stack.
   - Validacion de Docker build por stack.
   - README generado mas completo.
   - Plantillas de CI/CD parametrizables.

7. **Observabilidad**
   - Dashboard de runtime logs.
   - Metricas por endpoint.
   - Errores por deployment.
   - Export de logs.

8. **Multiusuario**
   - Permisos por workspace/proyecto.
   - Invitaciones.
   - Roles editor/viewer/admin.
   - Auditoria por usuario.

## Ideas futuras

- Marketplace de plantillas.
- Plugins instalables.
- Conectores SaaS.
- Deploy a Render/Railway/Fly con OAuth/API tokens.
- Generacion de frontends administrativos sobre la API.
- Billing/multi-tenant SaaS.
