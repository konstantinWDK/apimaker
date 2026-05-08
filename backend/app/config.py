"""Application configuration via environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "API Maker"
    environment: str = "development"
    allow_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    builder_token: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_prefix="APIMAKER_")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
