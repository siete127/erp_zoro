from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.socketio import emit_background_room
from app.db.session import get_connection, get_transaction


def _current_user_id(user: dict[str, Any] | None) -> int:
    if not user:
        return 0
    return int(user.get("User_Id") or user.get("id") or 0)


def _safe_limit(limit: int | None) -> int:
    value = int(limit or 20)
    return max(1, min(value, 100))


def _normalize_link(link: str | None) -> str | None:
    value = str(link or "").strip()
    return value or None


def _is_missing_notifications_table(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    return "erp_notificaciones" in message and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
    )


def _unread_total(connection: Any, user_id: int) -> int:
    total = connection.execute(
        text(
            """
            SELECT COUNT(*)
            FROM ERP_NOTIFICACIONES
            WHERE User_Id = :user_id AND ISNULL(Leida, 0) = 0
            """
        ),
        {"user_id": user_id},
    ).scalar()
    return int(total or 0)


def _factura_folio(factura: dict[str, Any]) -> str:
    serie = str(factura.get("Serie") or "").strip()
    folio = str(factura.get("Folio") or "").strip()
    if serie or folio:
        return f"{serie}{folio}".strip() or f"Factura {factura.get('Factura_Id')}"
    if factura.get("UUID"):
        return str(factura["UUID"])
    return f"Factura {factura.get('Factura_Id')}"


def list_notificaciones(
    current_user: dict[str, Any],
    limit: int = 20,
    solo_no_leidas: bool = False,
) -> dict[str, Any]:
    user_id = _current_user_id(current_user)
    limit = _safe_limit(limit)
    where = "User_Id = :user_id"
    params: dict[str, Any] = {"user_id": user_id}

    if solo_no_leidas:
        where += " AND ISNULL(Leida, 0) = 0"

    try:
        with get_connection() as connection:
            total_no_leidas = _unread_total(connection, user_id)
            rows = connection.execute(
                text(
                    f"""
                    SELECT TOP {limit}
                        Notif_Id,
                        User_Id,
                        Tipo,
                        Titulo,
                        Cuerpo,
                        CAST(ISNULL(Leida, 0) AS BIT) AS Leida,
                        Link,
                        FechaCreacion
                    FROM ERP_NOTIFICACIONES
                    WHERE {where}
                    ORDER BY FechaCreacion DESC, Notif_Id DESC
                    """
                ),
                params,
            ).mappings().all()
    except Exception as exc:
        if _is_missing_notifications_table(exc):
            return {"items": [], "total_no_leidas": 0}
        raise

    return {
        "items": [dict(row) for row in rows],
        "total_no_leidas": total_no_leidas,
    }


