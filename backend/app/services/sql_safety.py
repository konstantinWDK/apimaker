"""Small guardrails for SQL statements saved by the API builder."""

from __future__ import annotations

import re


class UnsafeSqlError(ValueError):
    """Raised when a saved SQL statement is outside the supported safe subset."""


FORBIDDEN_SQL_KEYWORDS = {
    "alter",
    "attach",
    "create",
    "delete",
    "detach",
    "drop",
    "grant",
    "insert",
    "merge",
    "pragma",
    "replace",
    "revoke",
    "truncate",
    "update",
    "vacuum",
}

NAMED_PARAM_RE = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")
WORD_RE = re.compile(r"\b[A-Za-z_][A-Za-z0-9_]*\b")


def validate_select_statement(statement: str) -> str:
    """Return a stripped statement if it is a single read-only SELECT."""
    sql = statement.strip()
    lowered = sql.lower()
    if not sql:
        raise UnsafeSqlError("SQL statement cannot be empty")
    if not lowered.startswith("select"):
        raise UnsafeSqlError("Only SELECT SQL queries are allowed")
    if ";" in sql:
        raise UnsafeSqlError("Multiple SQL statements are not allowed")
    if "--" in sql or "/*" in sql or "*/" in sql:
        raise UnsafeSqlError("SQL comments are not allowed")

    words = {match.group(0).lower() for match in WORD_RE.finditer(sql)}
    blocked = sorted(words.intersection(FORBIDDEN_SQL_KEYWORDS))
    if blocked:
        raise UnsafeSqlError(f"Forbidden SQL keyword: {blocked[0].upper()}")
    return sql


def extract_named_params(statement: str) -> list[str]:
    """Extract SQLAlchemy-style named bind params from a safe SQL statement."""
    return sorted(set(NAMED_PARAM_RE.findall(statement)))
