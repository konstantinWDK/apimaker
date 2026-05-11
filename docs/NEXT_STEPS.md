# Próximos pasos sugeridos

Este documento resume las funcionalidades pendientes o ideas de evolución para que API Maker llegue a producción como herramienta auto‑hospedable.

## Backend

1. **Mock server / runtime real**: implementar rutas `/api/{projectId}/*` que expongan datos a partir del dataset cargado (json-server embebido o FastAPI dinámico).
2. **Generador de artefactos**: conectar el módulo `generator/` para producir código (FastAPI/Express/Nest) y SDKs desde la definición guardada.
3. **Persistencia robusta**: mover de JSON plano a una base SQL (SQLite/Postgres) con migraciones y/versionado de proyectos.
4. **Autenticación avanzada**: roles, múltiples usuarios y tokens por proyecto; quizá OAuth o SSO.

## Frontend

1. **Conectar con backend real**: consumir `/projects` para listar guardados, editar y hacer CRUD completo desde la UI.
2. **Playground real**: después de que exista el mock server, permitir ejecutar requests reales desde “Endpoints & Simulador”.
3. **Wizard de despliegue**: flujo guiado para exportar la API, descargar código o push a GitHub.
4. **Mejor gestión de snapshots**: comparar versiones, clonar proyectos y etiquetar releases (v1, v2...).

## Seguridad y distribución

1. **Login multiusuario**: reemplazar el login básico por un sistema gestionado (JWT o integración con proxies que ya tenga el cliente).
2. **Configuración centralizada**: exponer un archivo `.env` o panel para definir URL del backend, tokens, etc., sin editar código.
3. **Installer/CLI**: empaquetar la app (Docker Compose o instalador) para que los usuarios la desplieguen con un comando.

## Documentación y demo

1. **API de ejemplo completa**: documentar cómo levantar un mock server con la demo Pokédex y consumirla desde Postman/cURL.
2. **Guías paso a paso**: tutoriales para crear API desde CSV, sincronizar y compartir docs.
3. **Video/demo interactivo**: mostrar el flujo end-to-end para adopción más rápida por parte de clientes.

---

Este archivo se actualizará a medida que prioricemos nuevas características. Puedes abrir issues o PRs sobre cualquiera de estos puntos.
