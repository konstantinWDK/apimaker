# API Maker – Estado Actual

Este documento resume las capacidades implementadas hasta la fecha en el proyecto **API Maker**, abarcando frontend, backend y utilidades relacionadas.

## Visión general

API Maker es un constructor local y open source para definir datasets, diseñar endpoints REST y generar activos reutilizables (OpenAPI, documentación, bundles) que los usuarios pueden auto‑hospedar. La experiencia se compone de:

- **Frontend React/Vite**: interfaz visual para editar datasets, endpoints, payloads y sincronizar proyectos con un backend propio.
- **Backend FastAPI**: servicio que persiste proyectos, expone documentación per‑project en Redoc y permite generar artefactos.
- **Módulo generator (en progreso)**: albergará plantillas y scripts para exportar código y SDKs.

## Frontend

### Características principales

- **Hero + configuración rápida**: formulario con nombre, stack y descripción del proyecto.
- **Pestañas de trabajo**:
  - `Dataset & Vista previa`: carga manual o CSV, previsualización tabular y JSON generado.
  - `Endpoints & Simulador`: creador CRUD + pruebas (método, path, descripción, cURL y respuesta simulada).
  - `Payload & Entrega`: muestra el JSON estimado y ofrece sincronización con el backend (incluye botón principal "Sincronizar con backend" y mensajes de estado).
  - `API generada`: tarjeta con la información del sandbox (URL de pruebas, docs Redoc, enlace compartible) y galería de endpoints generados.
- **Sidebar de proyectos**: estadísticas del dataset, cuenta de endpoints y lista de snapshots guardados localmente.
- **Snapshots locales**: persistencia en `localStorage` con historial y opción de crear nuevos proyectos.
- **Share view**: al visitar `/share/{id}/{slug}` se renderiza una vista de solo lectura basada en snapshots almacenados en el navegador.
- **Configuración de backend**: sección en la pestaña Información para definir `baseUrl` y `X-API-Key` del backend FastAPI.
- **Sincronización remota**: botón que llama al backend (`/projects`, `/dataset`, `/endpoints`) y devuelve URLs permanentes (`docs`, `openapi.json`).

### Tecnologías

- React 18.3 + Vite.
- Zustand para el estado local (`useProjectBuilder`).
- TypeScript con validaciones estrictas y utilidades (`lib/api.ts`, `lib/backendConfig.ts`).
- Diseño con Space Grotesk y estilos custom en `frontend/src/styles.css`.

## Backend

### Endpoints actuales

- `GET /health`: verificación simple.
- `GET /projects`: lista todos los proyectos persistidos (archivo JSON).
- `POST /projects` *(requiere `X-API-Key` cuando se define `APIMAKER_BUILDER_TOKEN`)*: crea proyecto.
- `POST /projects/{id}/dataset` *(seguro)*: adjunta dataset.
- `POST /projects/{id}/endpoints` *(seguro)*: actualiza endpoints.
- `POST /projects/{id}/generate` *(seguro)*: stub de generación de artefactos (devuelve rutas a archivos simulados).
- `DELETE /projects/{id}` *(seguro)*: elimina proyecto.
- `GET /projects/{id}`: obtiene un proyecto específico.
- `GET /projects/{id}/openapi.json`: construye un documento OpenAPI 3.1 basado en dataset + endpoints.
- `GET /projects/{id}/docs`: UI Redoc auto‑hosted que consume la ruta anterior.

### Características técnicas

- FastAPI + Pydantic v2.
- Persistencia en archivo JSON (`backend/app/data/projects.json`) con auto‑carga al iniciar.
- Seguridad opcional por API key (`X-API-Key`) configurable vía `APIMAKER_BUILDER_TOKEN`.
- Generador de OpenAPI (`backend/app/openapi_builder.py`) que mapea tipos declarados a esquemas.
- Middleware CORS configurado para la UI local (`http://localhost:5173`, `4173`).

## Seguridad y despliegue

- **API Key**: al definir `APIMAKER_BUILDER_TOKEN`, todas las operaciones de escritura exigen `X-API-Key`. Las rutas de lectura (lista de proyectos, OpenAPI, docs) siguen abiertas para compartir documentación sin exponer el constructor.
- **Persistencia local**: tanto frontend (snapshots) como backend (JSON) funcionan sin base de datos externa, facilitando instalaciones auto‑contenidas. Se recomienda usar reverse proxy con HTTPS para despliegues públicos.

## Limitaciones actuales y próximos pasos

- El generador real de código/SDK aún no está implementado: `generator/` funciona como stub y el backend devuelve rutas simuladas.
- No hay autenticación multiusuario ni gestión de espacios de trabajo.
- Persistencia en JSON es suficiente para prototipos; se planea migrar a SQLModel/PostgreSQL.
- Compartir proyectos entre navegadores requiere una capa remota (el share actual sólo vive en `localStorage`).

## Recursos rápidos

- **Frontend**: `npm run dev`, `npm run build`.
- **Backend**: `uvicorn app.main:app --reload`, `python -m pytest`.
- **Token**: definir `APIMAKER_BUILDER_TOKEN` antes de lanzar el backend y usar el mismo valor en la UI (campo `X-API-Key`).

---

Este archivo se actualizará a medida que se incorporen nuevas funciones (autenticación, generador compilado, SDKs, etc.).
