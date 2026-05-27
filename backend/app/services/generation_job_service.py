"""Background generation job use cases."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session

from ..db import engine
from ..db_models import GenerationJob
from ..models import GenerationJobResponse, GenerationRequest, GenerationResult
from ..repositories.generation_job_repository import generation_job_repository
from .generation import run_generation


class GenerationJobService:
    """Creates, runs, and serializes code generation jobs."""

    def create_job(
        self,
        session: Session,
        project_id: str,
        payload: GenerationRequest,
        created_by: str | None = None,
    ) -> GenerationJob:
        job = GenerationJob(
            project_id=str(project_id),
            payload_json=json.dumps(payload.model_dump()),
            created_by=created_by,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return job

    def get_job(self, session: Session, project_id: str, job_id: str) -> GenerationJob:
        return generation_job_repository.get_for_project(session, project_id, job_id)

    def run_job(self, job_id: str) -> None:
        with Session(engine) as session:
            job = generation_job_repository.get(session, job_id)
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()

            try:
                payload = GenerationRequest(**json.loads(job.payload_json or "{}"))
                result = run_generation(session, job.project_id, payload)
                job.status = "success"
                job.result_json = result.model_dump_json()
                job.error = None
            except Exception as exc:
                job.status = "failed"
                job.error = str(exc)
            finally:
                job.finished_at = datetime.now(timezone.utc)
                session.add(job)
                session.commit()

    def to_response(self, job: GenerationJob) -> GenerationJobResponse:
        result = None
        if job.result_json:
            result = GenerationResult(**json.loads(job.result_json))
        return GenerationJobResponse(
            id=job.id,
            project_id=job.project_id,
            status=job.status,
            result=result,
            error=job.error,
            created_at=job.created_at,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )


generation_job_service = GenerationJobService()
