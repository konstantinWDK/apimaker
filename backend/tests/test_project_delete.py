"""Tests for deleting projects and their related resources."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Session, select

from app.db import engine
from app.db_models import (
    Automation,
    AutomationRun,
    Dataset,
    DatasetField,
    Datasource,
    DbConnection,
    Endpoint,
    GenerationJob,
    MockRecord,
    Project,
    ProjectRelease,
    ProjectVersion,
    RuntimeLog,
    SavedQuery,
    ShareSnapshot,
    User,
    Webhook,
    WebhookDelivery,
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


def test_owner_can_delete_project_with_endpoints_releases_mocks_versions_and_webhooks() -> None:
    with Session(engine) as session:
        suffix = uuid4().hex[:8]
        user = User(username=f"delete_all_{suffix}", password_hash=hash_password("testpass123"), role="user")
        session.add(user)
        session.commit()
        session.refresh(user)

        project = Project(name="Delete All", slug=f"delete-all-{suffix}", created_by=user.id)
        session.add(project)
        session.commit()
        session.refresh(project)
        pid = project.id

        # Endpoints
        ep = Endpoint(project_id=pid, name="list-items", method="GET", path="/items", operation_type="list")
        session.add(ep)

        # Mock records
        mr = MockRecord(project_id=pid, dataset_id="mock-ds", data="{}")
        session.add(mr)

        # Project release (deploy)
        release = ProjectRelease(project_id=pid, version="1.0.0", status="deployed")
        session.add(release)

        # Project version
        ver = ProjectVersion(project_id=pid, version=1, message="snapshot", snapshot_data="{}")
        session.add(ver)

        # Generation job
        gj = GenerationJob(project_id=pid, status="completed")
        session.add(gj)

        # Webhook
        wh = Webhook(project_id=pid, name="test-webhook", url="http://example.com", events="test")
        session.add(wh)
        session.flush()
        whd = WebhookDelivery(webhook_id=wh.id, project_id=pid, event="test", status="delivered")
        session.add(whd)

        # Automation run
        auto = Automation(project_id=pid, name="test-auto", trigger_event="manual")
        session.add(auto)
        session.flush()
        auto_run = AutomationRun(automation_id=auto.id, project_id=pid, status="completed")
        session.add(auto_run)

        # Share snapshot
        ss = ShareSnapshot(project_id=pid, slug=f"share-{suffix}", snapshot_data="{}")
        session.add(ss)

        session.commit()
        token = create_access_token(user.id, user.username, user.role)

    response = client.delete(f"/projects/{pid}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    with Session(engine) as session:
        assert session.get(Project, pid) is None
        assert session.exec(select(Endpoint).where(Endpoint.project_id == pid)).all() == []
        assert session.exec(select(MockRecord).where(MockRecord.project_id == pid)).all() == []
        assert session.exec(select(ProjectRelease).where(ProjectRelease.project_id == pid)).all() == []
        assert session.exec(select(ProjectVersion).where(ProjectVersion.project_id == pid)).all() == []
        assert session.exec(select(GenerationJob).where(GenerationJob.project_id == pid)).all() == []
        assert session.exec(select(Webhook).where(Webhook.project_id == pid)).all() == []
        assert session.exec(select(WebhookDelivery).where(WebhookDelivery.project_id == pid)).all() == []
        assert session.exec(select(AutomationRun).where(AutomationRun.project_id == pid)).all() == []
        assert session.exec(select(ShareSnapshot).where(ShareSnapshot.project_id == pid)).all() == []


def test_owner_can_delete_project_with_datasets() -> None:
    with Session(engine) as session:
        suffix = uuid4().hex[:8]
        user = User(username=f"delete_fields_{suffix}", password_hash=hash_password("testpass123"), role="user")
        session.add(user)
        session.commit()
        session.refresh(user)

        project = Project(name="Delete Fields", slug=f"delete-fields-{suffix}", created_by=user.id)
        session.add(project)
        session.commit()
        session.refresh(project)

        dataset = Dataset(id=f"ds-{suffix}", project_id=project.id, name="Test", source_type="manual")
        session.add(dataset)
        session.commit()

        project_id = project.id
        token = create_access_token(user.id, user.username, user.role)

    response = client.delete(f"/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    with Session(engine) as session:
        assert session.get(Project, project_id) is None
        assert session.exec(select(Dataset).where(Dataset.project_id == project_id)).all() == []
