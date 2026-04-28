"""
Servicio de chat interno del ERP.

Canales:
  - empresa : canal global de la empresa, todos sus usuarios lo ven
  - directo  : entre dos usuarios, sin aprobación
  - grupo    : requiere que todos los invitados acepten la invitación

Los mensajes se persisten siempre en SQL Server.
Redis solo maneja presencia (quién está online).
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services import notificacion_service


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _uid(user: dict) -> int:
    return int(user.get("User_Id") or user.get("id") or 0)


def _room_name(canal_id: int) -> str:
    """Nombre de sala socket.io para un canal."""
    return f"chat_{canal_id}"


def _direct_room(uid1: int, uid2: int) -> str:
    """Nombre estable para sala de chat directo (misma lógica que el ref)."""
    a, b = sorted([uid1, uid2])
    return f"direct_{a}_{b}"


def _full_name(name: Any, lastname: Any) -> str:
    return f"{str(name or '').strip()} {str(lastname or '').strip()}".strip()


def _decorate_canal_for_user(connection: Any, canal: dict[str, Any], current_user_id: int) -> dict[str, Any]:
    data = dict(canal)
    if data.get("Tipo") != "directo":
        return data

    other_user = connection.execute(
        text(
            """
            SELECT TOP 1
                u.User_Id,
                u.Name,
                u.Lastname,
                u.Username,
                u.Email
            FROM ERP_CHAT_MIEMBROS m
            INNER JOIN ERP_USERS u ON u.User_Id = m.User_Id
            WHERE m.Canal_Id = :canal_id
              AND m.User_Id <> :current_user_id
            ORDER BY u.User_Id
            """
        ),
        {"canal_id": int(data["Canal_Id"]), "current_user_id": current_user_id},
    ).mappings().first()

    if not other_user:
        return data

    other_user_dict = dict(other_user)
    display_name = (
        _full_name(other_user_dict.get("Name"), other_user_dict.get("Lastname"))
        or str(other_user_dict.get("Username") or "").strip()
        or str(other_user_dict.get("Email") or "").strip()
        or str(data.get("Nombre") or "").strip()
    )

    data["NombreTecnico"] = data.get("Nombre")
    data["Nombre"] = display_name
    data["OtroUserId"] = other_user_dict.get("User_Id")
    data["OtroNombreCompleto"] = display_name
    data["OtroUsername"] = other_user_dict.get("Username")
    data["OtroEmail"] = other_user_dict.get("Email")
    return data


# ---------------------------------------------------------------------------
# Canales
# ---------------------------------------------------------------------------

def list_canales(company_id: int, current_user: dict) -> list[dict]:
    uid = _uid(current_user)
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    c.Canal_Id, c.Nombre, c.Tipo, c.Company_Id,
                    c.CreadoPor, c.FechaCreacion, c.Activo,
                    m.Aceptado, m.Rol AS MiRol,
                    -- último mensaje
                    (SELECT TOP 1 Contenido
                       FROM ERP_CHAT_MENSAJES
                      WHERE Canal_Id = c.Canal_Id
                      ORDER BY FechaEnvio DESC) AS UltimoMensaje,
                    (SELECT TOP 1 TipoContenido
                       FROM ERP_CHAT_MENSAJES
                      WHERE Canal_Id = c.Canal_Id
                      ORDER BY FechaEnvio DESC) AS TipoUltimoMensaje,
                    (SELECT TOP 1 FechaEnvio
                       FROM ERP_CHAT_MENSAJES
                      WHERE Canal_Id = c.Canal_Id
                      ORDER BY FechaEnvio DESC) AS FechaUltimoMensaje,
                    -- mensajes no leídos
                    (SELECT COUNT(*)
                       FROM ERP_CHAT_MENSAJES msg
                      WHERE msg.Canal_Id = c.Canal_Id
                        AND msg.FechaEnvio > ISNULL(
                              (SELECT UltimoMensajeLeido
                                 FROM ERP_CHAT_LECTURAS
                                WHERE Canal_Id = c.Canal_Id AND User_Id = :uid),
                              '2000-01-01')
                        AND msg.User_Id <> :uid
                    ) AS NoLeidos
                FROM ERP_CHAT_CANALES c
                JOIN ERP_CHAT_MIEMBROS m ON m.Canal_Id = c.Canal_Id AND m.User_Id = :uid
                WHERE c.Company_Id = :cid AND c.Activo = 1
                  AND (c.Tipo = 'empresa' OR m.Aceptado = 1)
                ORDER BY FechaUltimoMensaje DESC
            """),
            {"uid": uid, "cid": company_id},
        ).mappings().all()
        canales = [_decorate_canal_for_user(conn, dict(r), uid) for r in rows]
    return canales


