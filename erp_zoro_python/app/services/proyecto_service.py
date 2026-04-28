from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


VALID_STATUSES = {"ACTIVO", "PAUSADO", "CERRADO", "CANCELADO"}
CLIENT_NAME_SQL = "COALESCE(NULLIF(cl.CommercialName, ''), cl.LegalName)"
USER_NAME_SQL = "LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, '')))"


def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _fetch_project_header(conn, proyecto_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        text(
            f"""
            SELECT
                p.*,
                c.NameCompany,
                {CLIENT_NAME_SQL} AS ClienteNombre,
                {USER_NAME_SQL} AS ResponsableNombre,
                ISNULL(tstats.TotalTareas, 0) AS TotalTareas,
                ISNULL(tstats.TareasCompletadas, 0) AS TareasCompletadas,
                ISNULL(tsstats.TotalTimesheets, 0) AS TotalTimesheets,
                CAST(
                    CASE
                        WHEN ISNULL(p.PresupuestoHoras, 0) > 0 THEN
                            CASE
                                WHEN ISNULL(p.HorasReales, 0) >= p.PresupuestoHoras THEN 100
                                ELSE ISNULL(p.HorasReales, 0) * 100.0 / NULLIF(p.PresupuestoHoras, 0)
                            END
                        WHEN ISNULL(tstats.TotalTareas, 0) > 0 THEN
                            ISNULL(tstats.TareasCompletadas, 0) * 100.0 / NULLIF(tstats.TotalTareas, 0)
                        ELSE 0
                    END AS DECIMAL(10, 2)
                ) AS AvancePct
            FROM ERP_PROYECTOS p
            LEFT JOIN ERP_COMPANY c ON c.Company_Id = p.Company_Id
            LEFT JOIN ERP_CLIENT cl ON cl.Client_Id = p.Client_Id
            LEFT JOIN ERP_USERS u ON u.User_Id = p.Responsable_Id
            OUTER APPLY (
                SELECT
                    COUNT(1) AS TotalTareas,
                    SUM(CASE WHEN LOWER(ISNULL(t.Estado, '')) = 'completada' THEN 1 ELSE 0 END) AS TareasCompletadas
                FROM ERP_TAREAS t
                WHERE t.Proyecto_Id = p.Proyecto_Id
            ) tstats
            OUTER APPLY (
                SELECT COUNT(1) AS TotalTimesheets
                FROM ERP_TIMESHEETS ts
                WHERE ts.Proyecto_Id = p.Proyecto_Id
            ) tsstats
            WHERE p.Proyecto_Id = :pid
            """
        ),
        {"pid": proyecto_id},
    ).mappings().first()
    return dict(row) if row else None


