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
        # 1. Find the 'pokemon' dataset
        pokemon_ds = session.exec(
            select(Dataset).where(Dataset.project_id == str(project.id), Dataset.name == "pokemon")
        ).first()
        
        if pokemon_ds:
            print(f"🔗 Linking endpoints to dataset '{pokemon_ds.name}' (ID: {pokemon_ds.id})")
            endpoints = session.exec(select(Endpoint).where(Endpoint.project_id == str(project.id))).all()
            for ep in endpoints:
                if "pokemon" in ep.path.lower():
                    ep.target_dataset_id = pokemon_ds.id
                    session.add(ep)
            session.commit()
            print("✅ Endpoints linked successfully")
        
        # 2. Add default endpoints for brands and cars if they don't have any
        for ds_name in ["brands", "cars"]:
            ds = session.exec(
                select(Dataset).where(Dataset.project_id == str(project.id), Dataset.name == ds_name)
            ).first()
            if ds:
                existing = session.exec(
                    select(Endpoint).where(Endpoint.project_id == str(project.id), Endpoint.target_dataset_id == ds.id)
                ).first()
                if not existing:
                    print(f"➕ Adding default GET /{ds_name} for dataset '{ds_name}'")
                    new_ep = Endpoint(
                        project_id=str(project.id),
                        name=f"List {ds_name.capitalize()}",
                        method="GET",
                        path=f"/{ds_name}",
                        operation_type="list",
                        target_dataset_id=ds.id,
                        summary=f"Get all {ds_name}"
                    )
                    session.add(new_ep)
        session.commit()
        print("✨ Project repaired!")
