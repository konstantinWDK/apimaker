# API Reference (borrador)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Estado del servicio |
| `GET` | `/projects` | Lista proyectos |
| `POST` | `/projects` | Crea un proyecto (nombre, descripción, stack) |
| `GET` | `/projects/{id}` | Obtiene detalle |
| `DELETE` | `/projects/{id}` | Elimina |
| `POST` | `/projects/{id}/dataset` | Asocia dataset (campos) |
| `POST` | `/projects/{id}/endpoints` | Define endpoints personalizados |
| `POST` | `/projects/{id}/generate` | Lanza generación de artefactos |

Todos los endpoints aceptan/retornan JSON y seguirán evolucionando hacia JWT + multi-tenancy.
