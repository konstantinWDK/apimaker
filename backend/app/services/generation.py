"""Generation service — runs artifact generation for a project."""

from __future__ import annotations

from uuid import UUID

from sqlmodel import Session

from ..models import GenerationRequest, GenerationResult
from .code_generator import run_generation as _run_code_generation


def run_generation(session: Session, project_id: UUID, payload: GenerationRequest) -> GenerationResult:
    """Run real code generation (Jinja2 templates → zip bundle)."""
    return _run_code_generation(session, project_id, payload)
