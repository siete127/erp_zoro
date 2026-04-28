"""
Handler de Socket.io para el chat interno del ERP.

Patrón idéntico al proyecto de referencia (chatHandler.js):
  - JWT validado en handshake (connect)
  - Presencia en Redis (add/remove connected_user)
  - Sala privada "user_{id}" para notificaciones
  - Sala de canal "chat_{canal_id}" para mensajes de grupo/directo/empresa
  - Mensajes persistidos en SQL Server vía chat_service
"""
from __future__ import annotations

import logging

from app.core.redis_chat import (
    add_connected_user,
    get_all_online_users,
    get_connected_user_socket,
    is_user_connected,
    remove_connected_user,
)
from app.core.security import decode_access_token
from app.core.socketio import make_socket_safe, sio
from app.services import chat_service, notificacion_service

log = logging.getLogger(__name__)

# sid → user_id  (en memoria del proceso; Redis es la fuente de verdad entre instancias)
_sid_to_user: dict[str, int] = {}


def _get_uid(sid: str) -> int | None:
    return _sid_to_user.get(sid)


def _preview_text(msg: dict) -> str:
    contenido = str(msg.get("Contenido") or "").strip()
    if contenido:
        return contenido[:160]

    tipo = str(msg.get("TipoContenido") or "")
    if tipo == "imagen":
        return "Te envio una imagen."
    if tipo == "archivo":
        return "Te envio un archivo."
    return "Tienes un mensaje nuevo."


# ---------------------------------------------------------------------------
# Conexión / desconexión
# ---------------------------------------------------------------------------

@sio.on("connect")
async def on_connect(sid, environ, auth):
    token = (auth or {}).get("token") or ""
    if not token:
        await sio.disconnect(sid)
        return

    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("id") or 0)
        if not user_id:
            raise ValueError("user_id vacío")
    except Exception:
        await sio.disconnect(sid)
        return

    _sid_to_user[sid] = user_id

    # Sala privada para notificaciones (mensajes directos, invitaciones)
    await sio.enter_room(sid, f"user_{user_id}")

    # Registrar presencia en Redis
    add_connected_user(user_id, sid)

    # Notificar a todos que el usuario está online
    await sio.emit("user_status", {"userId": user_id, "online": True})

    log.debug("chat: usuario %s conectado (sid=%s)", user_id, sid)


@sio.on("disconnect")
async def on_disconnect(sid):
    user_id = _sid_to_user.pop(sid, None)
    if not user_id:
        return

    remove_connected_user(user_id, sid)

    # Solo marcar offline si no tiene más sockets activos
    if not is_user_connected(user_id):
        await sio.emit("user_status", {"userId": user_id, "online": False})

    log.debug("chat: usuario %s desconectado (sid=%s)", user_id, sid)


# ---------------------------------------------------------------------------
# Unirse a canal
# ---------------------------------------------------------------------------

@sio.on("chat:join")
async def on_join_canal(sid, data):
    """
    Cliente envía: { canal_id: int }
    El servidor lo mete a la sala "chat_{canal_id}".
    """
    user_id = _get_uid(sid)
    if not user_id:
        return

    canal_id = int((data or {}).get("canal_id", 0))
    if not canal_id:
        return

    await sio.enter_room(sid, f"chat_{canal_id}")
    log.debug("chat: usuario %s se unió a canal %s", user_id, canal_id)


@sio.on("chat:leave")
async def on_leave_canal(sid, data):
    user_id = _get_uid(sid)
    if not user_id:
        return
    canal_id = int((data or {}).get("canal_id", 0))
    if canal_id:
        await sio.leave_room(sid, f"chat_{canal_id}")


# ---------------------------------------------------------------------------
# Enviar mensaje
# ---------------------------------------------------------------------------

