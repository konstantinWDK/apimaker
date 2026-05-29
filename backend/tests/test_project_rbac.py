"""Tests for project-level role based access control."""

from __future__ import annotations

import time
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.db_models import Project, User, Workspace, WorkspaceMember
from app.main import app
from app.services.jwt_service import create_access_token, hash_password


client = TestClient(app)
SUFFIX = str(int(time.time() * 1000))


def _create_user(username: str, password: str = "testpass123") -> User:
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            return existing
        user = User(username=username, password_hash=hash_password(password), role="user")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def _auth_headers(username: str, password: str = "testpass123") -> dict[str, str]:
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
    assert user is not None
    token = create_access_token(user.id, user.username, user.role)
    return {"Authorization": f"Bearer {token}"}


def _create_workspace_project(viewer_role: str = "viewer") -> tuple[str, str, str, str]:
    owner = _create_user(f"owner_{viewer_role}_{SUFFIX}_{uuid4().hex[:6]}")
    viewer = _create_user(f"viewer_{viewer_role}_{SUFFIX}_{uuid4().hex[:6]}")
    with Session(engine) as session:
        workspace = Workspace(
            name=f"RBAC {viewer_role} {SUFFIX}",
            slug=f"rbac-{viewer_role}-{SUFFIX}-{uuid4().hex[:6]}",
            owner_id=owner.id,
        )
        session.add(workspace)
        session.commit()
        session.refresh(workspace)
        session.add(WorkspaceMember(workspace_id=workspace.id, user_id=owner.id, role="owner"))
        session.add(WorkspaceMember(workspace_id=workspace.id, user_id=viewer.id, role=viewer_role))
        project = Project(
            name=f"RBAC Project {viewer_role} {SUFFIX}",
            workspace_id=workspace.id,
            created_by=owner.id,
            target_stack="fastapi",
            api_key="project-secret",
            auth_method="apikey",
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        return project.id, workspace.id, owner.username, viewer.username


def test_workspace_viewer_can_read_project_but_cannot_mutate_it() -> None:
    project_id, _, _, viewer_username = _create_workspace_project("viewer")
    viewer_headers = _auth_headers(viewer_username)

    read_project = client.get(f"/projects/{project_id}", headers=viewer_headers)
    assert read_project.status_code == 200

    docs = client.get(f"/projects/{project_id}/docs", headers=viewer_headers)
    assert docs.status_code == 200

    update_project = client.patch(
        f"/projects/{project_id}",
        headers=viewer_headers,
        json={"name": "Viewer edit"},
    )
    assert update_project.status_code == 403

    upload_dataset = client.post(
        f"/projects/{project_id}/dataset",
        headers=viewer_headers,
        json={
            "name": "items",
            "source_type": "manual",
            "fields": [{"name": "name", "type": "string", "required": True}],
        },
    )
    assert upload_dataset.status_code == 403


def test_workspace_member_can_edit_but_cannot_delete_project_or_export_secrets() -> None:
    project_id, _, _, member_username = _create_workspace_project("member")
    member_headers = _auth_headers(member_username)

    upload_dataset = client.post(
        f"/projects/{project_id}/dataset",
        headers=member_headers,
        json={
            "name": "items",
            "source_type": "manual",
            "fields": [{"name": "name", "type": "string", "required": True}],
        },
    )
    assert upload_dataset.status_code == 200

    export = client.get(f"/projects/{project_id}/export?include_secrets=true", headers=member_headers)
    assert export.status_code == 200
    assert export.json()["project"]["api_key"] is None

    delete_project = client.delete(f"/projects/{project_id}", headers=member_headers)
    assert delete_project.status_code == 403
