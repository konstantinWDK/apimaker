# Generator Module

Este directorio alojará las plantillas y scripts encargados de traducir el modelo declarativo del usuario en código real:

- Plantillas Jinja2 para FastAPI, Express y Nest.
- Configuraciones Docker y pipelines CI (GitHub Actions).
- Generación de SDKs a partir de OpenAPI (utilizando `openapi-generator-cli`).
- Empaquetado final en `.zip` y publicación opcional en un registry privado.

Pendiente: definir interfaz entre backend y generador (probablemente cola Celery + almacenamiento en S3).
