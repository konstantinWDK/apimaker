"""FastAPI entrypoint for API Maker backend."""

import logging

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


# ─── Global Error Handler ──────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}", "error_code": "INTERNAL_ERROR"},
    )


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(mock_ctrl_router.router)
app.include_router(mock_api_router)
app.include_router(share_router.router)
app.include_router(admin_router.router)
app.include_router(db.router)
app.include_router(setup_router.router)
app.include_router(webhooks_router.router)
app.include_router(versions_router.router)
app.include_router(deploy_router.router)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize database tables on startup."""
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

    # Auto-seed demo data if DB has no projects and projects.json exists
    try:
        from pathlib import Path
        from sqlmodel import Session, select
        from .db import engine
        from .db_models import Project

        projects_json = Path(__file__).resolve().parent / "data" / "projects.json"
        with Session(engine) as session:
            existing = session.exec(select(Project)).first()
            if not existing and projects_json.exists():
                logging.info("No projects found. Auto-seeding from projects.json...")
                import subprocess, sys
                seed_script = Path(__file__).resolve().parent / "scripts" / "seed_admin.py"
                # Run migrate_json_to_db as subprocess
                migrate_script = Path(__file__).resolve().parent.parent / "migrate_json_to_db.py"
                if migrate_script.exists():
                    result = subprocess.run(
                        [sys.executable, str(migrate_script)],
                        capture_output=True, text=True,
                        cwd=str(migrate_script.parent)
                    )
                    if result.returncode == 0:
                        logging.info("Demo data seeded successfully")
                        # Also repair pokedex endpoints
                        repair_script = Path(__file__).resolve().parent.parent / "repair_pokedex.py"
                        if repair_script.exists():
                            subprocess.run(
                                [sys.executable, str(repair_script)],
                                capture_output=True, text=True,
                                cwd=str(repair_script.parent)
                            )
                    else:
                        logging.warning(f"Migration script failed: {result.stderr}")
    except Exception as e:
        logging.warning(f"Auto-seed skipped: {e}")


@app.get("/health", tags=["health"])
def health() -> dict:
    db_info = get_database_info()
    return {
        "status": "ok",
        "environment": settings.environment,
        "database": db_info["type"],
    }
