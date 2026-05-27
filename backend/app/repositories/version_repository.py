"""Project version persistence queries."""

from __future__ import annotations

from sqlmodel import Session, select

from ..db_models import ProjectVersion


class VersionRepository:
    """SQLModel repository for project versions."""

    def list_by_project(self, session: Session, project_id: str) -> list[ProjectVersion]:
        return list(
            session.exec(
                select(ProjectVersion)
                .where(ProjectVersion.project_id == str(project_id))
                .order_by(ProjectVersion.version.desc())
            ).all()
        )

    def get_for_project(
        self, session: Session, project_id: str, version_id: str
    ) -> ProjectVersion:
        version = session.get(ProjectVersion, version_id)
        if version is None or version.project_id != str(project_id):
            raise KeyError("Version not found")
        return version

    def next_version_number(self, session: Session, project_id: str) -> int:
        last = session.exec(
            select(ProjectVersion)
            .where(ProjectVersion.project_id == str(project_id))
            .order_by(ProjectVersion.version.desc())
        ).first()
        return (last.version + 1) if last else 1


version_repository = VersionRepository()
