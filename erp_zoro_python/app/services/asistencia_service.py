from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _company_filter(current_user: dict[str, Any], params: dict, alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    if current_user.get("is_admin"):
        return ""
    companies = user_company_ids(current_user)
    if not companies:
        return " AND 1=0"
    clause, clause_params = build_in_clause("company", companies)
    params.update(clause_params)
    return f" AND {prefix}Company_Id IN ({clause})"


def check_in(user_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    if not can_access_company(current_user, int(company_id)):
        raise HTTPException(status_code=403, detail="Sin acceso")

    with get_connection() as conn:
        existing = conn.execute(
            text("""
                SELECT Asist_Id FROM ERP_ASISTENCIA
                WHERE User_Id=:uid AND Company_Id=:cid
                  AND CAST(Fecha AS DATE) = CAST(GETDATE() AS DATE)
                  AND HoraSalida IS NULL
            """),
            {"uid": user_id, "cid": company_id},
        ).mappings().first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un check-in activo para hoy")

    tipo = payload.get("Tipo", "normal")
    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_ASISTENCIA (User_Id, Company_Id, Fecha, HoraEntrada, Tipo)
                OUTPUT INSERTED.Asist_Id
                VALUES (:uid, :cid, CAST(GETDATE() AS DATE), GETDATE(), :tipo)
            """),
            {"uid": user_id, "cid": company_id, "tipo": tipo},
        )
        asist_id = result.scalar()
    return {"success": True, "message": "Check-in registrado", "data": {"Asist_Id": asist_id}}


def check_out(user_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")

    with get_connection() as conn:
        registro = conn.execute(
            text("""
                SELECT Asist_Id FROM ERP_ASISTENCIA
                WHERE User_Id=:uid AND Company_Id=:cid
                  AND CAST(Fecha AS DATE) = CAST(GETDATE() AS DATE)
                  AND HoraSalida IS NULL
            """),
            {"uid": user_id, "cid": company_id},
        ).mappings().first()
    if not registro:
        raise HTTPException(status_code=404, detail="No hay check-in activo para hoy")

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_ASISTENCIA SET HoraSalida=GETDATE() WHERE Asist_Id=:id"),
            {"id": registro["Asist_Id"]},
        )
    return {"success": True, "message": "Check-out registrado"}


def get_estado_hoy(user_id: int, company_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT Asist_Id, HoraEntrada, HoraSalida, Tipo
                FROM ERP_ASISTENCIA
                WHERE User_Id=:uid AND Company_Id=:cid
                  AND CAST(Fecha AS DATE) = CAST(GETDATE() AS DATE)
            """),
            {"uid": user_id, "cid": company_id},
        ).mappings().first()
    return {"success": True, "data": dict(row) if row else None}


def list_asistencia(current_user: dict[str, Any], company_id: int | None, mes: str | None, user_id_filter: int | None) -> dict[str, Any]:
    params: dict[str, Any] = {}
    query = """
        SELECT a.Asist_Id, a.User_Id, u.Username, a.Company_Id, c.NameCompany,
               a.Fecha, a.HoraEntrada, a.HoraSalida, a.Tipo,
               CASE WHEN a.HoraSalida IS NOT NULL
                    THEN DATEDIFF(MINUTE, a.HoraEntrada, a.HoraSalida)
                    ELSE NULL END AS MinutosTrabajados
        FROM ERP_ASISTENCIA a
        JOIN ERP_USERS u ON u.User_Id = a.User_Id
        JOIN ERP_COMPANY c ON c.Company_Id = a.Company_Id
        WHERE 1=1
    """
    query += _company_filter(current_user, params, "a")
    if company_id:
        query += " AND a.Company_Id = :filter_cid"
        params["filter_cid"] = company_id
    if user_id_filter:
        query += " AND a.User_Id = :filter_uid"
        params["filter_uid"] = user_id_filter
    if mes:
        query += " AND FORMAT(a.Fecha, 'yyyy-MM') = :mes"
        params["mes"] = mes
    query += " ORDER BY a.Fecha DESC, a.HoraEntrada DESC"

    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def corregir_registro(asist_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden corregir registros")
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT Asist_Id, Company_Id FROM ERP_ASISTENCIA WHERE Asist_Id = :id"),
            {"id": asist_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    if not can_access_company(current_user, int(row["Company_Id"])):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")

    hora_entrada = payload.get("HoraEntrada")
    hora_salida = payload.get("HoraSalida")
    tipo = payload.get("Tipo")

    sets = []
    params: dict[str, Any] = {"id": asist_id}
    if hora_entrada is not None:
        sets.append("HoraEntrada = :entrada")
        params["entrada"] = hora_entrada
    if hora_salida is not None:
        sets.append("HoraSalida = :salida")
        params["salida"] = hora_salida if hora_salida != "" else None
    if tipo is not None:
        sets.append("Tipo = :tipo")
        params["tipo"] = tipo
    if not sets:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    with get_transaction() as conn:
        conn.execute(
            text(f"UPDATE ERP_ASISTENCIA SET {', '.join(sets)} WHERE Asist_Id = :id"),
            params,
        )
    return {"success": True, "message": "Registro corregido"}


def get_reporte_mensual(current_user: dict[str, Any], company_id: int | None, mes: str) -> dict[str, Any]:
    params: dict[str, Any] = {"mes": mes}
    query = """
        SELECT a.User_Id, u.Username,
               COUNT(*) AS DiasAsistidos,
               SUM(CASE WHEN a.HoraSalida IS NOT NULL
                        THEN DATEDIFF(MINUTE, a.HoraEntrada, a.HoraSalida)
                        ELSE 0 END) AS TotalMinutos,
               SUM(CASE WHEN a.Tipo='home_office' THEN 1 ELSE 0 END) AS DiasHomeOffice,
               SUM(CASE WHEN a.Tipo='permiso' THEN 1 ELSE 0 END) AS DiasPermiso
        FROM ERP_ASISTENCIA a
        JOIN ERP_USERS u ON u.User_Id = a.User_Id
        WHERE FORMAT(a.Fecha, 'yyyy-MM') = :mes
    """
    extra_filter: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if companies:
            clause, cp = build_in_clause("company_rep", companies)
            query += f" AND a.Company_Id IN ({clause})"
            extra_filter.update(cp)
    if company_id:
        query += " AND a.Company_Id = :filter_cid"
        extra_filter["filter_cid"] = company_id

    params.update(extra_filter)
    query += " GROUP BY a.User_Id, u.Username ORDER BY u.Username"

    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}
