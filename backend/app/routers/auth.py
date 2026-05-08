"""Authentication endpoints for the builder UI."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..auth import (
    load_credentials,
    must_change_credentials,
    reset_credentials,
    update_credentials as store_credentials,
    verify_credentials,
)


router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    ok: bool


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    if verify_credentials(payload.username, payload.password):
        return LoginResponse(ok=True)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")


class UpdateCredentialsRequest(BaseModel):
    username: str
    new_password: str
    current_password: str


@router.post("/update", status_code=status.HTTP_204_NO_CONTENT)
def update(payload: UpdateCredentialsRequest) -> None:
    stored = load_credentials()
    if not verify_credentials(stored["username"], payload.current_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contraseña actual incorrecta")
    store_credentials(payload.username, payload.new_password)


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset() -> None:
    reset_credentials()


class AuthStatus(BaseModel):
    mustChange: bool
    username: str


@router.get("/status", response_model=AuthStatus)
def status_endpoint() -> AuthStatus:
    stored = load_credentials()
    return AuthStatus(mustChange=must_change_credentials(), username=stored["username"])