def get_canal(canal_id: int, current_user: dict) -> dict:
    uid = _uid(current_user)
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT c.*, m.Aceptado, m.Rol AS MiRol
                FROM ERP_CHAT_CANALES c
                JOIN ERP_CHAT_MIEMBROS m ON m.Canal_Id = c.Canal_Id AND m.User_Id = :uid
                WHERE c.Canal_Id = :cid
            """),
            {"uid": uid, "cid": canal_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Canal no encontrado o sin acceso")
        return _decorate_canal_for_user(conn, dict(row), uid)


def create_canal_directo(other_user_id: int, company_id: int, current_user: dict) -> dict:
    """Crea o devuelve el canal directo entre dos usuarios."""
    uid = _uid(current_user)
    if uid == other_user_id:
        raise HTTPException(status_code=400, detail="No puedes chatear contigo mismo")

    with get_connection() as conn:
        # Ver si ya existe
        existing = conn.execute(
            text("""
                SELECT c.Canal_Id
                FROM ERP_CHAT_CANALES c
                JOIN ERP_CHAT_MIEMBROS m1 ON m1.Canal_Id = c.Canal_Id AND m1.User_Id = :uid1
                JOIN ERP_CHAT_MIEMBROS m2 ON m2.Canal_Id = c.Canal_Id AND m2.User_Id = :uid2
                WHERE c.Tipo = 'directo' AND c.Company_Id = :cid AND c.Activo = 1
            """),
            {"uid1": uid, "uid2": other_user_id, "cid": company_id},
        ).mappings().first()

    if existing:
        return get_canal(int(existing["Canal_Id"]), current_user)

    # Crear nuevo canal directo
    with get_transaction() as conn:
        canal = conn.execute(
            text("""
                INSERT INTO ERP_CHAT_CANALES (Nombre, Tipo, Company_Id, CreadoPor, Activo)
                OUTPUT INSERTED.*
                VALUES (:nombre, 'directo', :cid, :creador, 1)
            """),
            {"nombre": f"directo_{uid}_{other_user_id}", "cid": company_id, "creador": uid},
        ).mappings().first()
        canal_id = int(canal["Canal_Id"])

        # Agregar ambos miembros
        for member_id in [uid, other_user_id]:
            conn.execute(
                text("""
                    INSERT INTO ERP_CHAT_MIEMBROS
                        (Canal_Id, User_Id, Rol, Aceptado, FechaInvitacion, FechaAceptacion)
                    VALUES (:cid, :uid, 'miembro', 1, GETDATE(), GETDATE())
                """),
                {"cid": canal_id, "uid": member_id},
            )

    return get_canal(canal_id, current_user)


def create_canal_grupo(nombre: str, invitados: list[int], company_id: int, current_user: dict) -> dict:
    """Crea un canal de grupo. Los invitados deben aceptar antes de entrar."""
    uid = _uid(current_user)
    if not nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre del grupo es requerido")

    with get_transaction() as conn:
        canal = conn.execute(
            text("""
                INSERT INTO ERP_CHAT_CANALES (Nombre, Tipo, Company_Id, CreadoPor, Activo)
                OUTPUT INSERTED.*
                VALUES (:nombre, 'grupo', :cid, :creador, 1)
            """),
            {"nombre": nombre.strip(), "cid": company_id, "creador": uid},
        ).mappings().first()
        canal_id = int(canal["Canal_Id"])

        # El creador entra directamente como admin
        conn.execute(
            text("""
                INSERT INTO ERP_CHAT_MIEMBROS
                    (Canal_Id, User_Id, Rol, Aceptado, FechaInvitacion, FechaAceptacion)
                VALUES (:cid, :uid, 'admin', 1, GETDATE(), GETDATE())
            """),
            {"cid": canal_id, "uid": uid},
        )

        # Los invitados quedan pendientes (Aceptado=0)
        for inv_id in invitados:
            if inv_id == uid:
                continue
            conn.execute(
                text("""
                    INSERT INTO ERP_CHAT_MIEMBROS
                        (Canal_Id, User_Id, Rol, Aceptado, FechaInvitacion)
                    VALUES (:cid, :uid, 'miembro', 0, GETDATE())
                """),
                {"cid": canal_id, "uid": inv_id},
            )

    creador_nombre = str(
        current_user.get("Username")
        or current_user.get("Name")
        or current_user.get("FullName")
        or "Alguien"
    ).strip()

    for inv_id in invitados:
        if inv_id == uid:
            continue
        notificacion_service.create_notification(
            int(inv_id),
            "chat_invitacion",
            f"Invitacion a grupo: {nombre.strip()}",
            f"{creador_nombre} te invito al grupo {nombre.strip()}.",
            "/dashboard",
            dedupe_hours=24,
        )

    return get_canal(canal_id, current_user)


def get_or_create_canal_empresa(company_id: int, current_user: dict) -> dict:
    """Canal 'empresa' único por company. Lo crea si no existe."""
    uid = _uid(current_user)
    with get_connection() as conn:
        canal = conn.execute(
            text("""
                SELECT TOP 1 Canal_Id FROM ERP_CHAT_CANALES
                WHERE Tipo = 'empresa' AND Company_Id = :cid AND Activo = 1
            """),
            {"cid": company_id},
        ).mappings().first()

    if not canal:
        with get_transaction() as conn:
            canal = conn.execute(
                text("""
                    INSERT INTO ERP_CHAT_CANALES (Nombre, Tipo, Company_Id, CreadoPor, Activo)
                    OUTPUT INSERTED.*
                    VALUES ('General', 'empresa', :cid, :creador, 1)
                """),
                {"cid": company_id, "creador": uid},
            ).mappings().first()
            canal_id = int(canal["Canal_Id"])
    else:
        canal_id = int(canal["Canal_Id"])

    # Asegurar que el usuario es miembro
    with get_transaction() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM ERP_CHAT_MIEMBROS WHERE Canal_Id=:cid AND User_Id=:uid"),
            {"cid": canal_id, "uid": uid},
        ).fetchone()
        if not exists:
            conn.execute(
                text("""
                    INSERT INTO ERP_CHAT_MIEMBROS
                        (Canal_Id, User_Id, Rol, Aceptado, FechaInvitacion, FechaAceptacion)
                    VALUES (:cid, :uid, 'miembro', 1, GETDATE(), GETDATE())
                """),
                {"cid": canal_id, "uid": uid},
            )

    return get_canal(canal_id, current_user)


def aceptar_invitacion(canal_id: int, current_user: dict) -> dict:
    uid = _uid(current_user)
    with get_transaction() as conn:
        row = conn.execute(
            text("SELECT * FROM ERP_CHAT_MIEMBROS WHERE Canal_Id=:cid AND User_Id=:uid"),
            {"cid": canal_id, "uid": uid},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        if row["Aceptado"]:
            raise HTTPException(status_code=400, detail="Ya eres miembro de este canal")

        conn.execute(
            text("""
                UPDATE ERP_CHAT_MIEMBROS
                   SET Aceptado=1, FechaAceptacion=GETDATE()
                 WHERE Canal_Id=:cid AND User_Id=:uid
            """),
            {"cid": canal_id, "uid": uid},
        )
    return {"msg": "Invitación aceptada"}


def get_invitaciones_pendientes(current_user: dict) -> list[dict]:
    uid = _uid(current_user)
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT c.Canal_Id, c.Nombre, c.Tipo, c.Company_Id, m.FechaInvitacion,
                       u.Name + ' ' + u.Lastname AS CreadoPorNombre
                FROM ERP_CHAT_MIEMBROS m
                JOIN ERP_CHAT_CANALES c ON c.Canal_Id = m.Canal_Id
                JOIN ERP_USERS u ON u.User_Id = c.CreadoPor
                WHERE m.User_Id = :uid AND m.Aceptado = 0 AND c.Activo = 1
                ORDER BY m.FechaInvitacion DESC
            """),
            {"uid": uid},
        ).mappings().all()
    return [dict(r) for r in rows]


