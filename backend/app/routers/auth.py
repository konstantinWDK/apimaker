"""JWT-based authentication endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..db import get_session
from ..db_models import User, Workspace, WorkspaceMember
from ..services.jwt_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from ..security import CurrentUser, get_current_user_from_header, require_admin


router = APIRouter(prefix="/auth", tags=["auth"])


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    role: str


class CreateWorkspaceRequest(BaseModel):
    name: str
    slug: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RegisterRequest(BaseModel):
    username: str
    email: str | None = None
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> LoginResponse:
    """Authenticate with username/password and return JWT tokens."""
    user = session.exec(select(User).where(User.username == payload.username)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )
    access_token = create_access_token(user.id, user.username, user.role)
    refresh_token = create_refresh_token(user.id)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={"id": user.id, "username": user.username, "email": user.email, "role": user.role},
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_session)) -> dict:
    """Register a new user. Only works if no users exist yet (first-run) or if caller is admin."""
    # Check if any users exist
    existing_count = session.exec(select(User)).all()
    if len(existing_count) > 0:
        # Require admin to create new users
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create new users. Use the admin panel.",
        )
    # First user becomes admin
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="admin",
    )
    session.add(user)
    session.flush()
    # Create default workspace
    workspace = Workspace(
        name=f"{payload.username}'s Workspace",
        slug=payload.username.lower().replace(" ", "-"),
        owner_id=user.id,
    )
    session.add(workspace)
    session.flush()
    session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
    session.commit()
    return {"id": user.id, "username": user.username, "role": user.role}


@router.post("/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest) -> RefreshResponse:
    """Exchange a refresh token for new access + refresh tokens."""
    try:
        token_data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    # Re-fetch user to ensure still active
    from sqlmodel import Session
    from ..db import engine
    with Session(engine) as session:
        user = session.get(User, token_data["sub"])
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated",
            )
        access_token = create_access_token(user.id, user.username, user.role)
        new_refresh_token = create_refresh_token(user.id)
        return RefreshResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
        )


@router.get("/me")
def get_me(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> dict:
    """Get current user info."""
    db_user = session.get(User, user.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role,
        "is_active": db_user.is_active,
        "created_at": db_user.created_at,
    }


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> None:
    """Change current user's password and optionally username."""
    db_user = session.get(User, user.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.current_password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    # Update username if provided via extra field
    # (for now, only password changes are supported via this endpoint)
    db_user.password_hash = hash_password(payload.new_password)
    db_user.updated_at = datetime.now(timezone.utc)
    session.add(db_user)
    session.commit()


class ChangeCredentialsRequest(BaseModel):
    new_username: str
    current_password: str


@router.post("/change-username", status_code=status.HTTP_204_NO_CONTENT)
def change_username(
    payload: ChangeCredentialsRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> None:
    """Change current user's username."""
    db_user = session.get(User, user.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.current_password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    # Check if new username is available
    existing = session.exec(select(User).where(User.username == payload.new_username)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    db_user.username = payload.new_username
    session.add(db_user)
    session.commit()


@router.get("/status")
def auth_status(session: Session = Depends(get_session)) -> dict:
    """Check if any users exist (for first-run detection)."""
    count = len(session.exec(select(User)).all())
    return {"hasUsers": count > 0, "userCount": count}


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_credentials(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    """Reset admin password and username to admin/admin. Requires admin auth."""
    from ..services.jwt_service import hash_password
    db_user = session.get(User, user.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    admin_user = session.exec(select(User).where(User.role == "admin")).first()
    if admin_user:
        admin_user.password_hash = hash_password("admin")
        admin_user.username = "admin"
        session.add(admin_user)
        session.commit()


# Workspace endpoints


@router.get("/workspaces", response_model=list[WorkspaceResponse])
def list_workspaces(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> list[WorkspaceResponse]:
    """List all workspaces the current user belongs to."""
    memberships = session.exec(
        select(WorkspaceMember).where(WorkspaceMember.user_id == user.user_id)
    ).all()
    result = []
    for m in memberships:
        ws = session.get(Workspace, m.workspace_id)
        if ws:
            result.append(WorkspaceResponse(id=ws.id, name=ws.name, slug=ws.slug, role=m.role))
    return result


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: CreateWorkspaceRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> WorkspaceResponse:
    """Create a new workspace owned by the current user."""
    slug = payload.slug or payload.name.lower().replace(" ", "-")
    ws = Workspace(name=payload.name, slug=slug, owner_id=user.user_id)
    session.add(ws)
    session.flush()
    session.add(WorkspaceMember(workspace_id=ws.id, user_id=user.user_id, role="owner"))
    session.commit()
    return WorkspaceResponse(id=ws.id, name=ws.name, slug=ws.slug, role="owner")
