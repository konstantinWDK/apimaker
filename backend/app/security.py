"""Authentication and authorization middleware."""

from __future__ import annotations

from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlmodel import Session, select

from .config import get_settings
from .db import get_session
from .db_models import DbConnection, Project, User, Workspace, WorkspaceMember
from .services.jwt_service import decode_token


class CurrentUser:
    """Represents the authenticated user from JWT token."""

    def __init__(self, user_id: str, username: str, role: str):
        self.user_id = user_id
        self.username = username
        self.role = role


def get_current_user_from_header(
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser:
    """Extract and validate JWT from Authorization header (Bearer token)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    token = authorization.replace("Bearer ", "")
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id = payload.get("sub")
    username = payload.get("username")
    role = payload.get("role")
    if not user_id or not username or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
        )
    return CurrentUser(
        user_id=user_id,
        username=username,
        role=role,
    )


def get_optional_current_user_from_header(
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser | None:
    """Return the current user when a Bearer token is present, otherwise None."""
    if not authorization:
        return None
    return get_current_user_from_header(authorization)


def get_current_user_from_cookie(
    token: Optional[str] = Cookie(default=None),
) -> CurrentUser:
    """Extract and validate JWT from cookie (for browser-based auth)."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication cookie",
        )
    try:
        payload = decode_token(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id = payload.get("sub")
    username = payload.get("username")
    role = payload.get("role")
    if not user_id or not username or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload",
        )
    return CurrentUser(
        user_id=user_id,
        username=username,
        role=role,
    )


def require_admin(user: CurrentUser = Depends(get_current_user_from_header)) -> CurrentUser:
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def _resolve_project(session: Session, project_id: str) -> Project:
    project = session.get(Project, str(project_id))
    if project is None:
        project = session.exec(select(Project).where(Project.slug == project_id.lower())).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def user_can_access_project(session: Session, project: Project, user: CurrentUser) -> bool:
    """Check whether the user can access a project."""
    if user.role == "admin":
        return True
    if project.created_by == user.user_id:
        return True
    if project.workspace_id:
        membership = session.exec(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == project.workspace_id,
                WorkspaceMember.user_id == user.user_id,
            )
        ).first()
        return membership is not None
    return False


def require_project_access(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> Project:
    """Resolve a project and require the current user to have access to it."""
    project = _resolve_project(session, project_id)
    if not user_can_access_project(session, project, user):
        raise HTTPException(status_code=403, detail="Not allowed to access this project")
    return project


def require_connection_access(
    connection_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> DbConnection:
    """Resolve a database connection and require access to its project."""
    conn = session.get(DbConnection, connection_id)
    if conn is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    project = _resolve_project(session, conn.project_id)
    if not user_can_access_project(session, project, user):
        raise HTTPException(status_code=403, detail="Not allowed to access this connection")
    return conn


def get_user_db(session: Session, user_id: str) -> User:
    """Get a user from the database by ID."""
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is deactivated")
    return user


def get_current_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> Workspace:
    """Get a workspace and verify membership."""
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Verify membership
    membership = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.user_id,
        )
    ).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    return workspace
