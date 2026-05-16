"""Application configuration via environment variables."""

from __future__ import annotations

import logging
import secrets
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("doapi.config")


class Settings(BaseSettings):
    project_name: str = "DoApi"
    environment: str = "development"
    allow_origins: list[str] = [
        "http://localhost:5173", 
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173"
    ]
    builder_token: str | None = None
    artifacts_dir: str = "artifacts"

    # Encryption key for sensitive data (DB passwords, etc.)
    # If empty, a random key is auto-generated (will invalidate existing encrypted data on restart).
    # Set APIMAKER_ENCRYPTION_KEY to a fixed value in production for persistence.
    encryption_key: str = ""

    @field_validator("encryption_key")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        if not v:
            key = secrets.token_urlsafe(32)
            logger.warning(
                "No APIMAKER_ENCRYPTION_KEY set. Auto-generated encryption key: %s. "
                "Set it in production for persistence across restarts.", key
            )
            return key
        return v

    # JWT settings
    # SECURITY: In production, always set APIMAKER_JWT_SECRET_KEY env var.
    jwt_secret_key: str = ""

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v, info):
        if info.data.get("environment") == "production" and (not v or v == ""):
            raise ValueError(
                "APIMAKER_JWT_SECRET_KEY must be set in production. "
                "Generate a key with: python -c 'import secrets; print(secrets.token_hex(32))'"
            )
        if not v:
            import secrets
            return secrets.token_hex(32)
        return v
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60 * 24  # 24 hours
    jwt_refresh_expire_days: int = 7

    # Database settings
    database_url: str = "sqlite:///./app/data/doapi.db"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_prefix="APIMAKER_",
        extra="ignore"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
