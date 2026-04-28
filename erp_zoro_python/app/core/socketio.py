from __future__ import annotations

import asyncio
from typing import Any

import socketio
from fastapi.encoders import jsonable_encoder

from app.core.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


def make_socket_safe(data: Any = None) -> Any:
    try:
        return jsonable_encoder(data or {})
    except Exception:
        return data or {}


@sio.event
async def connect(sid, environ):
    pass


@sio.event
async def disconnect(sid):
    pass


async def emit(event: str, data: Any = None) -> None:
    try:
        await sio.emit(event, make_socket_safe(data))
    except Exception:
        pass


async def emit_room(event: str, room: str, data: Any = None) -> None:
    try:
        await sio.emit(event, make_socket_safe(data), room=room)
    except Exception:
        pass


def emit_background(event: str, data: Any = None) -> None:
    """Emite un evento Socket.io desde codigo sincronico."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(emit(event, data))
    except Exception:
        pass


def emit_background_room(event: str, room: str, data: Any = None) -> None:
    """Emite un evento Socket.io a una sala especifica desde codigo sincronico."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(emit_room(event, room, data))
    except Exception:
        pass