def mark_read(notif_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    user_id = _current_user_id(current_user)

    try:
        with get_transaction() as connection:
            exists = connection.execute(
                text(
                    """
                    SELECT Notif_Id
                    FROM ERP_NOTIFICACIONES
                    WHERE Notif_Id = :notif_id AND User_Id = :user_id
                    """
                ),
                {"notif_id": notif_id, "user_id": user_id},
            ).first()
            if not exists:
                raise HTTPException(status_code=404, detail="Notificacion no encontrada")

            connection.execute(
                text(
                    """
                    UPDATE ERP_NOTIFICACIONES
                    SET Leida = 1
                    WHERE Notif_Id = :notif_id AND User_Id = :user_id
                    """
                ),
                {"notif_id": notif_id, "user_id": user_id},
            )
            total_no_leidas = _unread_total(connection, user_id)
    except Exception as exc:
        if _is_missing_notifications_table(exc):
            return {"msg": "Notificaciones no inicializadas", "total_no_leidas": 0}
        raise

    return {
        "msg": "Notificacion marcada como leida",
        "total_no_leidas": total_no_leidas,
    }


def mark_all_read(current_user: dict[str, Any]) -> dict[str, Any]:
    user_id = _current_user_id(current_user)

    try:
        with get_transaction() as connection:
            connection.execute(
                text(
                    """
                    UPDATE ERP_NOTIFICACIONES
                    SET Leida = 1
                    WHERE User_Id = :user_id AND ISNULL(Leida, 0) = 0
                    """
                ),
                {"user_id": user_id},
            )
    except Exception as exc:
        if _is_missing_notifications_table(exc):
            return {"msg": "Notificaciones no inicializadas", "total_no_leidas": 0}
        raise

    return {
        "msg": "Notificaciones marcadas como leidas",
        "total_no_leidas": 0,
    }


def create_notification(
    user_id: int,
    tipo: str,
    titulo: str,
    cuerpo: str,
    link: str | None = None,
    *,
    dedupe_hours: int | None = None,
) -> dict[str, Any] | None:
    user_id = int(user_id or 0)
    titulo = str(titulo or "").strip()
    cuerpo = str(cuerpo or "").strip()
    tipo = str(tipo or "general").strip() or "general"
    link = _normalize_link(link)

    if not user_id or not titulo:
        return None

    try:
        with get_transaction() as connection:
            if dedupe_hours and int(dedupe_hours) > 0:
                existing = connection.execute(
                    text(
                        """
                        SELECT TOP 1 Notif_Id
                        FROM ERP_NOTIFICACIONES
                        WHERE User_Id = :user_id
                          AND Tipo = :tipo
                          AND Titulo = :titulo
                          AND Cuerpo = :cuerpo
                          AND ISNULL(Link, '') = ISNULL(:link, '')
                          AND FechaCreacion >= DATEADD(HOUR, -:dedupe_hours, GETDATE())
                        ORDER BY FechaCreacion DESC, Notif_Id DESC
                        """
                    ),
                    {
                        "user_id": user_id,
                        "tipo": tipo,
                        "titulo": titulo,
                        "cuerpo": cuerpo,
                        "link": link,
                        "dedupe_hours": int(dedupe_hours),
                    },
                ).first()
                if existing:
                    return None

            inserted = connection.execute(
                text(
                    """
                    INSERT INTO ERP_NOTIFICACIONES (
                        User_Id,
                        Tipo,
                        Titulo,
                        Cuerpo,
                        Leida,
                        Link,
                        FechaCreacion
                    )
                    OUTPUT
                        INSERTED.Notif_Id,
                        INSERTED.User_Id,
                        INSERTED.Tipo,
                        INSERTED.Titulo,
                        INSERTED.Cuerpo,
                        CAST(ISNULL(INSERTED.Leida, 0) AS BIT) AS Leida,
                        INSERTED.Link,
                        INSERTED.FechaCreacion
                    VALUES (
                        :user_id,
                        :tipo,
                        :titulo,
                        :cuerpo,
                        0,
                        :link,
                        GETDATE()
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "tipo": tipo,
                    "titulo": titulo,
                    "cuerpo": cuerpo,
                    "link": link,
                },
            ).mappings().first()
            if not inserted:
                return None

            notification = dict(inserted)
            notification["TotalNoLeidas"] = _unread_total(connection, user_id)
    except Exception as exc:
        if _is_missing_notifications_table(exc):
            return None
        return None

    emit_background_room("notificacion:nueva", f"user_{user_id}", notification)
    return notification


def notify_company_users(
    company_id: int,
    *,
    tipo: str,
    titulo: str,
    cuerpo: str,
    link: str | None = None,
    exclude_user_ids: set[int] | None = None,
    dedupe_hours: int | None = None,
) -> int:
    company_id = int(company_id or 0)
    if not company_id:
        return 0

    excluded = {int(user_id) for user_id in (exclude_user_ids or set()) if int(user_id or 0)}
    with get_connection() as connection:
        rows = connection.execute(
            text(
                """
                SELECT DISTINCT uc.User_Id
                FROM ERP_USERCOMPANIES uc
                INNER JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                WHERE uc.Company_Id = :company_id
                  AND ISNULL(u.IsActive, 0) = 1
                ORDER BY uc.User_Id
                """
            ),
            {"company_id": company_id},
        ).fetchall()

    created = 0
    for (raw_user_id,) in rows:
        target_user_id = int(raw_user_id or 0)
        if not target_user_id or target_user_id in excluded:
            continue
        if create_notification(
            target_user_id,
            tipo,
            titulo,
            cuerpo,
            link,
            dedupe_hours=dedupe_hours,
        ):
            created += 1
    return created


def notify_admins_in_company(
    company_id: int,
    *,
    tipo: str = "vacaciones",
    titulo: str,
    cuerpo: str,
    link: str | None = None,
    exclude_user_ids: set[int] | None = None,
    dedupe_hours: int | None = 1,
) -> int:
    """Notifica solo a usuarios admin/superadmin activos de la empresa."""
    company_id = int(company_id or 0)
    if not company_id:
        return 0

    excluded = {int(uid) for uid in (exclude_user_ids or set()) if int(uid or 0)}
    try:
        with get_connection() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT DISTINCT uc.User_Id
                    FROM ERP_USERCOMPANIES uc
                    INNER JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                    INNER JOIN ERP_ROL r ON r.Rol_Id = u.RolId
                    WHERE uc.Company_Id = :company_id
                      AND ISNULL(u.IsActive, 0) = 1
                      AND u.RolId IN (1, 2)
                    ORDER BY uc.User_Id
                    """
                ),
                {"company_id": company_id},
            ).fetchall()
    except Exception:
        return 0

    created = 0
    for (raw_user_id,) in rows:
        target_user_id = int(raw_user_id or 0)
        if not target_user_id or target_user_id in excluded:
            continue
        if create_notification(
            target_user_id, tipo, titulo, cuerpo, link, dedupe_hours=dedupe_hours
        ):
            created += 1
    return created


def sync_factura_vencimiento_notifications(
    data: dict[str, Any],
    current_user: dict[str, Any],
) -> int:
    user_id = _current_user_id(current_user)
    if not user_id:
        return 0

    created = 0
    for factura in data.get("vencidas", []):
        dias = abs(int(factura.get("DiasRestantes") or 0))
        cliente = str(factura.get("ReceptorNombre") or "Cliente").strip()
        total = float(factura.get("Total") or 0)
        moneda = str(factura.get("Moneda") or "MXN").strip()
        folio = _factura_folio(factura)
        if create_notification(
            user_id,
            "factura_vencida",
            f"Factura vencida: {folio}",
            f"{cliente} por {total:,.2f} {moneda} lleva {dias} dias vencida.",
            "/reporteria",
            dedupe_hours=24,
        ):
            created += 1

    for factura in data.get("proximas_a_vencer", []):
        dias = int(factura.get("DiasRestantes") or 0)
        cliente = str(factura.get("ReceptorNombre") or "Cliente").strip()
        total = float(factura.get("Total") or 0)
        moneda = str(factura.get("Moneda") or "MXN").strip()
        folio = _factura_folio(factura)
        if create_notification(
            user_id,
            "factura_por_vencer",
            f"Factura por vencer: {folio}",
            f"{cliente} por {total:,.2f} {moneda} vence en {dias} dias.",
            "/reporteria",
            dedupe_hours=24,
        ):
            created += 1

    return created
