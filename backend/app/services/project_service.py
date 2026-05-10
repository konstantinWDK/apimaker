"""Project service layer backed by SQLModel database."""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, Project


class ProjectService:
    """Database-backed project CRUD operations."""

    def resolve_id(self, session: Session, project_id: str) -> str:
        """Resolve project ID from slug or internal ID. Prioritizes slug."""
        # 1. Try slug match (case-insensitive)
        slug_id = project_id.lower()
        project = session.exec(select(Project).where(Project.slug == slug_id)).first()
        if project:
            return project.id

        # 2. Try exact ID match
        project = session.get(Project, project_id)
        if project:
            return project.id

        raise KeyError(f"Project '{project_id}' not found")


    def create_project(
        self,
        session: Session,
        name: str,
        description: str | None = None,
        target_stack: str = "fastapi",
        slug: str | None = None,
    ) -> Project:
        import re
        if not slug:
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        else:
            slug = re.sub(r'[^a-z0-9]+', '-', slug.lower()).strip('-')
        
        project = Project(
            name=name,
            slug=slug,
            description=description,
            target_stack=target_stack,
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def update_project(
        self,
        session: Session,
        project_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        target_stack: str | None = None,
        status: str | None = None,
    ) -> Project:
        project = self.get_project(session, project_id)
        if name is not None:
            project.name = name
            # If slug is not set yet, auto-generate from new name
            if not project.slug and not slug:
                import re
                project.slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

        if slug:
            import re
            project.slug = re.sub(r'[^a-z0-9]+', '-', slug.lower()).strip('-')
        elif slug == "" and project.name:
            import re
            project.slug = re.sub(r'[^a-z0-9]+', '-', project.name.lower()).strip('-')

        if description is not None:
            project.description = description
        if target_stack is not None:
            project.target_stack = target_stack
        if status is not None:
            project.status = status
        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def list_projects(self, session: Session) -> list[Project]:
        return session.exec(select(Project)).all()

    def get_project(self, session: Session, project_id: str) -> Project:
        project = session.get(Project, str(project_id))
        if project is None:
            raise KeyError("Project not found")
        return project

    def get_project_with_data(self, session: Session, project_id: str) -> dict:
        """Get project with its datasets and endpoints loaded."""
        project = self.get_project(session, project_id)

        # Load datasets
        datasets = session.exec(
            select(Dataset).where(Dataset.project_id == str(project_id))
        ).all()

        datasets_with_fields = []
        for ds in datasets:
            fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == ds.id)
            ).all()
            datasets_with_fields.append({
                "dataset": ds,
                "fields": fields
            })

        # Load endpoints
        endpoints = session.exec(
            select(Endpoint).where(Endpoint.project_id == str(project_id))
        ).all()

        return {
            "project": project,
            "datasets": datasets_with_fields,
            "endpoints": endpoints,
        }

    def attach_dataset(
        self,
        session: Session,
        project_id: str,
        name: str,
        source_type: str,
        fields: list[dict],
        sample_rows: list[dict] | None = None,
        dataset_id: str | None = None,
    ) -> Project:
        project = self.get_project(session, project_id)

        # If dataset_id is provided, check if it exists
        dataset = None
        if dataset_id:
            dataset = session.get(Dataset, str(dataset_id))
        
        # If not found by ID, try finding by name for the same project
        if not dataset:
            dataset = session.exec(
                select(Dataset).where(Dataset.project_id == str(project_id), Dataset.name == name)
            ).first()

        # If found, update. Otherwise create.
        if dataset:
            # Clear old fields
            existing_fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == dataset.id)
            ).all()
            for f in existing_fields:
                session.delete(f)
            
            dataset.name = name
            dataset.source_type = sourceType if 'sourceType' in locals() else source_type
            import json
            dataset.sample_rows = json.dumps(sample_rows) if sample_rows else None
        else:
            import json
            dataset = Dataset(
                id=dataset_id if dataset_id else str(uuid4()),
                project_id=str(project_id),
                name=name,
                source_type=source_type,
                sample_rows=json.dumps(sample_rows) if sample_rows else None
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
        project_id: str,
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
            ep_id = ep.get("id")
            session.add(
                Endpoint(
                    id=str(ep_id) if ep_id else str(uuid4()),
                    project_id=str(project_id),
                    name=ep["name"],
                    method=ep["method"],
                    path=ep["path"],
                    summary=ep.get("summary"),
                    operation_type=ep.get("operation_type", "custom"),
                    target_dataset_id=ep.get("target_dataset_id"),
                )
            )

        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def mark_status(
        self, session: Session, project_id: str, status: str
    ) -> Project:
        project = self.get_project(session, project_id)
        project.status = status
        project.updated_at = datetime.utcnow()
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def delete_project(self, session: Session, project_id: str) -> None:
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

        # Delete share snapshots
        from ..db_models import ShareSnapshot
        existing_shares = session.exec(
            select(ShareSnapshot).where(ShareSnapshot.project_id == str(project_id))
        ).all()
        for share in existing_shares:
            session.delete(share)

        session.delete(project)
        session.commit()


project_service = ProjectService()
