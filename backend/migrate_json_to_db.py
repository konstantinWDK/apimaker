"""Migration script: JSON files → SQLite database."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Dict

from sqlmodel import Session, select

# Add parent directory to path so we can import app modules
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import engine, create_db_and_tables
from app.db_models import Project, Dataset, DatasetField, Endpoint, User, Workspace
from app.models import Project as PydanticProject

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DEMO = ROOT_DIR.parent / "frontend" / "public" / "demo-project.json"
BACKEND_DEMO = ROOT_DIR / "app" / "data" / "projects.json"

def migrate() -> None:
    """Read projects.json (or fallback to demo) and insert into database."""
    
    # Ensure data directory exists
    BACKEND_DEMO.parent.mkdir(parents=True, exist_ok=True)
    
    # If projects.json doesn't exist, try to copy from frontend demo
    if not BACKEND_DEMO.exists() and FRONTEND_DEMO.exists():
        print(f"💡 Copying demo from {FRONTEND_DEMO}...")
        content = json.loads(FRONTEND_DEMO.read_text(encoding="utf-8"))
        # Wrap in a list if it's a single object
        if isinstance(content, dict):
            content = [content]
        BACKEND_DEMO.write_text(json.dumps(content, indent=2), encoding="utf-8")

    if not BACKEND_DEMO.exists():
        print("⚠️  No projects.json found. Nothing to migrate.")
        return

    print(f"📦 Migrating {BACKEND_DEMO} → Database...")

    # Create tables
    create_db_and_tables()

    # Read JSON
    try:
        raw = json.loads(BACKEND_DEMO.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"❌ Error reading JSON: {e}")
        return

    if not raw:
        print("✅ projects.json is empty. Nothing to migrate.")
        return

    if isinstance(raw, dict):
        raw = [raw]

    print(f"📋 Found {len(raw)} project(s) to migrate.")

    with Session(engine) as session:
        # Get first admin and workspace for ownership
        admin = session.exec(select(User).where(User.role == "admin")).first()
        workspace = session.exec(select(Workspace)).first()
        
        for item in raw:
            # Handle "dataset" vs "datasets" mismatch
            if "dataset" in item and "datasets" not in item:
                item["datasets"] = [item.pop("dataset")]
            
            # Ensure slug exists
            if not item.get("slug"):
                item["slug"] = item["name"].lower().replace(" ", "-").replace("é", "e").replace("á", "a")
                if "pokedex" in item["slug"]:
                    item["slug"] = "pokedex-demo"

            try:
                project_data = PydanticProject.model_validate(item)
            except Exception as e:
                print(f"❌ Validation error for {item.get('name')}: {e}")
                continue

            print(f"  → Migrating project: {project_data.name} (Slug: {project_data.slug})")

            # Check if already exists
            existing = session.exec(select(Project).where(Project.slug == project_data.slug)).first()
            if existing:
                print(f"    ⏭️  Already exists, skipping.")
                continue

            # Insert project
            db_project = Project(
                id=str(project_data.id),
                name=project_data.name,
                slug=project_data.slug,
                description=project_data.description,
                target_stack=project_data.target_stack,
                status=project_data.status.value if hasattr(project_data.status, 'value') else project_data.status,
                created_by=admin.id if admin else None,
                workspace_id=workspace.id if workspace else None,
                created_at=project_data.created_at,
                updated_at=project_data.updated_at,
            )
            session.add(db_project)
            session.flush()

            # Insert datasets
            for ds_meta in project_data.datasets:
                dataset = Dataset(
                    id=str(ds_meta.id),
                    project_id=str(db_project.id),
                    name=ds_meta.name,
                    source_type=ds_meta.source_type,
                    sample_rows=json.dumps(ds_meta.sample_rows)
                )
                session.add(dataset)
                session.flush()

                for field in ds_meta.fields:
                    session.add(
                        DatasetField(
                            dataset_id=str(dataset.id),
                            name=field.name,
                            field_type=field.type.value if hasattr(field.type, 'value') else field.type,
                            required=field.required,
                            description=field.description,
                            is_primary_key=field.is_primary_key
                        )
                    )

            # Insert endpoints
            for ep in project_data.endpoints:
                # Try to link to dataset if path matches
                target_ds_id = None
                if project_data.datasets:
                    for ds_meta in project_data.datasets:
                        if ds_meta.name.lower() in ep.path.lower():
                            target_ds_id = str(ds_meta.id)
                            break

                session.add(
                    Endpoint(
                        project_id=str(db_project.id),
                        name=ep.name,
                        method=ep.method,
                        path=ep.path,
                        summary=ep.summary,
                        operation_type=ep.operation_type,
                        target_dataset_id=target_ds_id
                    )
                )

        session.commit()

    print("✅ Migration complete!")


if __name__ == "__main__":
    migrate()
