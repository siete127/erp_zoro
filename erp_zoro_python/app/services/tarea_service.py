from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services import notificacion_service
from app.utils.company_access import can_access_company

ESTADOS_VALIDOS = {"pendiente", "en_proceso", "completada", "cancelada"}
PRIORIDADES_VALIDAS = {"baja", "media", "alta", "urgente"}


def _current_user_id(user: dict) -> int:
    return int(user.get("User_Id") or user.get("id") or 0)


def _task_notification_body(tarea: dict[str, Any]) -> str:
    parts = [f"Te asignaron la tarea '{tarea.get('Titulo')}'."]
    if tarea.get("Modulo"):
        parts.append(f"Modulo: {tarea['Modulo']}.")
    if tarea.get("Prioridad"):
        parts.append(f"Prioridad: {tarea['Prioridad']}.")
    return " ".join(parts)


def _validate_project_access(conn, project_id: int | None, company_id: int) -> None:
    if not project_id:
        return

    row = conn.execute(
        text("SELECT Company_Id FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"),
        {"pid": project_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if int(row["Company_Id"]) != int(company_id):
        raise HTTPException(status_code=400, detail="La tarea y el proyecto deben pertenecer a la misma empresa")


def list_tareas(filters: dict[str, Any], current_user: dict[str, Any]) -> list[dict[str, Any]]:
    user_id = _current_user_id(current_user)
    is_admin = current_user.get("RolId") in (1, 2)

    conditions = ["t.Company_Id = :company_id"]
    params: dict[str, Any] = {"company_id": int(filters.get("company_id", 0))}

    if not is_admin:
        conditions.append("(t.AsignadoA = :uid OR t.CreadoPor = :uid)")
        params["uid"] = user_id

    if filters.get("estado"):
        conditions.append("t.Estado = :estado")
        params["estado"] = filters["estado"]
    if filters.get("prioridad"):
        conditions.append("t.Prioridad = :prioridad")
        params["prioridad"] = filters["prioridad"]
    if filters.get("asignado_a"):
        conditions.append("t.AsignadoA = :asignado_a")
        params["asignado_a"] = int(filters["asignado_a"])
    if filters.get("proyecto_id"):
        conditions.append("t.Proyecto_Id = :proyecto_id")
        params["proyecto_id"] = int(filters["proyecto_id"])

    where = " AND ".join(conditions)
    with get_connection() as conn:
        rows = conn.execute(
            text(f"""
                SELECT
                    t.*,
                    ua.Name + ' ' + ua.Lastname AS NombreAsignado,
                    uc.Name + ' ' + uc.Lastname AS NombreCreador
                FROM ERP_TAREAS t
                LEFT JOIN ERP_USERS ua ON ua.User_Id = t.AsignadoA
                LEFT JOIN ERP_USERS uc ON uc.User_Id = t.CreadoPor
                WHERE {where}
                ORDER BY
                    CASE t.Prioridad
                        WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2
                        WHEN 'media' THEN 3 ELSE 4
                    END,
                    t.FechaLimite ASC
            """),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


def create_tarea(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    titulo = str(payload.get("Titulo") or "").strip()
    if not company_id or not titulo:
        raise HTTPException(status_code=400, detail="Company_Id y Titulo son requeridos")
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")

    prioridad = str(payload.get("Prioridad") or "media").lower()
    if prioridad not in PRIORIDADES_VALIDAS:
        prioridad = "media"

    with get_transaction() as conn:
        project_id = int(payload["Proyecto_Id"]) if payload.get("Proyecto_Id") else None
        _validate_project_access(conn, project_id, company_id)
        inserted = conn.execute(
            text("""
                INSERT INTO ERP_TAREAS
                    (Titulo, Descripcion, AsignadoA, CreadoPor, Company_Id,
                     FechaLimite, Estado, Prioridad, Modulo, Referencia_Id,
                     Proyecto_Id, HorasEstimadas, HorasReales)
                OUTPUT INSERTED.*
                VALUES
                    (:titulo, :desc, :asignado, :creador, :company,
                     :limite, 'pendiente', :prioridad, :modulo, :ref_id,
                     :proyecto_id, :horas_estimadas, :horas_reales)
            """),
            {
                "titulo": titulo,
                "desc": payload.get("Descripcion"),
                "asignado": int(payload["AsignadoA"]) if payload.get("AsignadoA") else None,
                "creador": _current_user_id(current_user),
                "company": company_id,
                "limite": payload.get("FechaLimite"),
                "prioridad": prioridad,
                "modulo": payload.get("Modulo"),
                "ref_id": int(payload["Referencia_Id"]) if payload.get("Referencia_Id") else None,
                "proyecto_id": project_id,
                "horas_estimadas": payload.get("HorasEstimadas"),
                "horas_reales": payload.get("HorasReales") or 0,
            },
        ).mappings().first()

    tarea = dict(inserted)
    asignado_a = int(tarea["AsignadoA"]) if tarea.get("AsignadoA") else None
    creador_id = _current_user_id(current_user)
    if asignado_a and asignado_a != creador_id:
        notificacion_service.create_notification(
            asignado_a,
            "tarea_asignada",
            f"Nueva tarea: {tarea.get('Titulo')}",
            _task_notification_body(tarea),
            "/tareas",
            dedupe_hours=12,
        )

    emit_background("tarea:changed", {"company_id": company_id, "action": "created"})
    return tarea


def update_tarea(tarea_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        tarea = conn.execute(
            text("SELECT * FROM ERP_TAREAS WHERE Tarea_Id=:id"),
            {"id": tarea_id},
        ).mappings().first()
        if not tarea:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        if not can_access_company(current_user, int(tarea["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")

        asignado_anterior = int(tarea["AsignadoA"]) if tarea.get("AsignadoA") else None
        fields: list[str] = []
        params: dict[str, Any] = {"id": tarea_id}

        for col, key in [
            ("Titulo", "Titulo"), ("Descripcion", "Descripcion"),
            ("AsignadoA", "AsignadoA"), ("FechaLimite", "FechaLimite"),
            ("Modulo", "Modulo"), ("Referencia_Id", "Referencia_Id"),
            ("Proyecto_Id", "Proyecto_Id"), ("HorasEstimadas", "HorasEstimadas"),
            ("HorasReales", "HorasReales"),
        ]:
            if key in payload:
                if key == "Proyecto_Id":
                    project_id = int(payload[key]) if payload.get(key) else None
                    _validate_project_access(conn, project_id, int(tarea["Company_Id"]))
                    params[col] = project_id
                else:
                    params[col] = payload[key]
                fields.append(f"{col}=:{col}")

        if "Estado" in payload:
            estado = str(payload["Estado"]).lower()
            if estado not in ESTADOS_VALIDOS:
                raise HTTPException(status_code=400, detail=f"Estado inválido: {estado}")
            fields.append("Estado=:Estado")
            params["Estado"] = estado

        if "Prioridad" in payload:
            prio = str(payload["Prioridad"]).lower()
            if prio not in PRIORIDADES_VALIDAS:
                raise HTTPException(status_code=400, detail=f"Prioridad inválida: {prio}")
            fields.append("Prioridad=:Prioridad")
            params["Prioridad"] = prio

        if not fields:
            return dict(tarea)

        fields.append("FechaActualizacion=GETDATE()")
        updated = conn.execute(
            text(f"UPDATE ERP_TAREAS SET {', '.join(fields)} OUTPUT INSERTED.* WHERE Tarea_Id=:id"),
            params,
        ).mappings().first()

    tarea_actualizada = dict(updated)
    nuevo_asignado = int(tarea_actualizada["AsignadoA"]) if tarea_actualizada.get("AsignadoA") else None
    actor_id = _current_user_id(current_user)
    if nuevo_asignado and nuevo_asignado != asignado_anterior and nuevo_asignado != actor_id:
        notificacion_service.create_notification(
            nuevo_asignado,
            "tarea_asignada",
            f"Tarea reasignada: {tarea_actualizada.get('Titulo')}",
            _task_notification_body(tarea_actualizada),
            "/tareas",
            dedupe_hours=12,
        )

    emit_background("tarea:changed", {"tarea_id": tarea_id, "company_id": int(tarea["Company_Id"]), "action": "updated"})
    return tarea_actualizada


def delete_tarea(tarea_id: int, current_user: dict[str, Any]) -> dict[str, str]:
    with get_transaction() as conn:
        tarea = conn.execute(
            text("SELECT Company_Id, CreadoPor FROM ERP_TAREAS WHERE Tarea_Id=:id"),
            {"id": tarea_id},
        ).mappings().first()
        if not tarea:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")

        user_id = _current_user_id(current_user)
        is_admin = current_user.get("RolId") in (1, 2)
        if not is_admin and int(tarea["CreadoPor"]) != user_id:
            raise HTTPException(status_code=403, detail="Solo el creador o un admin puede eliminar la tarea")

        conn.execute(text("DELETE FROM ERP_TAREAS WHERE Tarea_Id=:id"), {"id": tarea_id})

    emit_background("tarea:changed", {"tarea_id": tarea_id, "company_id": int(tarea["Company_Id"]), "action": "deleted"})
    return {"msg": "Tarea eliminada"}


def get_tarea(tarea_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT t.*,
                    ua.Name + ' ' + ua.Lastname AS NombreAsignado,
                    uc.Name + ' ' + uc.Lastname AS NombreCreador,
                    p.Nombre AS ProyectoNombre
                FROM ERP_TAREAS t
                LEFT JOIN ERP_USERS ua ON ua.User_Id = t.AsignadoA
                LEFT JOIN ERP_USERS uc ON uc.User_Id = t.CreadoPor
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = t.Proyecto_Id
                WHERE t.Tarea_Id = :id
            """),
            {"id": tarea_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if not can_access_company(current_user, int(row["Company_Id"])):
        raise HTTPException(status_code=403, detail="Sin acceso")
    return dict(row)