def list_proyectos(current_user: dict[str, Any], filtros: dict[str, Any]) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"p.Company_Id IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("p.Company_Id = :company_id")
        params["company_id"] = company_id

    if filtros.get("status"):
        where.append("p.Status = :status")
        params["status"] = str(filtros["status"]).upper()

    if filtros.get("responsable_id"):
        where.append("p.Responsable_Id = :responsable_id")
        params["responsable_id"] = int(filtros["responsable_id"])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT
                    p.*,
                    c.NameCompany,
                    {CLIENT_NAME_SQL} AS ClienteNombre,
                    {USER_NAME_SQL} AS ResponsableNombre,
                    ISNULL(tstats.TotalTareas, 0) AS TotalTareas,
                    ISNULL(tstats.TareasCompletadas, 0) AS TareasCompletadas,
                    ISNULL(tsstats.TotalTimesheets, 0) AS TotalTimesheets,
                    CAST(
                        CASE
                            WHEN ISNULL(p.PresupuestoHoras, 0) > 0 THEN
                                CASE
                                    WHEN ISNULL(p.HorasReales, 0) >= p.PresupuestoHoras THEN 100
                                    ELSE ISNULL(p.HorasReales, 0) * 100.0 / NULLIF(p.PresupuestoHoras, 0)
                                END
                            WHEN ISNULL(tstats.TotalTareas, 0) > 0 THEN
                                ISNULL(tstats.TareasCompletadas, 0) * 100.0 / NULLIF(tstats.TotalTareas, 0)
                            ELSE 0
                        END AS DECIMAL(10, 2)
                    ) AS AvancePct
                FROM ERP_PROYECTOS p
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = p.Company_Id
                LEFT JOIN ERP_CLIENT cl ON cl.Client_Id = p.Client_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = p.Responsable_Id
                OUTER APPLY (
                    SELECT
                        COUNT(1) AS TotalTareas,
                        SUM(CASE WHEN LOWER(ISNULL(t.Estado, '')) = 'completada' THEN 1 ELSE 0 END) AS TareasCompletadas
                    FROM ERP_TAREAS t
                    WHERE t.Proyecto_Id = p.Proyecto_Id
                ) tstats
                OUTER APPLY (
                    SELECT COUNT(1) AS TotalTimesheets
                    FROM ERP_TIMESHEETS ts
                    WHERE ts.Proyecto_Id = p.Proyecto_Id
                ) tsstats
                {where_sql}
                ORDER BY
                    CASE p.Status
                        WHEN 'ACTIVO' THEN 1
                        WHEN 'PAUSADO' THEN 2
                        WHEN 'CERRADO' THEN 3
                        ELSE 4
                    END,
                    p.UpdatedAt DESC,
                    p.Proyecto_Id DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def get_proyecto(proyecto_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        proyecto = _fetch_project_header(conn, proyecto_id)
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        _check_company(current_user, int(proyecto["Company_Id"]))

        tareas = conn.execute(
            text(
                """
                SELECT
                    t.*,
                    LTRIM(RTRIM(COALESCE(ua.Name, '') + ' ' + COALESCE(ua.Lastname, ''))) AS NombreAsignado,
                    LTRIM(RTRIM(COALESCE(uc.Name, '') + ' ' + COALESCE(uc.Lastname, ''))) AS NombreCreador
                FROM ERP_TAREAS t
                LEFT JOIN ERP_USERS ua ON ua.User_Id = t.AsignadoA
                LEFT JOIN ERP_USERS uc ON uc.User_Id = t.CreadoPor
                WHERE t.Proyecto_Id = :pid
                ORDER BY
                    CASE LOWER(ISNULL(t.Estado, ''))
                        WHEN 'en_proceso' THEN 1
                        WHEN 'pendiente' THEN 2
                        WHEN 'completada' THEN 3
                        ELSE 4
                    END,
                    t.FechaLimite ASC,
                    t.Tarea_Id DESC
                """
            ),
            {"pid": proyecto_id},
        ).mappings().all()

        timesheets = conn.execute(
            text(
                """
                SELECT TOP 200
                    ts.*,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS NombreUsuario,
                    t.Titulo AS TareaTitulo,
                    CAST(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0 AS DECIMAL(18, 2)) AS CostoCalculado
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_USERS u ON u.User_Id = ts.User_Id
                LEFT JOIN ERP_TAREAS t ON t.Tarea_Id = ts.Tarea_Id
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                WHERE ts.Proyecto_Id = :pid
                ORDER BY ts.Fecha DESC, ts.CreatedAt DESC, ts.Timesheet_Id DESC
                """
            ),
            {"pid": proyecto_id},
        ).mappings().all()

        resumen_usuarios = conn.execute(
            text(
                """
                SELECT
                    ts.User_Id,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS NombreUsuario,
                    CAST(SUM(ts.HorasRegistradas) AS DECIMAL(10, 2)) AS Horas,
                    CAST(SUM(ts.HorasRegistradas * COALESCE(hr.SalarioMensual, 0) / 160.0) AS DECIMAL(18, 2)) AS Costo
                FROM ERP_TIMESHEETS ts
                LEFT JOIN ERP_USERS u ON u.User_Id = ts.User_Id
                LEFT JOIN ERP_HR_PROFILE hr ON hr.User_Id = ts.User_Id
                WHERE ts.Proyecto_Id = :pid
                GROUP BY ts.User_Id, u.Name, u.Lastname
                ORDER BY Horas DESC, NombreUsuario
                """
            ),
            {"pid": proyecto_id},
        ).mappings().all()

    return {
        "project": proyecto,
        "tareas": [dict(row) for row in tareas],
        "timesheets": [dict(row) for row in timesheets],
        "resumen_usuarios": [dict(row) for row in resumen_usuarios],
    }


def create_proyecto(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    nombre = str(payload.get("Nombre") or "").strip()
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre es requerido")
    _check_company(current_user, company_id)

    status_value = str(payload.get("Status") or "ACTIVO").upper()
    if status_value not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status de proyecto invalido")

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_PROYECTOS
                    (Company_Id, Nombre, Client_Id, Responsable_Id, FechaInicio, FechaFin,
                     PresupuestoHoras, PresupuestoCosto, HorasReales, CostoReal, Status, Descripcion)
                OUTPUT INSERTED.Proyecto_Id
                VALUES
                    (:company_id, :nombre, :client_id, :responsable_id, :fecha_inicio, :fecha_fin,
                     :presupuesto_horas, :presupuesto_costo, 0, 0, :status, :descripcion)
                """
            ),
            {
                "company_id": company_id,
                "nombre": nombre,
                "client_id": payload.get("Client_Id"),
                "responsable_id": payload.get("Responsable_Id"),
                "fecha_inicio": payload.get("FechaInicio"),
                "fecha_fin": payload.get("FechaFin"),
                "presupuesto_horas": payload.get("PresupuestoHoras"),
                "presupuesto_costo": payload.get("PresupuestoCosto"),
                "status": status_value,
                "descripcion": payload.get("Descripcion"),
            },
        ).mappings().first()

    return {"success": True, "Proyecto_Id": int(row["Proyecto_Id"])}


def update_proyecto(proyecto_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        proyecto = conn.execute(
            text("SELECT * FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"),
            {"pid": proyecto_id},
        ).mappings().first()
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        _check_company(current_user, int(proyecto["Company_Id"]))

        fields: list[str] = []
        params: dict[str, Any] = {"pid": proyecto_id}
        mapping = [
            ("Nombre", "Nombre"),
            ("Client_Id", "Client_Id"),
            ("Responsable_Id", "Responsable_Id"),
            ("FechaInicio", "FechaInicio"),
            ("FechaFin", "FechaFin"),
            ("PresupuestoHoras", "PresupuestoHoras"),
            ("PresupuestoCosto", "PresupuestoCosto"),
            ("Descripcion", "Descripcion"),
        ]
        for column, key in mapping:
            if key in payload:
                fields.append(f"{column} = :{column}")
                params[column] = payload.get(key)

        if "Status" in payload:
            status_value = str(payload.get("Status") or "").upper()
            if status_value not in VALID_STATUSES:
                raise HTTPException(status_code=400, detail="Status de proyecto invalido")
            fields.append("Status = :Status")
            params["Status"] = status_value

        if not fields:
            return {"success": True}

        fields.append("UpdatedAt = GETDATE()")
        conn.execute(
            text(f"UPDATE ERP_PROYECTOS SET {', '.join(fields)} WHERE Proyecto_Id = :pid"),
            params,
        )

    return {"success": True}


def delete_proyecto(proyecto_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        proyecto = conn.execute(
            text("SELECT Company_Id FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"),
            {"pid": proyecto_id},
        ).mappings().first()
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        _check_company(current_user, int(proyecto["Company_Id"]))

        usage = conn.execute(
            text(
                """
                SELECT
                    (SELECT COUNT(1) FROM ERP_TAREAS WHERE Proyecto_Id = :pid) AS TotalTareas,
                    (SELECT COUNT(1) FROM ERP_TIMESHEETS WHERE Proyecto_Id = :pid) AS TotalTimesheets
                """
            ),
            {"pid": proyecto_id},
        ).mappings().first()

        if int(usage["TotalTareas"] or 0) > 0 or int(usage["TotalTimesheets"] or 0) > 0:
            conn.execute(
                text("UPDATE ERP_PROYECTOS SET Status = 'CANCELADO', UpdatedAt = GETDATE() WHERE Proyecto_Id = :pid"),
                {"pid": proyecto_id},
            )
            return {
                "success": True,
                "message": "Proyecto marcado como CANCELADO porque tiene tareas u horas registradas",
            }

        conn.execute(text("DELETE FROM ERP_PROYECTOS WHERE Proyecto_Id = :pid"), {"pid": proyecto_id})

    return {"success": True, "message": "Proyecto eliminado"}
