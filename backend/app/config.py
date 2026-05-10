"""Application configuration via environment variables."""

from __future__ import annotations

import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "API Maker"
    environment: str = "development"
    allow_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    builder_token: str | None = None
    artifacts_dir: str = "artifacts"

    # JWT settings
    # SECURITY: In production, always set APIMAKER_JWT_SECRET_KEY env var.
    jwt_secret_key: str = "apimaker-dev-secret-key-change-this-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60 * 24  # 24 hours
    jwt_refresh_expire_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", env_prefix="APIMAKER_")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
