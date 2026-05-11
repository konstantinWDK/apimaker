# Roadmap

## MVP (Sprint 1-2)

- Autenticación por token simple.
- CRUD de proyectos con datasets (JSON/CSV) y endpoints generados automáticamente.
- Motor de generación para FastAPI (descarga .zip con código y OpenAPI).
- Mock server temporal para probar endpoints.

## Sprint 3-4

- Soporte Express/Nest.
- Scheduler para builds largos (Celery + Redis).
- Historial de versiones y rollback.
- Validación avanzada de datasets (tipos, claves foráneas, inferencia a partir de muestras).

## Sprint 5+

- Generación de SDKs (TS, Python, Go).
- Deploy con un clic a proveedores (Railway, Render, Azure Container Apps).
- Métricas de uso y catálogo público de plantillas.
- Billing multi-tenant.
