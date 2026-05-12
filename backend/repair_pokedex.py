"""Post-migration repair: link endpoints to their datasets by path matching."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlmodel import Session, select
from app.db import engine
from app.db_models import Project, Dataset, Endpoint

with Session(engine) as session:
    project = session.exec(select(Project).where(Project.slug == "pokedex-demo")).first()
    if not project:
        print("❌ Project 'pokedex-demo' not found")
    else:
        datasets = session.exec(select(Dataset).where(Dataset.project_id == str(project.id))).all()
        endpoints = session.exec(select(Endpoint).where(Endpoint.project_id == str(project.id))).all()

        for ds in datasets:
            linked = 0
            for ep in endpoints:
                if ds.name.lower().replace(" ", "") in ep.path.lower().replace(" ", ""):
                    ep.target_dataset_id = ds.id
                    session.add(ep)
                    linked += 1
            if linked:
                print(f"🔗 Linked {linked} endpoint(s) to dataset '{ds.name}'")

        session.commit()
        print("✅ Endpoints linked successfully")