def get_miembros_canal(canal_id: int, current_user: dict) -> list[dict]:
    uid = _uid(current_user)
    with get_connection() as conn:
        # Verificar acceso
        access = conn.execute(
            text("SELECT 1 FROM ERP_CHAT_MIEMBROS WHERE Canal_Id=:cid AND User_Id=:uid AND Aceptado=1"),
            {"cid": canal_id, "uid": uid},
        ).fetchone()
        if not access:
            raise HTTPException(status_code=403, detail="Sin acceso al canal")

        rows = conn.execute(
            text("""
                SELECT m.*, u.Name + ' ' + u.Lastname AS NombreCompleto, u.Name, u.Lastname
                FROM ERP_CHAT_MIEMBROS m
                JOIN ERP_USERS u ON u.User_Id = m.User_Id
                WHERE m.Canal_Id = :cid
                ORDER BY m.Rol DESC, u.Name
            """),
            {"cid": canal_id},
        ).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Mensajes
# ---------------------------------------------------------------------------

def get_mensajes(canal_id: int, current_user: dict, limit: int = 50, before_id: int | None = None) -> list[dict]:
    uid = _uid(current_user)
    with get_connection() as conn:
        access = conn.execute(
            text("SELECT 1 FROM ERP_CHAT_MIEMBROS WHERE Canal_Id=:cid AND User_Id=:uid AND Aceptado=1"),
            {"cid": canal_id, "uid": uid},
        ).fetchone()
        if not access:
            raise HTTPException(status_code=403, detail="Sin acceso al canal")

        params: dict[str, Any] = {"cid": canal_id, "limit": limit}
        before_clause = ""
        if before_id:
            before_clause = "AND m.Mensaje_Id < :before_id"
            params["before_id"] = before_id

        rows = conn.execute(
            text(f"""
                SELECT TOP (:limit)
                    m.*,
                    u.Name + ' ' + u.Lastname AS RemitenteNombre,
                    u.Name AS RemitenteNameRaw
                FROM ERP_CHAT_MENSAJES m
                JOIN ERP_USERS u ON u.User_Id = m.User_Id
                WHERE m.Canal_Id = :cid {before_clause}
                ORDER BY m.FechaEnvio DESC
            """),
            params,
        ).mappings().all()

    # Devolver en orden cronológico
    return [dict(r) for r in reversed(rows)]


