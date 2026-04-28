from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _current_user_id(current_user: dict[str, Any]) -> int:
    return int(current_user.get("User_Id") or current_user.get("id") or 0)


def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _assert_user_can_write_for(target_user_id: int, current_user: dict[str, Any]) -> None:
    actor_id = _current_user_id(current_user)
    if current_user.get("is_admin") or current_user.get("is_super_admin"):
        return
    if int(target_user_id) != actor_id:
        raise HTTPException(status_code=403, detail="Solo puedes registrar o editar tus propias horas")


def _refresh_task_hours(conn, tarea_id: int | None) -> None:
    if not tarea_id:
        return
    conn.execute(
        text(
            """
            UPDATE t
            SET HorasReales = COALESCE(agg.HorasReales, 0)
            FROM ERP_TAREAS t
            OUTER APPLY (
                SELECT CAST(SUM(HorasRegistradas) AS DECIMAL(8, 2)) AS HorasReales
                FROM ERP_TIMESHEETS
                WHERE Tarea_Id = :tid
            ) agg
            WHERE t.Tarea_Id = :tid
            """
        ),
        {"tid": tarea_id},
    )


def _refresh_project_totals(conn, proyecto_id: int | None) -> None:
    if not proyecto_id:
        return
    conn.execute(
        text(
            """
            UPDATE p
            SET
                HorasReales = COALESCE(agg.HorasReales, 0),
                CostoReal = COALESCE(agg.CostoReal, 0),
                UpdatedAt = GETDATE()
            FROM ERP_PROYECTOS p
            OUTER APPLY (
                SELECT
                    CAST(SUM(ts.HorasRegistradas) AS DECIMAL(10, 2)) AS HorasReales,
                    CAST(SUM(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0) AS DECIMAL(18, 2)) AS CostoReal
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                WHERE ts.Proyecto_Id = :pid
            ) agg
            WHERE p.Proyecto_Id = :pid
            """
        ),
        {"pid": proyecto_id},
    )


def _resolve_context(conn, payload: dict[str, Any]) -> tuple[int, int | None, int | None]:
    proyecto_id = int(payload["Proyecto_Id"]) if payload.get("Proyecto_Id") else None
    tarea_id = int(payload["Tarea_Id"]) if payload.get("Tarea_Id") else None
    if not proyecto_id and not tarea_id:
        raise HTTPException(status_code=400, detail="Debes indicar Proyecto_Id o Tarea_Id")

    project_row = None
    task_row = None

    if proyecto_id:
        project_row = conn.execute(
            text("SELECT Proyecto_Id, Company_Id FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"),
            {"pid": proyecto_id},
        ).mappings().first()
        if not project_row:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if tarea_id:
        task_row = conn.execute(
            text("SELECT Tarea_Id, Company_Id, Proyecto_Id FROM ERP_TAREAS WHERE Tarea_Id = :tid"),
            {"tid": tarea_id},
        ).mappings().first()
        if not task_row:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        if not proyecto_id and task_row.get("Proyecto_Id"):
            proyecto_id = int(task_row["Proyecto_Id"])
            project_row = conn.execute(
                text("SELECT Proyecto_Id, Company_Id FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"),
                {"pid": proyecto_id},
            ).mappings().first()

    company_id = None
    if project_row:
        company_id = int(project_row["Company_Id"])
    if task_row:
        task_company = int(task_row["Company_Id"])
        if company_id and company_id != task_company:
            raise HTTPException(status_code=400, detail="La tarea y el proyecto deben pertenecer a la misma empresa")
        company_id = task_company
        if project_row and task_row.get("Proyecto_Id") not in (None, proyecto_id):
            raise HTTPException(status_code=400, detail="La tarea no pertenece al proyecto indicado")

    if not company_id:
        raise HTTPException(status_code=400, detail="No fue posible determinar la empresa del registro")

    return company_id, proyecto_id, tarea_id


