"""JWT-based authentication endpoints."""

from datetime import datetime, timezone

from sqlmodel import Session, select

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import get_session
from ..db_models import User, Workspace, WorkspaceMember
from ..services.jwt_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from ..security import CurrentUser, get_current_user_from_header, get_optional_current_user_from_header, require_admin


router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)
WORKSPACE_MEMBER_ROLES = {"viewer", "member", "editor", "admin", "owner"}
WORKSPACE_ADMIN_ROLES = {"admin", "owner"}

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    role: str


class WorkspaceMemberResponse(BaseModel):
    id: str
    user_id: str
    username: str
    email: str | None = None
    role: str
    joined_at: str


class CreateWorkspaceRequest(BaseModel):
    name: str
    slug: str | None = None


class AddWorkspaceMemberRequest(BaseModel):
    username: str
    role: str = "viewer"


class UpdateWorkspaceMemberRequest(BaseModel):
    role: str


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


def _workspace_member_to_response(session: Session, member: WorkspaceMember) -> WorkspaceMemberResponse:
    user = session.get(User, member.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Workspace member user not found")
    return WorkspaceMemberResponse(
        id=member.id,
        user_id=user.id,
        username=user.username,
        email=user.email,
        role=member.role,
        joined_at=member.joined_at.isoformat(),
    )


def _get_workspace(session: Session, workspace_id: str) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _get_workspace_membership(session: Session, workspace_id: str, user_id: str) -> WorkspaceMember | None:
    return session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    ).first()


def _require_workspace_member(session: Session, workspace_id: str, user: CurrentUser) -> WorkspaceMember | None:
    _get_workspace(session, workspace_id)
    membership = _get_workspace_membership(session, workspace_id, user.user_id)
    if user.role != "admin" and membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    return membership


def _require_workspace_admin(session: Session, workspace_id: str, user: CurrentUser) -> WorkspaceMember | None:
    membership = _require_workspace_member(session, workspace_id, user)
    if user.role == "admin":
        return membership
    if membership is None or membership.role not in WORKSPACE_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Workspace admin access required")
    return membership


def _validate_workspace_role(role: str) -> str:
    if role not in WORKSPACE_MEMBER_ROLES:
        raise HTTPException(status_code=422, detail="Invalid workspace role")
    return role


def _count_workspace_owners(session: Session, workspace_id: str) -> int:
    return len(
        session.exec(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == "owner",
            )
        ).all()
    )


def _ensure_owner_can_change(session: Session, member: WorkspaceMember, new_role: str | None = None) -> None:
    if member.role != "owner":
        return
    if new_role == "owner":
        return
    if _count_workspace_owners(session, member.workspace_id) <= 1:
        raise HTTPException(status_code=400, detail="Workspace must keep at least one owner")


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, session: Session = Depends(get_session)) -> LoginResponse:
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
@limiter.limit("5/hour")
def register(
    request: Request,
    payload: RegisterRequest,
    session: Session = Depends(get_session),
    user: CurrentUser | None = Depends(get_optional_current_user_from_header),
) -> dict:
    """Register a new user. First user becomes admin; subsequent users require admin auth."""
    existing_count = len(session.exec(select(User)).all())
    if existing_count > 0:
        # Require admin to create new users after first user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to create new users",
            )
    # First user becomes admin, subsequent users become members by default
    role = "admin" if existing_count == 0 else "member"
    user_obj = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
    )
    session.add(user_obj)
    session.flush()
    # Create default workspace for first user only
    if existing_count == 0:
        workspace = Workspace(
            name=f"{payload.username}'s Workspace",
            slug=payload.username.lower().replace(" ", "-"),
            owner_id=user_obj.id,
        )
        session.add(workspace)
        session.flush()
        session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user_obj.id, role="owner"))
    session.commit()
    return {"id": user_obj.id, "username": user_obj.username, "role": user_obj.role}


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("20/minute")
def refresh(request: Request, payload: RefreshRequest) -> RefreshResponse:
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


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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


@router.post("/change-username", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def reset_credentials(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(require_admin),
) -> None:
    """Reset admin password and username to admin/admin. Requires admin auth."""
    from ..config import get_settings
    if get_settings().environment != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Credential reset is only available in development",
        )
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


@router.get("/workspaces/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
def list_workspace_members(
    workspace_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> list[WorkspaceMemberResponse]:
    """List workspace members for any member of the workspace."""
    _require_workspace_member(session, workspace_id, user)
    members = session.exec(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
    ).all()
    return [_workspace_member_to_response(session, member) for member in members]


@router.post("/workspaces/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
def add_workspace_member(
    workspace_id: str,
    payload: AddWorkspaceMemberRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> WorkspaceMemberResponse:
    """Add an existing user to a workspace."""
    _require_workspace_admin(session, workspace_id, user)
    role = _validate_workspace_role(payload.role)
    target_user = session.exec(select(User).where(User.username == payload.username)).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    existing = _get_workspace_membership(session, workspace_id, target_user.id)
    if existing is not None:
        raise HTTPException(status_code=409, detail="User is already a workspace member")
    member = WorkspaceMember(workspace_id=workspace_id, user_id=target_user.id, role=role)
    session.add(member)
    session.commit()
    session.refresh(member)
    return _workspace_member_to_response(session, member)


@router.patch("/workspaces/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberResponse)
def update_workspace_member(
    workspace_id: str,
    member_id: str,
    payload: UpdateWorkspaceMemberRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> WorkspaceMemberResponse:
    """Update a member role inside a workspace."""
    _require_workspace_admin(session, workspace_id, user)
    role = _validate_workspace_role(payload.role)
    member = session.get(WorkspaceMember, member_id)
    if member is None or member.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    _ensure_owner_can_change(session, member, role)
    member.role = role
    session.add(member)
    session.commit()
    session.refresh(member)
    return _workspace_member_to_response(session, member)


@router.delete("/workspaces/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def remove_workspace_member(
    workspace_id: str,
    member_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> None:
    """Remove a member from a workspace."""
    _require_workspace_admin(session, workspace_id, user)
    member = session.get(WorkspaceMember, member_id)
    if member is None or member.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    _ensure_owner_can_change(session, member)
    session.delete(member)
    session.commit()
