# Generator Module

This directory will host the templates and scripts responsible for translating the user's declarative model into real code:

- Jinja2 templates for FastAPI, Express, and Nest.
- Docker configurations and CI pipelines (GitHub Actions).
- SDK generation from OpenAPI (using `openapi-generator-cli`).
- Final packaging into `.zip` and optional publication to a private registry.

Pending: define the interface between backend and generator (likely Celery queue + S3 storage).
