# 🚀 Pokédex demo

API en memoria para listar, registrar y actualizar Pokémon y entrenadores favoritos

Este proyecto contiene una API profesional completa, lista para ser desplegada en producción.

## ⚡ Arranque Rápido

La forma más sencilla de configurar y levantar la API es usando el instalador interactivo:

```bash
chmod +x setup.sh && ./setup.sh
```

Este script configurará el entorno, las variables de entorno (`.env`) y te permitirá elegir entre ejecución local o con Docker.

## 🐳 Despliegue con Docker

Si prefieres usar Docker directamente:

```bash
docker-compose up -d --build
```
La API estará disponible en `http://localhost:8000`.

## 📚 Documentación Interactiva

Una vez levantada la API, puedes acceder a la documentación completa de todos tus recursos en:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## 🛠️ Estructura del Proyecto

- Stack: **FASTAPI**
- Base de Datos: SQLite (desarrollo) / PostgreSQL (producción vía Docker)
- Autenticación: none
- Datasets incluidos: pokemon, trainers

## 🛠️ Instalación Manual

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Ejecutar
uvicorn main:app --reload
```

## 📦 Datos Iniciales (Seeds)
Este proyecto incluye un archivo `data.json`. La API importará estos datos automáticamente en el primer arranque si la base de datos está vacía.

## 🚀 Despliegue en la Nube

### Railway
```bash
# Instala Railway CLI y ejecuta:
railway login
railway up
```
Railway detecta automáticamente el Dockerfile incluido en el proyecto.

### Render
1. Sube este repositorio a GitHub
2. Conecta tu repo en https://render.com
3. Render usará el archivo `deploy/render.yaml` para configurar el servicio automáticamente.

### Docker Compose (auto-hospedado)
```bash
docker compose up -d --build
```

---
*Generado con ❤️ por API Maker Studio*