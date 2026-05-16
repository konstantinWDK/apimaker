"""Webhook management routes."""

from __future__ import annotations

import ipaddress
import json
import logging
import socket
import urllib.parse
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..db_models import Webhook as DBWebhook, WebhookDelivery
from ..db_models import Project as DBProject
from ..security import CurrentUser, get_current_user_from_header, require_project_access
from ..services.product_ops import create_runtime_log, json_dumps

router = APIRouter(prefix="/projects/{project_id}/webhooks", tags=["webhooks"])


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    created_at: str


class WebhookDeliveryResponse(BaseModel):
    id: str
    webhook_id: str
    event: str
    status: str
    status_code: int | None = None
    error: str | None = None
    created_at: str


class CreateWebhookRequest(BaseModel):
    url: str
    events: list[Literal["create", "update", "delete"]]


class UpdateWebhookRequest(BaseModel):
    url: str | None = None
    events: list[Literal["create", "update", "delete"]] | None = None
    is_active: bool | None = None


def _validate_webhook_url(url: str) -> bool:
    """Validate webhook URL to prevent SSRF attacks.

    Only allows HTTPS (or HTTP to localhost in dev mode).
    Blocks private/internal IP ranges.
    """
    parsed = urllib.parse.urlparse(url)
    if not parsed.netloc:
        raise HTTPException(status_code=422, detail="Invalid webhook URL: no hostname")

    scheme = parsed.scheme
    if scheme == "https":
        pass
    elif scheme == "http":
        from ..config import get_settings
        settings = get_settings()
        if settings.environment != "development":
            raise HTTPException(status_code=422, detail="Only HTTPS URLs are allowed for webhooks")
        host = parsed.hostname or ""
        if host not in ("localhost", "127.0.0.1", "::1"):
            raise HTTPException(status_code=422, detail="HTTP webhook URLs are only allowed for localhost in development mode")
    else:
        raise HTTPException(status_code=422, detail="Only HTTPS URLs are allowed for webhooks")

    hostname = parsed.hostname or ""
    try:
        ips = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=422, detail=f"Could not resolve webhook host: {hostname}")

    for _, _, _, _, addr in ips:
        ip_str = addr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
            raise HTTPException(status_code=422, detail=f"Webhook URL points to a private/internal IP: {ip_str}")

    return True


@router.get("", response_model=list[WebhookResponse])
def list_webhooks(
    project_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    _project: DBProject = Depends(require_project_access),
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
    _project: DBProject = Depends(require_project_access),
) -> WebhookResponse:
    from ..services.project_service import project_service
    resolved_id = project_service.resolve_id(session, project_id)
    _validate_webhook_url(payload.url)
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
    project: DBProject = Depends(require_project_access),
) -> WebhookResponse:
    webhook = session.get(DBWebhook, webhook_id)
    if not webhook or webhook.project_id != project.id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if payload.url is not None:
        _validate_webhook_url(payload.url)
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
    project: DBProject = Depends(require_project_access),
) -> None:
    webhook = session.get(DBWebhook, webhook_id)
    if not webhook or webhook.project_id != project.id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    session.delete(webhook)
    session.commit()


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryResponse])
def list_deliveries(
    project_id: str,
    webhook_id: str,
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user_from_header),
    project: DBProject = Depends(require_project_access),
) -> list[WebhookDeliveryResponse]:
    rows = session.exec(
        select(WebhookDelivery)
        .where(WebhookDelivery.project_id == project.id, WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(100)
    ).all()
    return [
        WebhookDeliveryResponse(
            id=row.id,
            webhook_id=row.webhook_id,
            event=row.event,
            status=row.status,
            status_code=row.status_code,
            error=row.error,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


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
        delivery = WebhookDelivery(
            webhook_id=wh.id,
            project_id=project_id,
            event=event,
            status="pending",
            request_body=json_dumps(body),
        )
        session.add(delivery)
        session.commit()

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(wh.url, json=body)
                delivery.status = "success" if 200 <= resp.status_code < 300 else "failed"
                delivery.status_code = resp.status_code
                delivery.response_body = resp.text[:1000]
                session.add(delivery)
                session.commit()
                create_runtime_log(
                    session,
                    project_id,
                    "webhook.delivered",
                    status_code=resp.status_code,
                    message=wh.url,
                    metadata={"webhook_id": wh.id, "delivery_id": delivery.id, "event": event},
                )
                logging.info(f"Webhook {wh.id} -> {wh.url}: {resp.status_code}")
        except Exception as e:
            delivery.status = "failed"
            delivery.error = str(e)[:500]
            session.add(delivery)
            session.commit()
            create_runtime_log(
                session,
                project_id,
                "webhook.failed",
                message=wh.url,
                metadata={"webhook_id": wh.id, "delivery_id": delivery.id, "event": event, "error": str(e)},
            )
            logging.warning(f"Webhook {wh.id} -> {wh.url} failed: {e}")