@sio.on("chat:send")
async def on_send_message(sid, data):
    """
    Cliente envía:
      { canal_id, contenido, tipo?, archivo_url?, archivo_nombre? }

    Flujo (igual que referencia):
      1. Guardar en BD vía chat_service.save_mensaje
      2. Emitir "chat:mensaje" a todos en la sala del canal
      3. Si hay receptor directo, notificar su sala "user_{id}"
    """
    user_id = _get_uid(sid)
    if not user_id:
        return

    data = data or {}
    canal_id = int(data.get("canal_id", 0))
    contenido = str(data.get("contenido") or "").strip()
    tipo = str(data.get("tipo") or "texto")
    archivo_url = data.get("archivo_url")
    archivo_nombre = data.get("archivo_nombre")

    if not canal_id or (not contenido and not archivo_url):
        await sio.emit("chat:error", {"message": "Datos incompletos"}, to=sid)
        return

    # Construir un current_user mínimo suficiente para el servicio
    current_user = {"User_Id": user_id, "RolId": 1}

    try:
        msg = chat_service.save_mensaje(
            canal_id=canal_id,
            contenido=contenido,
            current_user=current_user,
            tipo=tipo,
            archivo_url=archivo_url,
            archivo_nombre=archivo_nombre,
        )
    except Exception as exc:
        await sio.emit("chat:error", {"message": str(exc)}, to=sid)
        log.error("chat:send error: %s", exc)
        return

    msg_payload = make_socket_safe(msg)

    # Emitir a todos en la sala del canal (incluido emisor)
    await sio.emit("chat:mensaje", msg_payload, room=f"chat_{canal_id}")

    # Reenviar tambien al emisor para cubrir el caso en que mande un mensaje
    # antes de que termine de unirse a la sala del canal.
    await sio.emit("chat:mensaje", msg_payload, to=sid)

    # Notificación en sala privada de cada miembro que NO sea el emisor
    # para actualizar badge de no leídos aunque no estén en la sala del canal
    try:
        from app.db.session import get_connection
        from sqlalchemy import text
        with get_connection() as conn:
            canal = conn.execute(
                text("""
                    SELECT Canal_Id, Nombre, Tipo
                    FROM ERP_CHAT_CANALES
                    WHERE Canal_Id=:cid
                """),
                {"cid": canal_id},
            ).mappings().first()

            miembros = conn.execute(
                text("""
                    SELECT User_Id FROM ERP_CHAT_MIEMBROS
                    WHERE Canal_Id=:cid AND Aceptado=1 AND User_Id<>:uid
                """),
                {"cid": canal_id, "uid": user_id},
            ).fetchall()

        remitente = str(msg_payload.get("RemitenteNombre") or "Alguien").strip()
        canal_tipo = str((canal or {}).get("Tipo") or "").strip()
        canal_nombre = str((canal or {}).get("Nombre") or "Chat").strip()
        preview = _preview_text(msg_payload)

        for (mid,) in miembros:
            await sio.emit(
                "chat:notif",
                make_socket_safe({"canal_id": canal_id, "mensaje": msg_payload}),
                room=f"user_{mid}",
            )

            if canal_tipo == "directo":
                titulo = f"Nuevo mensaje de {remitente}"
            elif canal_tipo == "grupo":
                titulo = f"Nuevo mensaje en {canal_nombre}"
            else:
                titulo = f"Nuevo mensaje en {canal_nombre or 'General'}"

            notificacion_service.create_notification(
                int(mid),
                "chat_mensaje",
                titulo,
                preview,
                "/dashboard",
            )
    except Exception as exc:
        log.warning("chat:send notif error: %s", exc)


# ---------------------------------------------------------------------------
# Typing indicator
# ---------------------------------------------------------------------------

@sio.on("chat:typing")
async def on_typing(sid, data):
    """
    Cliente envía: { canal_id, is_typing }
    Reenvía a los demás de la sala (no al emisor).
    """
    user_id = _get_uid(sid)
    if not user_id:
        return

    data = data or {}
    canal_id = int(data.get("canal_id", 0))
    is_typing = bool(data.get("is_typing", False))

    if canal_id:
        await sio.emit(
            "chat:typing",
            {"user_id": user_id, "canal_id": canal_id, "is_typing": is_typing},
            room=f"chat_{canal_id}",
            skip_sid=sid,
        )


# ---------------------------------------------------------------------------
# Marcar canal como leído
# ---------------------------------------------------------------------------

@sio.on("chat:read")
async def on_mark_read(sid, data):
    """
    Cliente envía: { canal_id }
    Actualiza la tabla ERP_CHAT_LECTURAS.
    """
    user_id = _get_uid(sid)
    if not user_id:
        return

    canal_id = int((data or {}).get("canal_id", 0))
    if not canal_id:
        return

    current_user = {"User_Id": user_id, "RolId": 1}
    try:
        chat_service.marcar_leido(canal_id, current_user)
        await sio.emit("chat:read_ack", {"canal_id": canal_id}, to=sid)
    except Exception as exc:
        log.warning("chat:read error: %s", exc)


# ---------------------------------------------------------------------------
# Consultar usuarios online (utilidad de presencia)
# ---------------------------------------------------------------------------

@sio.on("chat:online_users")
async def on_online_users(sid, _data):
    online = get_all_online_users()
    await sio.emit("chat:online_users", {"users": online}, to=sid)
