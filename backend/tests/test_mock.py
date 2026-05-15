"""Tests for the mock server — CRUD operations, validation, and DB persistence."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.db_models import Project, Dataset, DatasetField, Endpoint, MockRecord
from app.db import engine
from sqlmodel import Session, select

client = TestClient(app)

TEST_PROJECT_ID = "test-mock-project"
TEST_DATASET_ID = "test-mock-dataset"


def _cleanup() -> None:
    """Remove test project and its data from DB."""
    with Session(engine) as session:
        session.exec(
            MockRecord.__table__.delete().where(MockRecord.project_id == TEST_PROJECT_ID)
        )
        session.exec(
            DatasetField.__table__.delete().where(DatasetField.dataset_id == TEST_DATASET_ID)
        )
        session.exec(
            Endpoint.__table__.delete().where(Endpoint.project_id == TEST_PROJECT_ID)
        )
        session.exec(
            Dataset.__table__.delete().where(Dataset.project_id == TEST_PROJECT_ID)
        )
        session.exec(
            Project.__table__.delete().where(Project.id == TEST_PROJECT_ID)
        )
        session.commit()


def _setup_project() -> str:
    """Create a minimal test project with dataset and endpoints. Returns project slug."""
    _cleanup()

    with Session(engine) as session:
        project = Project(
            id=TEST_PROJECT_ID,
            name="Test Mock Project",
            slug="test-mock-project",
            target_stack="fastapi",
            status="ready",
        )
        session.add(project)
        session.flush()

        dataset = Dataset(
            id=TEST_DATASET_ID,
            project_id=TEST_PROJECT_ID,
            name="items",
            source_type="manual",
            sample_rows='[{"name":"Item A","value":10,"active":true},{"name":"Item B","value":20,"active":false}]',
        )
        session.add(dataset)
        session.flush()

        for field_def in [
            ("name", "string", True),
            ("value", "integer", True),
            ("active", "boolean", True),
            ("tag", "string", False),
        ]:
            session.add(DatasetField(
                dataset_id=TEST_DATASET_ID,
                name=field_def[0],
                field_type=field_def[1],
                required=field_def[2],
            ))

        for ep_def in [
            ("List items", "GET", "/items", "list"),
            ("Get item", "GET", "/items/{id}", "get"),
            ("Create item", "POST", "/items", "create"),
            ("Update item", "PUT", "/items/{id}", "update"),
            ("Delete item", "DELETE", "/items/{id}", "delete"),
        ]:
            session.add(Endpoint(
                project_id=TEST_PROJECT_ID,
                name=ep_def[0],
                method=ep_def[1],
                path=ep_def[2],
                operation_type=ep_def[3],
                target_dataset_id=TEST_DATASET_ID,
            ))

        session.commit()

    # Trigger auto-initialize by making a GET request
    response = client.get(f"/api/mock/test-mock-project/items")
    # First call auto-initializes, may return empty if endpoints not defined yet
    return "test-mock-project"


class TestMockServer:
    project_slug: str = ""

    @classmethod
    def setup_class(cls) -> None:
        cls.project_slug = _setup_project()

    @classmethod
    def teardown_class(cls) -> None:
        _cleanup()

    def test_mock_list(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 2
        assert len(data["data"]) == 2
        assert data["data"][0]["name"] == "Item A"

    def test_mock_get_by_id(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items")
        item_id = r.json()["data"][0]["_id"]

        r = client.get(f"/api/mock/{self.project_slug}/items/{item_id}")
        assert r.status_code == 200
        assert r.json()["name"] == "Item A"

    def test_mock_get_by_field(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items/Item%20A")
        assert r.status_code == 200
        assert r.json()["name"] == "Item A"

    def test_mock_get_404(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items/nonexistent")
        assert r.status_code == 404

    def test_mock_post_valid(self) -> None:
        r = client.post(
            f"/api/mock/{self.project_slug}/items",
            json={"name": "Item C", "value": 30, "active": True},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Item C"
        assert data["value"] == 30
        assert "_id" in data

    def test_mock_post_missing_required(self) -> None:
        r = client.post(
            f"/api/mock/{self.project_slug}/items",
            json={"name": "Incomplete"},
        )
        assert r.status_code == 422
        detail = r.json()["detail"]
        assert detail["message"] == "Validation failed"
        errors = {e["field"] for e in detail["errors"]}
        assert "value" in errors
        assert "active" in errors

    def test_mock_post_wrong_type(self) -> None:
        r = client.post(
            f"/api/mock/{self.project_slug}/items",
            json={"name": "Bad", "value": "not-a-number", "active": True},
        )
        assert r.status_code == 422
        errors = r.json()["detail"]["errors"]
        assert any(e["field"] == "value" and e["error"] == "type" for e in errors)

    def test_mock_post_invalid_boolean(self) -> None:
        r = client.post(
            f"/api/mock/{self.project_slug}/items",
            json={"name": "Bad bool", "value": 5, "active": "maybe"},
        )
        assert r.status_code == 422
        errors = r.json()["detail"]["errors"]
        assert any(e["field"] == "active" and e["error"] == "type" for e in errors)

    def test_mock_put_valid(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items")
        item_id = r.json()["data"][0]["_id"]

        r = client.put(
            f"/api/mock/{self.project_slug}/items/{item_id}",
            json={"name": "Item A Updated", "value": 100, "active": False},
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Item A Updated"

    def test_mock_put_validation(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items")
        item_id = r.json()["data"][0]["_id"]

        r = client.put(
            f"/api/mock/{self.project_slug}/items/{item_id}",
            json={"value": "bad-value"},
        )
        assert r.status_code == 422

    def test_mock_delete(self) -> None:
        r = client.get(f"/api/mock/{self.project_slug}/items")
        total_before = r.json()["total"]
        item_id = r.json()["data"][0]["_id"]

        r = client.delete(f"/api/mock/{self.project_slug}/items/{item_id}")
        assert r.status_code == 204

        r = client.get(f"/api/mock/{self.project_slug}/items")
        assert r.json()["total"] == total_before - 1

    def test_mock_data_persists_in_db(self) -> None:
        with Session(engine) as session:
            records = session.exec(
                select(MockRecord).where(MockRecord.project_id == TEST_PROJECT_ID)
            ).all()
            # Should have at least the records that were seeded and created
            # (2 seeded, 1 created in test_mock_post_valid, 1 deleted in test_mock_delete)
            assert len(records) >= 2
            # Verify data content is correct JSON
            import json
            for r in records:
                data = json.loads(r.data)
                assert "name" in data
