"""
Módulo Redis para presencia de usuarios y cache del chat.

Mismo patrón que el proyecto de referencia (ioredis), adaptado a redis-py.
Redis NO almacena mensajes — solo estado de conexión (quién está online).
Los mensajes siempre van a SQL Server.

Si Redis no está disponible el servidor sigue funcionando — solo sin
indicadores de presencia en tiempo real.
"""
from __future__ import annotations

import json
import logging
from typing import Any

try:
    import redis as _redis
    _REDIS_AVAILABLE_MODULE = True
except ImportError:
    _REDIS_AVAILABLE_MODULE = False

from app.core.config import settings

log = logging.getLogger(__name__)

_client: Any = None
redis_available = False


def _build_client() -> Any:
    if not _REDIS_AVAILABLE_MODULE:
        return None
    try:
        r = _redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or None,
            db=settings.redis_db,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        r.ping()
        return r
    except Exception as exc:
        log.warning("Redis no disponible: %s — el chat funcionará sin presencia.", exc)
        return None


def _get_client() -> Any:
    global _client, redis_available
    if _client is None:
        _client = _build_client()
        redis_available = _client is not None
    return _client


# ---------------------------------------------------------------------------
# Presencia de usuarios (mismo esquema que el proyecto de referencia)
# Hash "connected_users"  → userId → socketId
# Set  "user_sockets:{id}"→ todos los socketIds del usuario
# Set  "online_users"     → todos los userIds online
# ---------------------------------------------------------------------------

def add_connected_user(user_id: int | str, socket_id: str) -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        uid = str(user_id)
        r.hset("connected_users", uid, socket_id)
        r.sadd(f"user_sockets:{uid}", socket_id)
        r.sadd("online_users", uid)
        return True
    except Exception as exc:
        log.error("add_connected_user error: %s", exc)
        return False


def remove_connected_user(user_id: int | str, socket_id: str | None = None) -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        uid = str(user_id)
        if socket_id:
            r.srem(f"user_sockets:{uid}", socket_id)
            remaining = r.scard(f"user_sockets:{uid}")
            if remaining > 0:
                replacement = r.srandmember(f"user_sockets:{uid}")
                if replacement:
                    r.hset("connected_users", uid, replacement)
                return True
        r.hdel("connected_users", uid)
        r.delete(f"user_sockets:{uid}")
        r.srem("online_users", uid)
        return True
    except Exception as exc:
        log.error("remove_connected_user error: %s", exc)
        return False


def get_connected_user_socket(user_id: int | str) -> str | None:
    r = _get_client()
    if not r:
        return None
    try:
        return r.hget("connected_users", str(user_id))
    except Exception:
        return None


def is_user_connected(user_id: int | str) -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        return r.scard(f"user_sockets:{user_id}") > 0
    except Exception:
        return False


def get_all_online_users() -> list[str]:
    r = _get_client()
    if not r:
        return []
    try:
        return list(r.smembers("online_users"))
    except Exception:
        return []


def clear_all_connected_users() -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        r.delete("connected_users", "online_users")
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Cache genérico (key-value con TTL)
# ---------------------------------------------------------------------------

def get_cache(key: str) -> Any | None:
    r = _get_client()
    if not r:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set_cache(key: str, value: Any, ttl: int = 300) -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception:
        return False


def delete_cache(key: str) -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        r.delete(key)
        return True
    except Exception:
        return False
