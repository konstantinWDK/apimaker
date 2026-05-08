"""Simple API key security helpers."""

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_admin(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Enforce optional API key authentication for administrative actions."""

    token = get_settings().builder_token
    if not token:
        return
    if x_api_key != token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
