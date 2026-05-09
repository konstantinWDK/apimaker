"""Project service layer backed by SQLModel database."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, Project


class ProjectService:
    """Database-backed project CRUD operations."""

    def create_project(
        self,
        session: Session,
        name: str,
        description: str | None = None,
        target_stack: str = "fastapi",
    ) -> Project:
        project = Project(
            name=name,
            description=description,
            target_stack=target_stack,
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def list_projects(self, session: Session) -> list[Project]:
        return session.exec(select(Project)).all()

    def get_project(self, session: Session, project_id: UUID) -> Project:
        project = session.get(Project, str(project_id))
        if project is None:
            raise KeyError("Project not found")
        return project

    def get_project_with_data(self, session: Session, project_id: UUID) -> dict:
        """Get project with its dataset and endpoints loaded."""
        project = self.get_project(session, project_id)

        # Load dataset
        dataset = session.exec(
            select(Dataset).where(Dataset.project_id == str(project_id))
        ).first()

        fields = []
        if dataset:
            fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == dataset.id)
            ).all()

        # Load endpoints
        endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id == str(project_id))
        ).all()

        return {
            "project": project,
            "dataset": dataset,
            "fields": fields,
            "endpoints": endpoints,
        }

    def attach_dataset(
        self,
        session: Session,
        project_id: UUID,
        name: str,
        source_type: str,
        fields: list[dict],
    ) -> Project:
        project = self.get_project(session, project_id)

        # Remove existing dataset if any
        existing_dataset = session.exec(
            select(Dataset).where(Dataset.project_id == str(project_id))
        ).first()
        if existing_dataset:
            existing_fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == existing_dataset.id)
            ).all()
            for f in existing_fields:
                session.delete(f)
            session.delete(existing_dataset)

        dataset = Dataset(
            project_id=str(project_id),
            name=name,
            source_type=source_type,
        )
        session.add(dataset)
        session.flush()

        for f in fields:
            session.add(
                DatasetField(
                    dataset_id=dataset.id,
                    name=f["name"],
                    field_type=f["type"],
                    required=f.get("required", True),
                    description=f.get("description"),
                )
            )

        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def define_endpoints(
        self,
        session: Session,
        project_id: UUID,
        endpoints: list[dict],
    ) -> Project:
        project = self.get_project(session, project_id)

        # Remove existing endpoints
        existing = session.exec(
            select(Endpoint).where(Endpoint.project_id == str(project_id))
        ).all()
        for ep in existing:
            session.delete(ep)

        for ep in endpoints:
            session.add(
                Endpoint(
                    project_id=str(project_id),
                    name=ep["name"],
                    method=ep["method"],
                    path=ep["path"],
                    summary=ep.get("summary"),
                )
            )

        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def mark_status(
        self, session: Session, project_id: UUID, status: str
    ) -> Project:
        project = self.get_project(session, project_id)
        project.status = status
        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def delete_project(self, session: Session, project_id: UUID) -> None:
        project = self.get_project(session, project_id)

        # Cascade delete related data
        existing_endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id == str(project_id))
        ).all()
        for ep in existing_endpoints:
            session.delete(ep)

        existing_datasets = session.exec(
            select(Dataset).where(Dataset.project_id == str(project_id))
        ).all()
        for ds in existing_datasets:
            existing_fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == ds.id)
            ).all()
            for f in existing_fields:
                session.delete(f)
            session.delete(ds)

        session.delete(project)
        session.commit()


project_service = ProjectService()
