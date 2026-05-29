"""Tests for deleting projects and their related resources."""

from __future__ import annotations

from uuid import uuid4

from sqlmodel import Session, select

from app.db import engine
from app.db_models import (
    Automation,
    Datasource,
    DbConnection,
    Project,
    RuntimeLog,
    SavedQuery,
    User,
)
from app.services.jwt_service import create_access_token, hash_password
from app.main import app
from fastapi.testclient import TestClient


client = TestClient(app)


def test_owner_can_delete_project_with_related_product_ops_resources() -> None:
    with Session(engine) as session:
        suffix = uuid4().hex[:8]
        user = User(username=f"delete_owner_{suffix}", password_hash=hash_password("testpass123"), role="user")
        session.add(user)
        session.commit()
        session.refresh(user)

        project = Project(name="Delete Me", slug=f"delete-me-related-{suffix}", created_by=user.id)
        session.add(project)
        session.commit()
        session.refresh(project)

        connection = DbConnection(project_id=project.id, name="DB", db_type="sqlite", database=":memory:")
        session.add(connection)
        session.commit()
        session.refresh(connection)

        datasource = Datasource(project_id=project.id, name="Source", source_type="database", connection_id=connection.id)
        session.add(datasource)
        session.commit()
        session.refresh(datasource)

        session.add(SavedQuery(project_id=project.id, datasource_id=datasource.id, connection_id=connection.id, name="Q", statement="SELECT 1"))
        session.add(Automation(project_id=project.id, name="A", trigger_event="manual"))
        session.add(RuntimeLog(project_id=project.id, event_type="test"))
        session.commit()

        project_id = project.id
        token = create_access_token(user.id, user.username, user.role)

    response = client.delete(f"/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    with Session(engine) as session:
        assert session.get(Project, project_id) is None
        assert session.exec(select(DbConnection).where(DbConnection.project_id == project_id)).all() == []
        assert session.exec(select(Datasource).where(Datasource.project_id == project_id)).all() == []
        assert session.exec(select(SavedQuery).where(SavedQuery.project_id == project_id)).all() == []
        assert session.exec(select(Automation).where(Automation.project_id == project_id)).all() == []
        assert session.exec(select(RuntimeLog).where(RuntimeLog.project_id == project_id)).all() == []
