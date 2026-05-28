"""Tests for saved-query SQL guardrails."""

from __future__ import annotations

import pytest

from app.services.sql_safety import UnsafeSqlError, extract_named_params, validate_select_statement


def test_validate_select_statement_accepts_single_select() -> None:
    assert validate_select_statement("  SELECT id FROM users WHERE email = :email  ") == "SELECT id FROM users WHERE email = :email"


@pytest.mark.parametrize(
    "statement",
    [
        "DELETE FROM users",
        "SELECT * FROM users; DROP TABLE users",
        "SELECT * FROM users -- hidden",
        "SELECT * FROM users /* hidden */",
        "SELECT * FROM users WHERE id IN (UPDATE users SET name = 'x')",
    ],
)
def test_validate_select_statement_rejects_unsafe_sql(statement: str) -> None:
    with pytest.raises(UnsafeSqlError):
        validate_select_statement(statement)


def test_extract_named_params_returns_unique_params() -> None:
    assert extract_named_params("SELECT * FROM users WHERE team_id = :team_id AND role = :role OR owner_id = :team_id") == [
        "role",
        "team_id",
    ]
