"""Project persistence queries."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import or_
from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, Project, User, WorkspaceMember


class ProjectRepository:
    """SQLModel repository for projects and their graph data."""

    def resolve_id(self, session: Session, project_id: str) -> str:
        slug_id = project_id.lower()
        project = session.exec(select(Project).where(Project.slug == slug_id)).first()
        if project:
            return project.id

        project = session.get(Project, project_id)
        if project:
            return project.id

        raise KeyError(f"Project '{project_id}' not found")

    def get(self, session: Session, project_id: str) -> Project:
        project = session.get(Project, str(project_id))
        if project is None:
            raise KeyError("Project not found")
        return project

    def list_accessible(
        self,
        session: Session,
        workspace_id: str | None = None,
        user_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Project]:
        if not user_id:
            return []

        query = select(Project).order_by(Project.updated_at.desc()).offset(offset).limit(limit)
        if workspace_id:
            query = query.where(Project.workspace_id == workspace_id)

        user = session.get(User, user_id)
        if user and user.role == "admin":
            return list(session.exec(query).all())

        memberships = session.exec(
            select(WorkspaceMember).where(WorkspaceMember.user_id == user_id)
        ).all()
        workspace_ids = [membership.workspace_id for membership in memberships]

        access_filters = [Project.created_by == user_id]
        if workspace_ids:
            access_filters.append(Project.workspace_id.in_(workspace_ids))

        return list(session.exec(query.where(or_(*access_filters))).all())

    def get_graph(self, session: Session, project_id: str) -> dict:
        project = self.get(session, project_id)
        return self.get_graphs(session, [project])[0]

    def get_graphs(self, session: Session, projects: list[Project]) -> list[dict]:
        if not projects:
            return []

        project_ids = [project.id for project in projects]
        datasets = session.exec(
            select(Dataset).where(Dataset.project_id.in_(project_ids))
        ).all()
        endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id.in_(project_ids))
        ).all()

        dataset_ids = [dataset.id for dataset in datasets]
        fields = []
        if dataset_ids:
            fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id.in_(dataset_ids))
            ).all()

        datasets_by_project = defaultdict(list)
        for dataset in datasets:
            datasets_by_project[dataset.project_id].append(dataset)

        fields_by_dataset = defaultdict(list)
        for field in fields:
            fields_by_dataset[field.dataset_id].append(field)

        endpoints_by_project = defaultdict(list)
        for endpoint in endpoints:
            endpoints_by_project[endpoint.project_id].append(endpoint)

        return [
            {
                "project": project,
                "datasets": [
                    {
                        "dataset": dataset,
                        "fields": fields_by_dataset.get(dataset.id, []),
                    }
                    for dataset in datasets_by_project.get(project.id, [])
                ],
                "endpoints": endpoints_by_project.get(project.id, []),
            }
            for project in projects
        ]


project_repository = ProjectRepository()
