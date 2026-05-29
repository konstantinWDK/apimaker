"""Tests for workspace member management endpoints."""

from __future__ import annotations

import time
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.db_models import User, Workspace, WorkspaceMember
from app.main import app
from app.services.jwt_service import create_access_token, hash_password


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _create_user(username: str) -> User:
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            session.expunge(existing)
            return existing
        user = User(username=username, password_hash=hash_password("testpass123"), role="user")
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
        return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.username, user.role)
    return {"Authorization": f"Bearer {token}"}


def _create_workspace(owner: User, viewer: User | None = None) -> str:
    with Session(engine) as session:
        workspace = Workspace(
            name=f"Members {SUFFIX}",
            slug=f"members-{SUFFIX}-{uuid4().hex[:8]}",
            owner_id=owner.id,
        )
        session.add(workspace)
        session.commit()
        session.refresh(workspace)
        session.add(WorkspaceMember(workspace_id=workspace.id, user_id=owner.id, role="owner"))
        if viewer is not None:
            session.add(WorkspaceMember(workspace_id=workspace.id, user_id=viewer.id, role="viewer"))
        session.commit()
        return workspace.id


def test_workspace_owner_can_add_update_and_remove_member() -> None:
    owner = _create_user(f"workspace_owner_{SUFFIX}_{uuid4().hex[:6]}")
    target = _create_user(f"workspace_target_{SUFFIX}_{uuid4().hex[:6]}")
    workspace_id = _create_workspace(owner)
    owner_headers = _headers(owner)

    added = client.post(
        f"/auth/workspaces/{workspace_id}/members",
        headers=owner_headers,
        json={"username": target.username, "role": "viewer"},
    )
    assert added.status_code == 201
    member_id = added.json()["id"]
    assert added.json()["role"] == "viewer"

    listed = client.get(f"/auth/workspaces/{workspace_id}/members", headers=owner_headers)
    assert listed.status_code == 200
    assert {member["username"] for member in listed.json()} >= {owner.username, target.username}

    updated = client.patch(
        f"/auth/workspaces/{workspace_id}/members/{member_id}",
        headers=owner_headers,
        json={"role": "editor"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "editor"

    deleted = client.delete(f"/auth/workspaces/{workspace_id}/members/{member_id}", headers=owner_headers)
    assert deleted.status_code == 204


def test_workspace_viewer_can_list_but_not_manage_members() -> None:
    owner = _create_user(f"workspace_owner_viewer_{SUFFIX}_{uuid4().hex[:6]}")
    viewer = _create_user(f"workspace_viewer_{SUFFIX}_{uuid4().hex[:6]}")
    target = _create_user(f"workspace_blocked_{SUFFIX}_{uuid4().hex[:6]}")
    workspace_id = _create_workspace(owner, viewer)
    viewer_headers = _headers(viewer)

    listed = client.get(f"/auth/workspaces/{workspace_id}/members", headers=viewer_headers)
    assert listed.status_code == 200

    added = client.post(
        f"/auth/workspaces/{workspace_id}/members",
        headers=viewer_headers,
        json={"username": target.username, "role": "member"},
    )
    assert added.status_code == 403


def test_workspace_must_keep_at_least_one_owner() -> None:
    owner = _create_user(f"workspace_lonely_owner_{SUFFIX}_{uuid4().hex[:6]}")
    workspace_id = _create_workspace(owner)
    owner_headers = _headers(owner)
    members = client.get(f"/auth/workspaces/{workspace_id}/members", headers=owner_headers)
    owner_member = next(member for member in members.json() if member["username"] == owner.username)

    demoted = client.patch(
        f"/auth/workspaces/{workspace_id}/members/{owner_member['id']}",
        headers=owner_headers,
        json={"role": "admin"},
    )
    assert demoted.status_code == 400

    removed = client.delete(f"/auth/workspaces/{workspace_id}/members/{owner_member['id']}", headers=owner_headers)
    assert removed.status_code == 400
