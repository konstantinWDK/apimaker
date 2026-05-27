"""FastAPI entrypoint for DoApi backend."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import create_db_and_tables, get_database_info
from .routers import admin as admin_router, setup as setup_router
from .routers import auth, mock as mock_ctrl_router, projects, share as share_router, db
from .routers import webhooks as webhooks_router
from .routers import versions as versions_router
from .routers import deploy as deploy_router
from .routers import connections as connections_router
from .routers import product_ops as product_ops_router
from .routers import monitor as monitor_router
from .services.mock_server import router as mock_api_router


settings = get_settings()
API_V1_PREFIX = "/api/v1"

app = FastAPI(title=settings.project_name)

# Allow specific origins from settings
if settings.environment == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        allow_credentials=False,
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


# ─── Global Error Handler ──────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    detail = "Internal server error"
    if settings.environment == "development":
        detail = f"Internal server error: {str(exc)}"
    return JSONResponse(
        status_code=500,
        content={"detail": detail, "error_code": "INTERNAL_ERROR"},
    )


def include_legacy_and_v1(router, legacy_prefix: str = "") -> None:
    """Expose legacy routes and the versioned API namespace."""
    app.include_router(router, prefix=legacy_prefix)
    app.include_router(router, prefix=API_V1_PREFIX)


include_legacy_and_v1(auth.router)
include_legacy_and_v1(projects.router)
include_legacy_and_v1(mock_ctrl_router.router)
include_legacy_and_v1(mock_api_router, legacy_prefix="/api")
include_legacy_and_v1(share_router.router)
include_legacy_and_v1(admin_router.router)
include_legacy_and_v1(db.router)
include_legacy_and_v1(setup_router.router)
include_legacy_and_v1(webhooks_router.router)
include_legacy_and_v1(versions_router.router)
include_legacy_and_v1(deploy_router.router, legacy_prefix="/api")
include_legacy_and_v1(connections_router.router, legacy_prefix="/api")
include_legacy_and_v1(product_ops_router.router)
include_legacy_and_v1(product_ops_router.system_router, legacy_prefix="/api")
include_legacy_and_v1(monitor_router.router)


def on_startup() -> None:
    """Initialize application services on startup."""
    logging.basicConfig(level=logging.INFO)
    logging.info("Starting DoApi backend...")
    logging.info(f"Environment: {settings.environment}")
    logging.info(f"CORS origins: {'*' if settings.environment == 'development' else settings.allow_origins}")
    try:
        create_db_and_tables()
        logging.info("Database initialized successfully")
    except Exception as e:
        logging.error(f"Database initialization failed: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    on_startup()
    yield


app.router.lifespan_context = lifespan


@app.get(f"{API_V1_PREFIX}/health", tags=["health"])
@app.get("/health", tags=["health"])
def health() -> dict:
    db_info = get_database_info()
    return {
        "status": "ok",
        "environment": settings.environment,
        "database": db_info["type"],
    }
