from sqlmodel import Session, create_engine, select
from app.db_models import Project, Dataset, Endpoint
import os
from pathlib import Path

# Path relative to the script execution point
db_path = Path("backend/app/data/apimaker.db").absolute()
engine = create_engine(f"sqlite:///{db_path}")

with Session(engine) as session:
    project = session.exec(select(Project).where(Project.slug == "pokedex-demo")).first()
    if not project:
        print(f"❌ Project 'pokedex-demo' not found in {db_path}")
    else:
        print(f"✅ Found project: {project.name} (ID: {project.id})")
        datasets = session.exec(select(Dataset).where(Dataset.project_id == str(project.id))).all()
        print(f"📦 Datasets found: {len(datasets)}")
        for ds in datasets:
            print(f"  - {ds.name} (ID: {ds.id})")
        
        endpoints = session.exec(select(Endpoint).where(Endpoint.project_id == str(project.id))).all()
        print(f"🛣️ Endpoints found: {len(endpoints)}")
        for ep in endpoints:
            print(f"  - {ep.method} {ep.path} (Target: {ep.target_dataset_id})")
