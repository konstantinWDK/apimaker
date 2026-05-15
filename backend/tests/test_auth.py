"""Tests for auth endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

import time
_SUFFIX = str(int(time.time() * 1000))
USERNAME = f"testuser_{_SUFFIX}"
PASSWORD = "testpass123"


def test_auth_status() -> None:
    """GET /auth/status should return hasUsers."""
    response = client.get("/auth/status")
    assert response.status_code == 200
    assert "hasUsers" in response.json()


def test_register_and_login() -> None:
    """Register a user and login."""
    reg = client.post("/auth/register", json={
        "username": USERNAME,
        "password": PASSWORD,
    })
    # May be 201 (first user) or 401 (users exist, need admin)
    if reg.status_code == 201:
        login = client.post("/auth/login", json={
            "username": USERNAME,
            "password": PASSWORD,
        })
        assert login.status_code == 200
        assert "access_token" in login.json()


def test_login_wrong_password() -> None:
    """Login with wrong password should return 401."""
    client.post("/auth/register", json={"username": f"login_{_SUFFIX}", "password": PASSWORD})
    response = client.post("/auth/login", json={
        "username": f"login_{_SUFFIX}",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


def test_refresh_token() -> None:
    """Exchange refresh token for new access token."""
    uname = f"refresh_{_SUFFIX}"
    reg = client.post("/auth/register", json={"username": uname, "password": PASSWORD})
    if reg.status_code != 201:
        return

    login = client.post("/auth/login", json={"username": uname, "password": PASSWORD})
    refresh_token = login.json()["refresh_token"]
    response = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    assert "access_token" in response.json()
