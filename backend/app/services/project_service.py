"""Project service layer backed by SQLModel database."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, FieldMappingRule, Project, User, WorkspaceMember
from ..repositories.project_repository import project_repository



class ProjectService:
    """Database-backed project CRUD operations."""

    def resolve_id(self, session: Session, project_id: str) -> str:
        """Resolve project ID from slug or internal ID. Prioritizes slug."""
        return project_repository.resolve_id(session, project_id)


    def create_project(
        self,
        session: Session,
        name: str,
        description: str | None = None,
        target_stack: str = "fastapi",
        slug: str | None = None,
        workspace_id: str | None = None,
        created_by: str | None = None,
        auth_method: str = "none",
        api_key: str | None = None,
        jwt_secret: str | None = None,
        rate_limit: int | None = None,
        include_data: bool = True,
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
            workspace_id=workspace_id,
            created_by=created_by,
            auth_method=auth_method,
            api_key=api_key,
            jwt_secret=jwt_secret,
            rate_limit=rate_limit,
            include_data=include_data,
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
        auth_method: str | None = None,
        api_key: str | None = None,
        jwt_secret: str | None = None,
        rate_limit: int | None = None,
        include_data: bool | None = None,
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
        if auth_method is not None:
            project.auth_method = auth_method
        if api_key is not None:
            project.api_key = api_key
        if jwt_secret is not None:
            project.jwt_secret = jwt_secret
        if rate_limit is not None:
            project.rate_limit = rate_limit
        if include_data is not None:
            project.include_data = include_data
        project.updated_at = datetime.now(timezone.utc)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def list_projects(self, session: Session, workspace_id: str | None = None, user_id: str | None = None) -> list[Project]:
        return project_repository.list_accessible(session, workspace_id=workspace_id, user_id=user_id)

    def _legacy_list_projects(self, session: Session, workspace_id: str | None = None, user_id: str | None = None) -> list[Project]:
        query = select(Project)
        if workspace_id:
            query = query.where(Project.workspace_id == workspace_id)
        # If no workspace filter but user is authenticated, return all (for now — can restrict later)
        projects = session.exec(query).all()
        if not user_id:
            return []
        user = session.get(User, user_id)
        if user and user.role == "admin":
            return projects
        memberships = session.exec(
            select(WorkspaceMember).where(WorkspaceMember.user_id == user_id)
        ).all()
        workspace_ids = {m.workspace_id for m in memberships}
        return [
            project
            for project in projects
            if project.created_by == user_id or (project.workspace_id and project.workspace_id in workspace_ids)
        ]

    def list_projects_with_data(
        self,
        session: Session,
        workspace_id: str | None = None,
        user_id: str | None = None,
    ) -> list[dict]:
        projects = self.list_projects(session, workspace_id=workspace_id, user_id=user_id)
        return project_repository.get_graphs(session, projects)

    def get_project(self, session: Session, project_id: str) -> Project:
        return project_repository.get(session, project_id)

    def _legacy_get_project(self, session: Session, project_id: str) -> Project:
        project = session.get(Project, str(project_id))
        if project is None:
            raise KeyError("Project not found")
        return project

    def get_project_with_data(self, session: Session, project_id: str) -> dict:
        """Get project with its datasets and endpoints loaded."""
        return project_repository.get_graph(session, project_id)

    def _legacy_get_project_with_data(self, session: Session, project_id: str) -> dict:
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
        saved_requests: list[dict] | None = None,
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
        import json
        if dataset:
            # Clear old fields
            existing_fields = session.exec(
                select(DatasetField).where(DatasetField.dataset_id == dataset.id)
            ).all()
            for f in existing_fields:
                session.delete(f)
            
            dataset.name = name
            dataset.source_type = source_type
            dataset.sample_rows = json.dumps(sample_rows) if sample_rows else None
            dataset.saved_requests = json.dumps(saved_requests) if saved_requests else None
        else:
            dataset = Dataset(
                id=dataset_id if dataset_id else str(uuid4()),
                project_id=str(project_id),
                name=name,
                source_type=source_type,
                sample_rows=json.dumps(sample_rows) if sample_rows else None,
                saved_requests=json.dumps(saved_requests) if saved_requests else None
            )
        
        session.add(dataset)
        session.flush()

        for f in fields:
            refs = f.get("references")
            if refs and isinstance(refs, dict):
                import json as _json
                refs = _json.dumps(refs)
            enum_vals = f.get("enum_values")
            if enum_vals and isinstance(enum_vals, list):
                import json as _json
                enum_vals = _json.dumps(enum_vals)
            session.add(
                DatasetField(
                    dataset_id=dataset.id,
                    name=f["name"],
                    field_type=f["type"],
                    required=f.get("required", True),
                    description=f.get("description"),
                    is_primary_key=f.get("is_primary_key", False),
                    default_value=f.get("default_value"),
                    faker_category=f.get("faker_category"),
                    enum_values=enum_vals,
                    references=refs,
                )
            )

        project.updated_at = datetime.now(timezone.utc)
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

        project.updated_at = datetime.now(timezone.utc)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    def mark_status(
        self, session: Session, project_id: str, status: str
    ) -> Project:
        project = self.get_project(session, project_id)
        project.status = status
        project.updated_at = datetime.now(timezone.utc)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project

    # ─── Mapping CRUD ─────────────────────────────────────────────────
    def list_mappings(self, session: Session, project_id: str) -> list[FieldMappingRule]:
        return session.exec(
            select(FieldMappingRule).where(FieldMappingRule.project_id == str(project_id))
        ).all()

    def create_mapping(
        self,
        session: Session,
        project_id: str,
        source_dataset_id: str,
        source_field_id: str,
        target_dataset_id: str,
        target_field_id: str,
        transformation: str | None = None,
    ) -> FieldMappingRule:
        mapping = FieldMappingRule(
            project_id=str(project_id),
            source_dataset_id=source_dataset_id,
            source_field_id=source_field_id,
            target_dataset_id=target_dataset_id,
            target_field_id=target_field_id,
            transformation=transformation,
        )
        session.add(mapping)

        # Update DatasetField.references on the target field to point to the source
        target_field = session.get(DatasetField, target_field_id)
        if target_field:
            source_field = session.get(DatasetField, source_field_id)
            source_dataset = session.get(Dataset, source_dataset_id)
            if source_field and source_dataset:
                ref_payload = {
                    "datasetId": source_dataset_id,
                    "fieldName": source_field.name,
                    "datasetName": source_dataset.name,
                }
                import json
                target_field.references = json.dumps(ref_payload)
                session.add(target_field)

        session.commit()
        session.refresh(mapping)
        return mapping

    def delete_mapping(self, session: Session, mapping_id: str) -> None:
        mapping = session.get(FieldMappingRule, mapping_id)
        if not mapping:
            raise KeyError("Mapping not found")

        # Clear references on the target field
        if mapping.target_field_id:
            target_field = session.get(DatasetField, mapping.target_field_id)
            if target_field:
                target_field.references = None
                session.add(target_field)

        session.delete(mapping)
        session.commit()

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

        # Delete mapping rules
        existing_mappings = session.exec(
            select(FieldMappingRule).where(FieldMappingRule.project_id == str(project_id))
        ).all()
        for m in existing_mappings:
            session.delete(m)

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
