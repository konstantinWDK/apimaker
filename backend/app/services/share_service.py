"""Share service — create and retrieve shareable project snapshots."""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from ..db_models import Dataset, DatasetField, Endpoint, Project, ShareSnapshot
from ..services.jwt_service import hash_password, verify_password


def create_share_snapshot(
    session: Session,
    project_id: str,
    password: str | None = None,
    expires_days: int = 30,
) -> ShareSnapshot:
    """Create a read-only snapshot of a project for sharing."""
    project = session.get(Project, str(project_id))
    if not project:
        raise KeyError("Project not found")

    # Gather full project data
    dataset = session.exec(
        select(Dataset).where(Dataset.project_id == str(project_id))
    ).first()

    fields = []
    if dataset:
        fields = session.exec(
            select(DatasetField).where(DatasetField.dataset_id == dataset.id)
        ).all()

    endpoints = session.exec(
        select(Endpoint).where(Endpoint.project_id == str(project_id))
    ).all()

    snapshot = {
        "project": {
            "id": project.id,
            "name": project.name,
            "slug": project.slug,
            "description": project.description,
            "target_stack": project.target_stack,
            "status": project.status,
        },
        "dataset": {
            "id": dataset.id if dataset else None,
            "name": dataset.name if dataset else None,
            "source_type": dataset.source_type if dataset else None,
            "fields": [
                {"name": f.name, "type": f.field_type, "required": f.required, "description": f.description}
                for f in fields
            ],
        } if dataset else None,
        "endpoints": [
            {"id": ep.id, "name": ep.name, "method": ep.method, "path": ep.path, "summary": ep.summary}
            for ep in endpoints
        ],
    }

    # Generate unique slug
    slug = f"{project.name.lower().replace(' ', '-')}-{secrets.token_hex(4)}"

    password_hash = None
    if password:
        password_hash = hash_password(password)

    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

    snapshot_model = ShareSnapshot(
        project_id=str(project_id),
        slug=slug,
        snapshot_data=json.dumps(snapshot, ensure_ascii=False),
        password_hash=password_hash,
        expires_at=expires_at,
    )
    session.add(snapshot_model)
    session.commit()
    session.refresh(snapshot_model)
    return snapshot_model


def get_share_snapshot(session: Session, snapshot_id: str, slug: str, password: str | None = None) -> dict:
    """Retrieve a share snapshot by ID and slug."""
    snapshot = session.exec(
        select(ShareSnapshot).where(
            ShareSnapshot.id == snapshot_id,
            ShareSnapshot.slug == slug,
        )
    ).first()

    if not snapshot:
        raise KeyError("Share snapshot not found")

    # Check expiration (both datetimes are already timezone-aware UTC)
    now = datetime.now(timezone.utc)
    if snapshot.expires_at and snapshot.expires_at < now:
        raise ValueError("Share link has expired")

    # Check password if set
    if snapshot.password_hash:
        if not password:
            raise ValueError("Password required")
        if not verify_password(password, snapshot.password_hash):
            raise ValueError("Incorrect password")

    # Increment views
    snapshot.views_count += 1
    session.add(snapshot)
    session.commit()

    data = json.loads(snapshot.snapshot_data)
    data["share_id"] = snapshot.id
    data["share_slug"] = snapshot.slug
    data["share_expires_at"] = snapshot.expires_at.isoformat() if snapshot.expires_at else None
    data["share_views"] = snapshot.views_count
    return data


def list_project_shares(session: Session, project_id: str) -> list[dict]:
    """List all active share snapshots for a project."""
    snapshots = session.exec(
        select(ShareSnapshot).where(ShareSnapshot.project_id == str(project_id))
    ).all()

    result = []
    for s in snapshots:
        expired = s.expires_at and s.expires_at < datetime.now(timezone.utc)
        result.append({
            "id": s.id,
            "slug": s.slug,
            "url": f"/share/{s.id}/{s.slug}",
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "created_at": s.created_at.isoformat(),
            "views_count": s.views_count,
            "has_password": bool(s.password_hash),
            "expired": expired,
        })
    return result


def delete_share_snapshot(session: Session, share_id: str) -> bool:
    """Delete a share snapshot."""
    snapshot = session.get(ShareSnapshot, share_id)
    if not snapshot:
        return False
    session.delete(snapshot)
    session.commit()
    return True


def cleanup_expired_shares(session: Session) -> int:
    """Delete all expired share snapshots. Returns count of deleted shares."""
    now = datetime.now(timezone.utc)
    expired = session.exec(
        select(ShareSnapshot).where(ShareSnapshot.expires_at < now)
    ).all()
    count = len(expired)
    for s in expired:
        session.delete(s)
    session.commit()
    return count
