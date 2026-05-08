"""Simple credential storage for the builder UI."""

from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from typing import TypedDict

DATA_DIR = Path(__file__).resolve().parent / "data"
AUTH_FILE = DATA_DIR / "auth.json"
_SALT = "::apimaker"


class Credentials(TypedDict):
    username: str
    password_hash: str


def _hash_password(raw: str) -> str:
    return sha256(f"{raw}{_SALT}".encode("utf-8")).hexdigest()


DEFAULT_CREDENTIALS: Credentials = {
    "username": "admin",
    "password_hash": _hash_password("admin"),
}


def _ensure_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not AUTH_FILE.exists():
        AUTH_FILE.write_text(json.dumps(DEFAULT_CREDENTIALS))


def load_credentials() -> Credentials:
    _ensure_file()
    try:
        data = json.loads(AUTH_FILE.read_text())
        return {
            "username": data.get("username", DEFAULT_CREDENTIALS["username"]),
            "password_hash": data.get("password_hash", DEFAULT_CREDENTIALS["password_hash"]),
        }
    except (json.JSONDecodeError, OSError):
        AUTH_FILE.write_text(json.dumps(DEFAULT_CREDENTIALS))
        return DEFAULT_CREDENTIALS


def save_credentials(username: str, password_hash: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload: Credentials = {"username": username, "password_hash": password_hash}
    AUTH_FILE.write_text(json.dumps(payload))


def verify_credentials(username: str, password: str) -> bool:
    stored = load_credentials()
    return stored["username"] == username and stored["password_hash"] == _hash_password(password)


def update_credentials(username: str, password: str) -> None:
    save_credentials(username, _hash_password(password))


def reset_credentials() -> None:
    save_credentials(DEFAULT_CREDENTIALS["username"], DEFAULT_CREDENTIALS["password_hash"])


def must_change_credentials() -> bool:
    stored = load_credentials()
    return stored == DEFAULT_CREDENTIALS
