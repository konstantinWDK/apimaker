"""Seed script: create initial admin user and workspace."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, SQLModel, select

from app.db import engine
from app.db_models import User, Workspace, WorkspaceMember
from app.services.jwt_service import hash_password


def seed_admin_user(
    username: str = "admin",
    password: str = "admin",
    email: str | None = None,
) -> None:
    """Create an admin user if no users exist."""
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        existing = session.exec(select(User)).first()
        if existing:
            print(f"[!] User '{existing.username}' already exists. Skipping.")
            return

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        session.add(user)
        session.flush()

        workspace = Workspace(
            name="Default Workspace",
            slug="default",
            owner_id=user.id,
        )
        session.add(workspace)
        session.flush()
        session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        session.commit()

        print(f"[+] Admin user '{username}' created with default workspace.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed initial admin user.")
    parser.add_argument("--username", default="admin", help="Admin username")
    parser.add_argument("--password", default="admin", help="Admin password")
    args = parser.parse_args()
    seed_admin_user(username=args.username, password=args.password)
