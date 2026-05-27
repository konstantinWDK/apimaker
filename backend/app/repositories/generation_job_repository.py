"""Generation job persistence queries."""

from __future__ import annotations

from sqlmodel import Session

from ..db_models import GenerationJob


class GenerationJobRepository:
    """SQLModel repository for generation jobs."""

    def get(self, session: Session, job_id: str) -> GenerationJob:
        job = session.get(GenerationJob, job_id)
        if job is None:
            raise KeyError("Generation job not found")
        return job

    def get_for_project(
        self, session: Session, project_id: str, job_id: str
    ) -> GenerationJob:
        job = self.get(session, job_id)
        if job.project_id != str(project_id):
            raise KeyError("Generation job not found")
        return job


generation_job_repository = GenerationJobRepository()
