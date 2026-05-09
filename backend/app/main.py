"""FastAPI entrypoint for API Maker backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import create_db_and_tables
from .routers import auth, mock as mock_ctrl_router, projects, share as share_router
from .services.mock_server import router as mock_api_router


settings = get_settings()

app = FastAPI(title=settings.project_name)

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


@app.on_event("startup")
def on_startup() -> None:
    """Initialize database tables on startup."""
    create_db_and_tables()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
