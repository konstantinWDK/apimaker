"""Webhook management routes."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Webhook as DBWebhook
from ..security import CurrentUser, get_current_user_from_header

router = APIRouter(prefix="/projects/{project_id}/webhooks", tags=["webhooks"])


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    created_at: str


class CreateWebhookRequest(BaseModel):
    url: str
    events: list[Literal["create", "update", "delete"]]


class UpdateWebhookRequest(BaseModel):
    url: str | None = None
    events: list[Literal["create", "update", "delete"]] | None = None
    is_active: bool | None = None


@router.get("", response_model=list[WebhookResponse])
def list_webhooks(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> list[WebhookResponse]:
    from ..services.project_service import project_service
    resolved_id = project_service.resolve_id(session, project_id)
    webhooks = session.exec(
        select(DBWebhook).where(DBWebhook.project_id == str(resolved_id))
    ).all()
    return [
        WebhookResponse(
            id=w.id,
            url=w.url,
            events=json.loads(w.events) if isinstance(w.events, str) else w.events,
            is_active=w.is_active,
            created_at=w.created_at.isoformat(),
        )
        for w in webhooks
    ]


@router.post("", response_model=WebhookResponse, status_code=201)
def create_webhook(
    project_id: str,
    payload: CreateWebhookRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> WebhookResponse:
    from ..services.project_service import project_service
    resolved_id = project_service.resolve_id(session, project_id)
    webhook = DBWebhook(
        project_id=str(resolved_id),
        url=payload.url,
        events=json.dumps(payload.events),
    )
    session.add(webhook)
    session.commit()
    session.refresh(webhook)
    return WebhookResponse(
        id=webhook.id,
        url=webhook.url,
        events=payload.events,
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat(),
    )


@router.patch("/{webhook_id}", response_model=WebhookResponse)
def update_webhook(
    project_id: str,
    webhook_id: str,
    payload: UpdateWebhookRequest,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> WebhookResponse:
    webhook = session.get(DBWebhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if payload.url is not None:
        webhook.url = payload.url
    if payload.events is not None:
        webhook.events = json.dumps(payload.events)
    if payload.is_active is not None:
        webhook.is_active = payload.is_active
    webhook.updated_at = datetime.now(timezone.utc)
    session.add(webhook)
    session.commit()
    session.refresh(webhook)
    return WebhookResponse(
        id=webhook.id,
        url=webhook.url,
        events=json.loads(webhook.events) if isinstance(webhook.events, str) else webhook.events,
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat(),
    )


@router.delete("/{webhook_id}", status_code=204, response_model=None)
def delete_webhook(
    project_id: str,
    webhook_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
) -> None:
    webhook = session.get(DBWebhook, webhook_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    session.delete(webhook)
    session.commit()


# ─── Webhook dispatcher (called by mock server) ────────────────

async def dispatch_webhooks(
    session: Session,
    project_id: str,
    event: str,
    payload: dict,
) -> None:
    """Dispatch a webhook event to all active webhooks for a project."""
    webhooks = session.exec(
        select(DBWebhook).where(
            DBWebhook.project_id == project_id,
            DBWebhook.is_active == True,
        )
    ).all()

    for wh in webhooks:
        events = json.loads(wh.events) if isinstance(wh.events, str) else wh.events
        if event not in events:
            continue

        body = {
            "event": event,
            "project_id": project_id,
            "data": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(wh.url, json=body)
                logging.info(f"Webhook {wh.id} -> {wh.url}: {resp.status_code}")
        except Exception as e:
            logging.warning(f"Webhook {wh.id} -> {wh.url} failed: {e}")
