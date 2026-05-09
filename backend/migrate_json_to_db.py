"""Migration script: JSON files → SQLite database."""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select

# Add parent directory to path so we can import app modules
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import engine, create_db_and_tables
from app.db_models import Project, Dataset, DatasetField, Endpoint
from app.models import Project as PydanticProject


DATA_DIR = Path(__file__).resolve().parent / "app" / "data"
PROJECTS_FILE = DATA_DIR / "projects.json"


def migrate() -> None:
    """Read projects.json and insert into SQLite."""
    print(f"📦 Migrating {PROJECTS_FILE} → SQLite...")

    if not PROJECTS_FILE.exists():
        print("⚠️  No projects.json found. Nothing to migrate.")
        return

    # Create tables
    create_db_and_tables()

    # Read JSON
    raw = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    if not raw:
        print("✅ projects.json is empty. Nothing to migrate.")
        return

    print(f"📋 Found {len(raw)} project(s) to migrate.")

    with Session(engine) as session:
        for item in raw:
            project_data = PydanticProject.model_validate(item)
            print(f"  → Migrating project: {project_data.name} ({project_data.id})")

            # Check if already exists
            existing = session.get(Project, str(project_data.id))
            if existing:
                print(f"    ⏭️  Already exists, skipping.")
                continue

            # Insert project
            db_project = Project(
                id=str(project_data.id),
                name=project_data.name,
                description=project_data.description,
                target_stack=project_data.target_stack,
                status=project_data.status,
                created_at=project_data.created_at,
                updated_at=project_data.updated_at,
            )
            session.add(db_project)
            session.flush()

            # Insert dataset if exists
            if project_data.dataset:
                dataset = Dataset(
                    id=str(project_data.dataset.id),
                    project_id=str(project_data.id),
                    name=project_data.dataset.name,
                    source_type=project_data.dataset.source_type,
                )
                session.add(dataset)
                session.flush()

                for field in project_data.dataset.fields:
                    session.add(
                        DatasetField(
                            dataset_id=str(dataset.id),
                            name=field.name,
                            field_type=field.type,
                            required=field.required,
                            description=field.description,
                        )
                    )

            # Insert endpoints
            for ep in project_data.endpoints:
                session.add(
                    Endpoint(
                        project_id=str(project_data.id),
                        name=ep.name,
                        method=ep.method,
                        path=ep.path,
                        summary=ep.summary,
                    )
                )

        session.commit()

    print("✅ Migration complete!")


if __name__ == "__main__":
    migrate()
