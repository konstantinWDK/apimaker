"""Domain services for API Maker backend."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict
from uuid import UUID

from .models import (
    DatasetMeta,
    DefineEndpointsRequest,
    GenerationRequest,
    GenerationResult,
    Project,
    ProjectStatus,
    UploadDatasetRequest,
)


DATA_DIR = Path(__file__).resolve().parent / "data"
PROJECTS_FILE = DATA_DIR / "projects.json"


class ProjectRegistry:
    """Small registry with file-based persistence."""

    def __init__(self) -> None:
        self._projects: Dict[UUID, Project] = {}
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if not PROJECTS_FILE.exists():
            return
        try:
            raw = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        for item in raw:
            project = Project.model_validate(item)
            self._projects[project.id] = project

    def _persist(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = [project.model_dump(mode="json") for project in self._projects.values()]
        PROJECTS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _touch(self, project: Project) -> Project:
        project.updated_at = datetime.utcnow()
        return project

    def list_projects(self) -> list[Project]:
        return list(self._projects.values())

    def create_project(self, payload: Project) -> Project:
        project = self._touch(payload)
        self._projects[project.id] = project
        self._persist()
        return project

    def get_project(self, project_id: UUID) -> Project:
        project = self._projects.get(project_id)
        if project is None:
            raise KeyError("Project not found")
        return project

    def attach_dataset(self, project_id: UUID, payload: UploadDatasetRequest) -> Project:
        project = self.get_project(project_id)
        project.dataset = DatasetMeta(**payload.model_dump())
        self._touch(project)
        self._persist()
        return project

    def define_endpoints(self, project_id: UUID, payload: DefineEndpointsRequest) -> Project:
        project = self.get_project(project_id)
        project.endpoints = payload.endpoints
        self._touch(project)
        self._persist()
        return project

    def mark_status(self, project_id: UUID, status: ProjectStatus) -> Project:
        project = self.get_project(project_id)
        project.status = status
        self._touch(project)
        self._persist()
        return project

    def delete_project(self, project_id: UUID) -> None:
        self._projects.pop(project_id, None)
        self._persist()


registry = ProjectRegistry()


def run_generation(project_id: UUID, payload: GenerationRequest) -> GenerationResult:
    project = registry.mark_status(project_id, ProjectStatus.BUILDING)

    artifacts_root = Path("artifacts") / str(project_id)
    openapi_path = artifacts_root / "openapi.json"
    bundle_path = artifacts_root / f"{project.target_stack}-bundle.zip"
    sdk_paths: list[str] = []
    if payload.include_sdk:
        sdk_paths.append(str(artifacts_root / "sdks" / "typescript"))
        sdk_paths.append(str(artifacts_root / "sdks" / "python"))

    registry.mark_status(project_id, ProjectStatus.READY)
    return GenerationResult(
        project_id=project.id,
        openapi_path=str(openapi_path),
        bundle_path=str(bundle_path),
        sdk_paths=sdk_paths,
    )
