from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


VALID_ESTATUS_EQUIPO = {"OPERATIVO", "EN_MANTENIMIENTO", "BAJA"}
VALID_ESTATUS_ORDEN = {"PENDIENTE", "EN_PROCESO", "COMPLETADO", "CANCELADO"}
VALID_TIPOS_ORDEN = {"PREVENTIVO", "CORRECTIVO"}

USER_NAME_SQL = "LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, '')))"


def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


# ─────────────────────────────────────────────
# EQUIPOS
# ─────────────────────────────────────────────

def list_equipos(current_user: dict[str, Any], filtros: dict[str, Any]) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"e.Company_Id IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("e.Company_Id = :company_id")
        params["company_id"] = company_id

    if filtros.get("estatus"):
        where.append("e.Estatus = :estatus")
        params["estatus"] = str(filtros["estatus"]).upper()

    if filtros.get("categoria"):
        where.append("e.Categoria = :categoria")
        params["categoria"] = filtros["categoria"]

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT
                    e.*,
                    c.NameCompany,
                    {USER_NAME_SQL} AS ResponsableNombre,
                    af.Nombre AS ActivoNombre,
                    ISNULL(ord.TotalOrdenes, 0) AS TotalOrdenes,
                    ISNULL(ord.OrdenesActivas, 0) AS OrdenesActivas
                FROM ERP_MANTENIMIENTO_EQUIPO e
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = e.Company_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = e.Responsable_Id
                LEFT JOIN ERP_ACTIVOS_FIJOS af ON af.Activo_Id = e.Activo_Id
                OUTER APPLY (
                    SELECT
                        COUNT(1) AS TotalOrdenes,
                        SUM(CASE WHEN o.Estatus IN ('PENDIENTE','EN_PROCESO') THEN 1 ELSE 0 END) AS OrdenesActivas
                    FROM ERP_MANTENIMIENTO_ORDEN o
                    WHERE o.Equipo_Id = e.Equipo_Id
                ) ord
                {where_sql}
                ORDER BY
                    CASE e.Estatus
                        WHEN 'OPERATIVO' THEN 1
                        WHEN 'EN_MANTENIMIENTO' THEN 2
                        ELSE 3
                    END,
                    e.Nombre
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def get_equipo(equipo_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        equipo = conn.execute(
            text(
                f"""
                SELECT
                    e.*,
                    c.NameCompany,
                    {USER_NAME_SQL} AS ResponsableNombre,
                    af.Nombre AS ActivoNombre
                FROM ERP_MANTENIMIENTO_EQUIPO e
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = e.Company_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = e.Responsable_Id
                LEFT JOIN ERP_ACTIVOS_FIJOS af ON af.Activo_Id = e.Activo_Id
                WHERE e.Equipo_Id = :eid
                """
            ),
            {"eid": equipo_id},
        ).mappings().first()
        if not equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        _check_company(current_user, int(equipo["Company_Id"]))

        ordenes = conn.execute(
            text(
                f"""
                SELECT TOP 50
                    o.*,
                    {USER_NAME_SQL.replace('u.', 'ut.')} AS TecnicoNombre
                FROM ERP_MANTENIMIENTO_ORDEN o
                LEFT JOIN ERP_USERS ut ON ut.User_Id = o.Tecnico_Id
                WHERE o.Equipo_Id = :eid
                ORDER BY o.CreatedAt DESC
                """
            ),
            {"eid": equipo_id},
        ).mappings().all()

    return {"equipo": dict(equipo), "ordenes": [dict(row) for row in ordenes]}


def create_equipo(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    nombre = str(payload.get("Nombre") or "").strip()
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre es requerido")
    _check_company(current_user, company_id)

    estatus = str(payload.get("Estatus") or "OPERATIVO").upper()
    if estatus not in VALID_ESTATUS_EQUIPO:
        raise HTTPException(status_code=400, detail="Estatus invalido")

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_MANTENIMIENTO_EQUIPO
                    (Company_Id, Nombre, Categoria, NumeroSerie, Ubicacion,
                     Activo_Id, Responsable_Id, FechaInstalacion, Estatus, Notas)
                OUTPUT INSERTED.Equipo_Id
                VALUES
                    (:company_id, :nombre, :categoria, :numero_serie, :ubicacion,
                     :activo_id, :responsable_id, :fecha_instalacion, :estatus, :notas)
                """
            ),
            {
                "company_id": company_id,
                "nombre": nombre,
                "categoria": payload.get("Categoria"),
                "numero_serie": payload.get("NumeroSerie"),
                "ubicacion": payload.get("Ubicacion"),
                "activo_id": payload.get("Activo_Id"),
                "responsable_id": payload.get("Responsable_Id"),
                "fecha_instalacion": payload.get("FechaInstalacion"),
                "estatus": estatus,
                "notas": payload.get("Notas"),
            },
        ).mappings().first()

    return {"success": True, "Equipo_Id": int(row["Equipo_Id"])}


def update_equipo(equipo_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        equipo = conn.execute(
            text("SELECT Company_Id FROM ERP_MANTENIMIENTO_EQUIPO WHERE Equipo_Id = :eid"),
            {"eid": equipo_id},
        ).mappings().first()
        if not equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        _check_company(current_user, int(equipo["Company_Id"]))

        if "Estatus" in payload:
            estatus = str(payload.get("Estatus") or "").upper()
            if estatus not in VALID_ESTATUS_EQUIPO:
                raise HTTPException(status_code=400, detail="Estatus invalido")

        fields: list[str] = []
        params: dict[str, Any] = {"eid": equipo_id}
        for col in ["Nombre", "Categoria", "NumeroSerie", "Ubicacion",
                    "Activo_Id", "Responsable_Id", "FechaInstalacion", "Estatus", "Notas"]:
            if col in payload:
                fields.append(f"{col} = :{col}")
                params[col] = payload[col]

        if not fields:
            return {"success": True}

        fields.append("UpdatedAt = GETDATE()")
        conn.execute(
            text(f"UPDATE ERP_MANTENIMIENTO_EQUIPO SET {', '.join(fields)} WHERE Equipo_Id = :eid"),
            params,
        )

    return {"success": True}


def delete_equipo(equipo_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        equipo = conn.execute(
            text("SELECT Company_Id FROM ERP_MANTENIMIENTO_EQUIPO WHERE Equipo_Id = :eid"),
            {"eid": equipo_id},
        ).mappings().first()
        if not equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        _check_company(current_user, int(equipo["Company_Id"]))

        ordenes_count = conn.execute(
            text("SELECT COUNT(1) AS Total FROM ERP_MANTENIMIENTO_ORDEN WHERE Equipo_Id = :eid"),
            {"eid": equipo_id},
        ).mappings().first()

        if int(ordenes_count["Total"] or 0) > 0:
            conn.execute(
                text("UPDATE ERP_MANTENIMIENTO_EQUIPO SET Estatus = 'BAJA', UpdatedAt = GETDATE() WHERE Equipo_Id = :eid"),
                {"eid": equipo_id},
            )
            return {"success": True, "message": "Equipo dado de baja porque tiene órdenes registradas"}

        conn.execute(text("DELETE FROM ERP_MANTENIMIENTO_EQUIPO WHERE Equipo_Id = :eid"), {"eid": equipo_id})

    return {"success": True, "message": "Equipo eliminado"}


# ─────────────────────────────────────────────
# ÓRDENES DE MANTENIMIENTO
# ─────────────────────────────────────────────

def list_ordenes(current_user: dict[str, Any], filtros: dict[str, Any]) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"o.Company_Id IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("o.Company_Id = :company_id")
        params["company_id"] = company_id

    if filtros.get("equipo_id"):
        where.append("o.Equipo_Id = :equipo_id")
        params["equipo_id"] = int(filtros["equipo_id"])

    if filtros.get("estatus"):
        where.append("o.Estatus = :estatus")
        params["estatus"] = str(filtros["estatus"]).upper()

    if filtros.get("tipo"):
        where.append("o.Tipo = :tipo")
        params["tipo"] = str(filtros["tipo"]).upper()

    if filtros.get("tecnico_id"):
        where.append("o.Tecnico_Id = :tecnico_id")
        params["tecnico_id"] = int(filtros["tecnico_id"])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT
                    o.*,
                    e.Nombre AS EquipoNombre,
                    e.Categoria AS EquipoCategoria,
                    LTRIM(RTRIM(COALESCE(ut.Name, '') + ' ' + COALESCE(ut.Lastname, ''))) AS TecnicoNombre,
                    LTRIM(RTRIM(COALESCE(uc.Name, '') + ' ' + COALESCE(uc.Lastname, ''))) AS CreadoPorNombre
                FROM ERP_MANTENIMIENTO_ORDEN o
                LEFT JOIN ERP_MANTENIMIENTO_EQUIPO e ON e.Equipo_Id = o.Equipo_Id
                LEFT JOIN ERP_USERS ut ON ut.User_Id = o.Tecnico_Id
                LEFT JOIN ERP_USERS uc ON uc.User_Id = o.CreadoPor
                {where_sql}
                ORDER BY
                    CASE o.Estatus
                        WHEN 'EN_PROCESO' THEN 1
                        WHEN 'PENDIENTE' THEN 2
                        WHEN 'COMPLETADO' THEN 3
                        ELSE 4
                    END,
                    o.FechaProgramada ASC,
                    o.CreatedAt DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def get_orden(orden_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        orden = conn.execute(
            text(
                """
                SELECT
                    o.*,
                    e.Nombre AS EquipoNombre,
                    e.Categoria AS EquipoCategoria,
                    e.Estatus AS EquipoEstatus,
                    LTRIM(RTRIM(COALESCE(ut.Name, '') + ' ' + COALESCE(ut.Lastname, ''))) AS TecnicoNombre,
                    LTRIM(RTRIM(COALESCE(uc.Name, '') + ' ' + COALESCE(uc.Lastname, ''))) AS CreadoPorNombre
                FROM ERP_MANTENIMIENTO_ORDEN o
                LEFT JOIN ERP_MANTENIMIENTO_EQUIPO e ON e.Equipo_Id = o.Equipo_Id
                LEFT JOIN ERP_USERS ut ON ut.User_Id = o.Tecnico_Id
                LEFT JOIN ERP_USERS uc ON uc.User_Id = o.CreadoPor
                WHERE o.Orden_Id = :oid
                """
            ),
            {"oid": orden_id},
        ).mappings().first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        _check_company(current_user, int(orden["Company_Id"]))

    return dict(orden)


def create_orden(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    equipo_id = int(payload.get("Equipo_Id") or 0)
    titulo = str(payload.get("Titulo") or "").strip()
    tipo = str(payload.get("Tipo") or "").upper()

    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not equipo_id:
        raise HTTPException(status_code=400, detail="Equipo_Id es requerido")
    if not titulo:
        raise HTTPException(status_code=400, detail="Titulo es requerido")
    if tipo not in VALID_TIPOS_ORDEN:
        raise HTTPException(status_code=400, detail="Tipo debe ser PREVENTIVO o CORRECTIVO")
    _check_company(current_user, company_id)

    creado_por = int(current_user.get("User_Id") or current_user.get("id") or 0) or None

    with get_transaction() as conn:
        equipo = conn.execute(
            text("SELECT Equipo_Id, Company_Id FROM ERP_MANTENIMIENTO_EQUIPO WHERE Equipo_Id = :eid AND Company_Id = :cid"),
            {"eid": equipo_id, "cid": company_id},
        ).mappings().first()
        if not equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado en esta empresa")

        row = conn.execute(
            text(
                """
                INSERT INTO ERP_MANTENIMIENTO_ORDEN
                    (Company_Id, Equipo_Id, Tipo, Titulo, Descripcion,
                     Tecnico_Id, FechaProgramada, Estatus, Costo, CreadoPor)
                OUTPUT INSERTED.Orden_Id
                VALUES
                    (:company_id, :equipo_id, :tipo, :titulo, :descripcion,
                     :tecnico_id, :fecha_programada, 'PENDIENTE', :costo, :creado_por)
                """
            ),
            {
                "company_id": company_id,
                "equipo_id": equipo_id,
                "tipo": tipo,
                "titulo": titulo,
                "descripcion": payload.get("Descripcion"),
                "tecnico_id": payload.get("Tecnico_Id"),
                "fecha_programada": payload.get("FechaProgramada"),
                "costo": payload.get("Costo"),
                "creado_por": creado_por,
            },
        ).mappings().first()

    return {"success": True, "Orden_Id": int(row["Orden_Id"])}


def update_orden(orden_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        orden = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_MANTENIMIENTO_ORDEN WHERE Orden_Id = :oid"),
            {"oid": orden_id},
        ).mappings().first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        _check_company(current_user, int(orden["Company_Id"]))

        if "Estatus" in payload:
            estatus = str(payload.get("Estatus") or "").upper()
            if estatus not in VALID_ESTATUS_ORDEN:
                raise HTTPException(status_code=400, detail="Estatus invalido")

        fields: list[str] = []
        params: dict[str, Any] = {"oid": orden_id}
        for col in ["Tipo", "Titulo", "Descripcion", "Tecnico_Id",
                    "FechaProgramada", "FechaInicio", "FechaFin", "Estatus", "Costo"]:
            if col in payload:
                if col == "Tipo" and payload[col]:
                    payload[col] = str(payload[col]).upper()
                fields.append(f"{col} = :{col}")
                params[col] = payload[col]

        if not fields:
            return {"success": True}

        fields.append("UpdatedAt = GETDATE()")
        conn.execute(
            text(f"UPDATE ERP_MANTENIMIENTO_ORDEN SET {', '.join(fields)} WHERE Orden_Id = :oid"),
            params,
        )

    return {"success": True}


def iniciar_orden(orden_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        orden = conn.execute(
            text("SELECT Company_Id, Estatus, Equipo_Id FROM ERP_MANTENIMIENTO_ORDEN WHERE Orden_Id = :oid"),
            {"oid": orden_id},
        ).mappings().first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        _check_company(current_user, int(orden["Company_Id"]))

        if str(orden["Estatus"]) != "PENDIENTE":
            raise HTTPException(status_code=400, detail="Solo se pueden iniciar órdenes en estado PENDIENTE")

        conn.execute(
            text("""
                UPDATE ERP_MANTENIMIENTO_ORDEN
                SET Estatus = 'EN_PROCESO', FechaInicio = GETDATE(), UpdatedAt = GETDATE()
                WHERE Orden_Id = :oid
            """),
            {"oid": orden_id},
        )
        conn.execute(
            text("UPDATE ERP_MANTENIMIENTO_EQUIPO SET Estatus = 'EN_MANTENIMIENTO', UpdatedAt = GETDATE() WHERE Equipo_Id = :eid"),
            {"eid": int(orden["Equipo_Id"])},
        )

    return {"success": True, "message": "Orden iniciada, equipo en mantenimiento"}


def completar_orden(orden_id: int, costo: float | None, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        orden = conn.execute(
            text("SELECT Company_Id, Estatus, Equipo_Id FROM ERP_MANTENIMIENTO_ORDEN WHERE Orden_Id = :oid"),
            {"oid": orden_id},
        ).mappings().first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        _check_company(current_user, int(orden["Company_Id"]))

        if str(orden["Estatus"]) not in ("PENDIENTE", "EN_PROCESO"):
            raise HTTPException(status_code=400, detail="La orden ya está completada o cancelada")

        costo_sql = ", Costo = :costo" if costo is not None else ""
        params_completar: dict[str, Any] = {"oid": orden_id}
        if costo is not None:
            params_completar["costo"] = costo
        conn.execute(
            text(f"""
                UPDATE ERP_MANTENIMIENTO_ORDEN
                SET Estatus = 'COMPLETADO', FechaFin = GETDATE(), UpdatedAt = GETDATE()
                    {costo_sql}
                WHERE Orden_Id = :oid
            """),
            params_completar,
        )

        ordenes_activas = conn.execute(
            text("""
                SELECT COUNT(1) AS Total
                FROM ERP_MANTENIMIENTO_ORDEN
                WHERE Equipo_Id = :eid AND Estatus IN ('PENDIENTE', 'EN_PROCESO') AND Orden_Id <> :oid
            """),
            {"eid": int(orden["Equipo_Id"]), "oid": orden_id},
        ).mappings().first()

        if int(ordenes_activas["Total"] or 0) == 0:
            conn.execute(
                text("UPDATE ERP_MANTENIMIENTO_EQUIPO SET Estatus = 'OPERATIVO', UpdatedAt = GETDATE() WHERE Equipo_Id = :eid"),
                {"eid": int(orden["Equipo_Id"])},
            )

    return {"success": True, "message": "Orden completada"}


def delete_orden(orden_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        orden = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_MANTENIMIENTO_ORDEN WHERE Orden_Id = :oid"),
            {"oid": orden_id},
        ).mappings().first()
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        _check_company(current_user, int(orden["Company_Id"]))

        if str(orden["Estatus"]) == "COMPLETADO":
            raise HTTPException(status_code=400, detail="No se puede eliminar una orden completada")

        conn.execute(text("DELETE FROM ERP_MANTENIMIENTO_ORDEN WHERE Orden_Id = :oid"), {"oid": orden_id})

    return {"success": True}
