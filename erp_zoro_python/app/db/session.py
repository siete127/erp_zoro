from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from app.core.config import settings


engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)


def build_engine(database: str | None = None) -> Engine:
    return create_engine(
        settings.build_database_url(database),
        future=True,
        pool_pre_ping=True,
    )


@contextmanager
def get_connection() -> Iterator[Connection]:
    with engine.connect() as connection:
        yield connection


@contextmanager
def get_transaction() -> Iterator[Connection]:
    with engine.begin() as connection:
        yield connection


def fetch_all(query: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        result = connection.execute(text(query), params or {})
        return [dict(row) for row in result.mappings().all()]


def fetch_one(query: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    rows = fetch_all(query, params)
    return rows[0] if rows else None
