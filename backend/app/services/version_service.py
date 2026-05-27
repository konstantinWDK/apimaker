"""Project version use cases."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, Project, ProjectVersion
from ..repositories.version_repository import version_repository
from .project_service import project_service


class VersionService:
    """Orchestrates project snapshot creation and restoration."""

    def list_versions(self, session: Session, project_id: str) -> list[ProjectVersion]:
        return version_repository.list_by_project(session, project_id)

    def get_version(
        self, session: Session, project_id: str, version_id: str
    ) -> ProjectVersion:
        return version_repository.get_for_project(session, project_id, version_id)

    def create_version(
        self, session: Session, project_id: str, message: str = ""
    ) -> ProjectVersion:
        project = project_service.get_project(session, project_id)
        data = project_service.get_project_with_data(session, project_id)
        next_version = version_repository.next_version_number(session, project_id)

        version = ProjectVersion(
            project_id=str(project_id),
            version=next_version,
            message=message,
            snapshot_data=json.dumps(self._build_snapshot(project, data)),
        )
        session.add(version)
        session.commit()
        session.refresh(version)
        return version

    def restore_version(
        self, session: Session, project_id: str, version_id: str
    ) -> ProjectVersion:
        version = self.get_version(session, project_id, version_id)
        snapshot = json.loads(version.snapshot_data)
        project = project_service.get_project(session, project_id)

        project_data = snapshot.get("project", {})
        for key in [
            "name",
            "description",
            "target_stack",
            "auth_method",
            "api_key",
            "jwt_secret",
            "rate_limit",
        ]:
            if key in project_data:
                setattr(project, key, project_data[key])
        project.updated_at = datetime.now(timezone.utc)

        self._replace_project_data(session, project_id, snapshot)

        session.add(project)
        session.commit()
        return version

    def _build_snapshot(self, project: Project, data: dict) -> dict:
        datasets_data = []
        for entry in data["datasets"]:
            dataset = entry["dataset"]
            fields = entry["fields"]
            try:
                sample_rows = json.loads(dataset.sample_rows) if dataset.sample_rows else []
            except Exception:
                sample_rows = []
            datasets_data.append(
                {
                    "id": dataset.id,
                    "name": dataset.name,
                    "source_type": dataset.source_type,
                    "fields": [
                        {
                            "name": field.name,
                            "type": field.field_type,
                            "required": field.required,
                            "description": field.description,
                        }
                        for field in fields
                    ],
                    "sample_rows": sample_rows,
                }
            )

        endpoints_data = [
            {
                "id": endpoint.id,
                "name": endpoint.name,
                "method": endpoint.method,
                "path": endpoint.path,
                "summary": endpoint.summary,
                "operation_type": endpoint.operation_type,
                "target_dataset_id": endpoint.target_dataset_id,
            }
            for endpoint in data["endpoints"]
        ]

        return {
            "project": {
                "name": project.name,
                "slug": project.slug,
                "description": project.description,
                "auth_method": project.auth_method,
                "api_key": None,
                "jwt_secret": None,
                "rate_limit": project.rate_limit,
                "target_stack": project.target_stack,
            },
            "datasets": datasets_data,
            "endpoints": endpoints_data,
        }

    def _replace_project_data(
        self, session: Session, project_id: str, snapshot: dict
    ) -> None:
        for endpoint in session.exec(
            select(Endpoint).where(Endpoint.project_id == str(project_id))
        ).all():
            session.delete(endpoint)

        for dataset in session.exec(
            select(Dataset).where(Dataset.project_id == str(project_id))
        ).all():
            for field in session.exec(
                select(DatasetField).where(DatasetField.dataset_id == dataset.id)
            ).all():
                session.delete(field)
            session.delete(dataset)

        for dataset_data in snapshot.get("datasets", []):
            dataset = Dataset(
                id=dataset_data["id"],
                project_id=str(project_id),
                name=dataset_data["name"],
                source_type=dataset_data.get("source_type", "manual"),
                sample_rows=json.dumps(dataset_data.get("sample_rows", [])),
            )
            session.add(dataset)
            session.flush()
            for field_data in dataset_data.get("fields", []):
                session.add(
                    DatasetField(
                        dataset_id=dataset.id,
                        name=field_data["name"],
                        field_type=field_data.get("type", "string"),
                        required=field_data.get("required", True),
                        description=field_data.get("description"),
                    )
                )

        for endpoint_data in snapshot.get("endpoints", []):
            session.add(
                Endpoint(
                    id=endpoint_data["id"],
                    project_id=str(project_id),
                    name=endpoint_data["name"],
                    method=endpoint_data["method"],
                    path=endpoint_data["path"],
                    summary=endpoint_data.get("summary"),
                    operation_type=endpoint_data.get("operation_type", "custom"),
                    target_dataset_id=endpoint_data.get("target_dataset_id"),
                )
            )


version_service = VersionService()
