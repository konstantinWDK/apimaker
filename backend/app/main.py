"""FastAPI entrypoint for API Maker backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import create_db_and_tables, get_database_info
from .routers import admin as admin_router
from .routers import auth, mock as mock_ctrl_router, projects, share as share_router, db
from .services.mock_server import router as mock_api_router


settings = get_settings()

# SECURITY: Crash if using default JWT secret in production
_DEFAULT_JWT_SECRET = "apimaker-dev-secret-key-change-this-in-prod"
if settings.environment == "production" and settings.jwt_secret_key == _DEFAULT_JWT_SECRET:
    raise RuntimeError(
        "SECURITY ERROR: APIMAKER_JWT_SECRET_KEY must be set in production. "
        "Generate a secure key with: python -c 'import secrets; print(secrets.token_hex(32))'"
    )

app = FastAPI(title=settings.project_name)

# En desarrollo, permitir todos los orígenes CORS
if settings.environment == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(mock_ctrl_router.router)
app.include_router(mock_api_router)
app.include_router(share_router.router)
app.include_router(admin_router.router)
app.include_router(db.router)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize database tables on startup."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logging.info("Starting API Maker backend...")
    logging.info(f"Environment: {settings.environment}")
    logging.info(f"CORS origins: {'*' if settings.environment == 'development' else settings.allow_origins}")
    try:
        create_db_and_tables()
        logging.info("Database initialized successfully")
    except Exception as e:
        logging.error(f"Database initialization failed: {e}")
        raise


@app.get("/health", tags=["health"])
def health() -> dict:
    db_info = get_database_info()
    return {
        "status": "ok",
        "environment": settings.environment,
        "database": db_info["type"],
    }