def list_timesheets(current_user: dict[str, Any], filtros: dict[str, Any]) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"COALESCE(p.Company_Id, t.Company_Id) IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("COALESCE(p.Company_Id, t.Company_Id) = :company_id")
        params["company_id"] = company_id

    if filtros.get("proyecto_id"):
        where.append("ts.Proyecto_Id = :proyecto_id")
        params["proyecto_id"] = int(filtros["proyecto_id"])

    if filtros.get("user_id"):
        where.append("ts.User_Id = :user_id")
        params["user_id"] = int(filtros["user_id"])

    if filtros.get("date_from"):
        where.append("ts.Fecha >= :date_from")
        params["date_from"] = filtros["date_from"]

    if filtros.get("date_to"):
        where.append("ts.Fecha <= :date_to")
        params["date_to"] = filtros["date_to"]

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT
                    ts.*,
                    COALESCE(p.Company_Id, t.Company_Id) AS Company_Id,
                    c.NameCompany,
                    p.Nombre AS ProyectoNombre,
                    t.Titulo AS TareaTitulo,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS NombreUsuario,
                    CAST(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0 AS DECIMAL(18, 2)) AS CostoCalculado
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = ts.Proyecto_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = ts.User_Id
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = COALESCE(p.Company_Id, t.Company_Id)
                {where_sql}
                ORDER BY ts.Fecha DESC, ts.CreatedAt DESC, ts.Timesheet_Id DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def create_timesheet(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    target_user_id = int(payload.get("User_Id") or _current_user_id(current_user))
    _assert_user_can_write_for(target_user_id, current_user)

    with get_transaction() as conn:
        company_id, proyecto_id, tarea_id = _resolve_context(conn, payload)
        _check_company(current_user, company_id)

        row = conn.execute(
            text(
                """
                INSERT INTO ERP_TIMESHEETS
                    (User_Id, Tarea_Id, Proyecto_Id, Fecha, HorasRegistradas, Descripcion, Facturable)
                OUTPUT INSERTED.Timesheet_Id
                VALUES
                    (:user_id, :tarea_id, :proyecto_id, :fecha, :horas, :descripcion, :facturable)
                """
            ),
            {
                "user_id": target_user_id,
                "tarea_id": tarea_id,
                "proyecto_id": proyecto_id,
                "fecha": payload.get("Fecha"),
                "horas": payload.get("HorasRegistradas"),
                "descripcion": payload.get("Descripcion"),
                "facturable": 1 if payload.get("Facturable", True) else 0,
            },
        ).mappings().first()

        _refresh_task_hours(conn, tarea_id)
        _refresh_project_totals(conn, proyecto_id)

    return {"success": True, "Timesheet_Id": int(row["Timesheet_Id"])}


def update_timesheet(timesheet_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        existing = conn.execute(
            text(
                """
                SELECT
                    ts.*,
                    COALESCE(p.Company_Id, t.Company_Id) AS CompanyRef
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = ts.Proyecto_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                WHERE ts.Timesheet_Id = :tid
                """
            ),
            {"tid": timesheet_id},
        ).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="Registro de horas no encontrado")

        _check_company(current_user, int(existing["CompanyRef"]))
        target_user_id = int(payload.get("User_Id") or existing["User_Id"])
        _assert_user_can_write_for(target_user_id, current_user)

        merged_payload = {
            "Proyecto_Id": payload.get("Proyecto_Id", existing.get("Proyecto_Id")),
            "Tarea_Id": payload.get("Tarea_Id", existing.get("Tarea_Id")),
        }
        company_id, proyecto_id, tarea_id = _resolve_context(conn, merged_payload)
        _check_company(current_user, company_id)

        conn.execute(
            text(
                """
                UPDATE ERP_TIMESHEETS
                SET
                    User_Id = :user_id,
                    Tarea_Id = :tarea_id,
                    Proyecto_Id = :proyecto_id,
                    Fecha = :fecha,
                    HorasRegistradas = :horas,
                    Descripcion = :descripcion,
                    Facturable = :facturable
                WHERE Timesheet_Id = :tid
                """
            ),
            {
                "tid": timesheet_id,
                "user_id": target_user_id,
                "tarea_id": tarea_id,
                "proyecto_id": proyecto_id,
                "fecha": payload.get("Fecha", existing["Fecha"]),
                "horas": payload.get("HorasRegistradas", existing["HorasRegistradas"]),
                "descripcion": payload.get("Descripcion", existing.get("Descripcion")),
                "facturable": 1 if payload.get("Facturable", existing.get("Facturable")) else 0,
            },
        )

        _refresh_task_hours(conn, int(existing["Tarea_Id"]) if existing.get("Tarea_Id") else None)
        _refresh_task_hours(conn, tarea_id)
        _refresh_project_totals(conn, int(existing["Proyecto_Id"]) if existing.get("Proyecto_Id") else None)
        _refresh_project_totals(conn, proyecto_id)

    return {"success": True}


def delete_timesheet(timesheet_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        existing = conn.execute(
            text(
                """
                SELECT
                    ts.*,
                    COALESCE(p.Company_Id, t.Company_Id) AS CompanyRef
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = ts.Proyecto_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                WHERE ts.Timesheet_Id = :tid
                """
            ),
            {"tid": timesheet_id},
        ).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="Registro de horas no encontrado")

        _check_company(current_user, int(existing["CompanyRef"]))
        _assert_user_can_write_for(int(existing["User_Id"]), current_user)

        conn.execute(text("DELETE FROM ERP_TIMESHEETS WHERE Timesheet_Id = :tid"), {"tid": timesheet_id})

        _refresh_task_hours(conn, int(existing["Tarea_Id"]) if existing.get("Tarea_Id") else None)
        _refresh_project_totals(conn, int(existing["Proyecto_Id"]) if existing.get("Proyecto_Id") else None)

    return {"success": True}


def get_resumen(current_user: dict[str, Any], filtros: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"por_proyecto": [], "por_usuario": []}
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"COALESCE(p.Company_Id, t.Company_Id) IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("COALESCE(p.Company_Id, t.Company_Id) = :company_id")
        params["company_id"] = company_id

    if filtros.get("proyecto_id"):
        where.append("ts.Proyecto_Id = :proyecto_id")
        params["proyecto_id"] = int(filtros["proyecto_id"])

    if filtros.get("user_id"):
        where.append("ts.User_Id = :user_id")
        params["user_id"] = int(filtros["user_id"])

    if filtros.get("date_from"):
        where.append("ts.Fecha >= :date_from")
        params["date_from"] = filtros["date_from"]

    if filtros.get("date_to"):
        where.append("ts.Fecha <= :date_to")
        params["date_to"] = filtros["date_to"]

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        por_proyecto = conn.execute(
            text(
                f"""
                SELECT
                    ts.Proyecto_Id,
                    p.Nombre AS ProyectoNombre,
                    CAST(SUM(ts.HorasRegistradas) AS DECIMAL(10, 2)) AS Horas,
                    CAST(SUM(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0) AS DECIMAL(18, 2)) AS Costo
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = ts.Proyecto_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                {where_sql}
                GROUP BY ts.Proyecto_Id, p.Nombre
                ORDER BY Horas DESC, ProyectoNombre
                """
            ),
            params,
        ).mappings().all()

        por_usuario = conn.execute(
            text(
                f"""
                SELECT
                    ts.User_Id,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS NombreUsuario,
                    CAST(SUM(ts.HorasRegistradas) AS DECIMAL(10, 2)) AS Horas,
                    CAST(SUM(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0) AS DECIMAL(18, 2)) AS Costo
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_PROYECTOS p ON p.Proyecto_Id = ts.Proyecto_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = ts.User_Id
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                {where_sql}
                GROUP BY ts.User_Id, u.Name, u.Lastname
                ORDER BY Horas DESC, NombreUsuario
                """
            ),
            params,
        ).mappings().all()

    return {
        "por_proyecto": [dict(row) for row in por_proyecto],
        "por_usuario": [dict(row) for row in por_usuario],
    }