def save_mensaje(canal_id: int, contenido: str, current_user: dict,
                 tipo: str = "texto", archivo_url: str | None = None,
                 archivo_nombre: str | None = None) -> dict:
    uid = _uid(current_user)
    with get_connection() as conn:
        access = conn.execute(
            text("SELECT 1 FROM ERP_CHAT_MIEMBROS WHERE Canal_Id=:cid AND User_Id=:uid AND Aceptado=1"),
            {"cid": canal_id, "uid": uid},
        ).fetchone()
        if not access:
            raise HTTPException(status_code=403, detail="Sin acceso al canal")

    with get_transaction() as conn:
        msg = conn.execute(
            text("""
                INSERT INTO ERP_CHAT_MENSAJES
                    (Canal_Id, User_Id, Contenido, TipoContenido, ArchivoUrl, ArchivoNombre, FechaEnvio)
                OUTPUT INSERTED.*
                VALUES (:cid, :uid, :contenido, :tipo, :url, :nombre, GETDATE())
            """),
            {
                "cid": canal_id, "uid": uid,
                "contenido": contenido or "",
                "tipo": tipo,
                "url": archivo_url,
                "nombre": archivo_nombre,
            },
        ).mappings().first()

    # Decorar con nombre del remitente
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT m.*, u.Name + ' ' + u.Lastname AS RemitenteNombre
                FROM ERP_CHAT_MENSAJES m
                JOIN ERP_USERS u ON u.User_Id = m.User_Id
                WHERE m.Mensaje_Id = :mid
            """),
            {"mid": int(msg["Mensaje_Id"])},
        ).mappings().first()
    return dict(row)


# ---------------------------------------------------------------------------
# Lecturas
# ---------------------------------------------------------------------------

def get_contactos(company_id: int, current_user: dict) -> list[dict]:
    """Lista todos los usuarios activos de la empresa como contactos."""
    uid = _uid(current_user)
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    u.User_Id,
                    u.Name,
                    u.Lastname,
                    u.Name + ' ' + u.Lastname AS NombreCompleto,
                    u.Username,
                    u.Email,
                    r.Name AS RolName
                FROM ERP_USERS u
                LEFT JOIN ERP_ROL r ON r.Rol_Id = u.RolId
                WHERE u.IsActive = 1
                  AND u.User_Id <> :uid
                  AND EXISTS (
                      SELECT 1 FROM ERP_USERCOMPANIES cu
                       WHERE cu.User_Id = u.User_Id AND cu.Company_Id = :cid
                  )
                ORDER BY u.Name, u.Lastname
            """),
            {"uid": uid, "cid": company_id},
        ).mappings().all()
    return [dict(r) for r in rows]


def marcar_leido(canal_id: int, current_user: dict) -> dict:
    uid = _uid(current_user)
    with get_transaction() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM ERP_CHAT_LECTURAS WHERE Canal_Id=:cid AND User_Id=:uid"),
            {"cid": canal_id, "uid": uid},
        ).fetchone()
        if exists:
            conn.execute(
                text("""
                    UPDATE ERP_CHAT_LECTURAS
                       SET UltimoMensajeLeido=GETDATE(), FechaLectura=GETDATE()
                     WHERE Canal_Id=:cid AND User_Id=:uid
                """),
                {"cid": canal_id, "uid": uid},
            )
        else:
            conn.execute(
                text("""
                    INSERT INTO ERP_CHAT_LECTURAS (Canal_Id, User_Id, UltimoMensajeLeido, FechaLectura)
                    VALUES (:cid, :uid, GETDATE(), GETDATE())
                """),
                {"cid": canal_id, "uid": uid},
            )
    return {"msg": "ok"}
