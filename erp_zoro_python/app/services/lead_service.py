from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company, user_company_ids, build_in_clause


def _check_access(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

def list_leads(current_user: dict[str, Any], filtros: dict) -> list[dict]:
    ids = user_company_ids(current_user)
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_super_admin"):
        if not ids:
            return []
        clause, clause_params = build_in_clause("cid", ids)
        where.append(f"l.Company_Id IN ({clause})")
        params.update(clause_params)

    if filtros.get("Company_Id"):
        _check_access(current_user, int(filtros["Company_Id"]))
        where.append("l.Company_Id = :filter_cid")
        params["filter_cid"] = int(filtros["Company_Id"])

    if filtros.get("Status"):
        where.append("l.Status = :status")
        params["status"] = filtros["Status"]

    if filtros.get("Asignado_Id"):
        where.append("l.Asignado_Id = :asignado")
        params["asignado"] = int(filtros["Asignado_Id"])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT l.*,
                       u.Name + ' ' + u.Lastname AS AsignadoNombre,
                       e.Nombre AS EquipoNombre,
                       c.NameCompany
                FROM ERP_CRM_LEADS l
                LEFT JOIN ERP_USERS u ON u.User_Id = l.Asignado_Id
                LEFT JOIN ERP_CRM_EQUIPOS e ON e.Equipo_Id = l.Equipo_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = l.Company_Id
                {where_sql}
                ORDER BY l.FechaCreacion DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


def get_lead(lead_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text(
                """
                SELECT l.*,
                       u.Name + ' ' + u.Lastname AS AsignadoNombre,
                       e.Nombre AS EquipoNombre,
                       c.NameCompany
                FROM ERP_CRM_LEADS l
                LEFT JOIN ERP_USERS u ON u.User_Id = l.Asignado_Id
                LEFT JOIN ERP_CRM_EQUIPOS e ON e.Equipo_Id = l.Equipo_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = l.Company_Id
                WHERE l.Lead_Id = :lid
                """
            ),
            {"lid": lead_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    _check_access(current_user, int(row["Company_Id"]))
    return dict(row)


def create_lead(payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    company_id = int(payload.get("Company_Id") or 0)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_access(current_user, company_id)

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_CRM_LEADS
                    (Company_Id, Nombre, Email, Telefono, Empresa, Cargo,
                     Origen, Status, Asignado_Id, Equipo_Id, Notas, CreadoPor)
                OUTPUT INSERTED.Lead_Id
                VALUES (:cid, :nombre, :email, :tel, :empresa, :cargo,
                        :origen, 'NUEVO', :asignado, :equipo, :notas, :creado)
                """
            ),
            {
                "cid": company_id,
                "nombre": payload.get("Nombre"),
                "email": payload.get("Email"),
                "tel": payload.get("Telefono"),
                "empresa": payload.get("Empresa"),
                "cargo": payload.get("Cargo"),
                "origen": payload.get("Origen"),
                "asignado": payload.get("Asignado_Id"),
                "equipo": payload.get("Equipo_Id"),
                "notas": payload.get("Notas"),
                "creado": str(current_user.get("Username") or current_user.get("Email") or ""),
            },
        ).mappings().first()
    return {"success": True, "Lead_Id": int(row["Lead_Id"])}


def update_lead(lead_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        lead = conn.execute(
            text("SELECT Company_Id FROM ERP_CRM_LEADS WHERE Lead_Id = :lid"),
            {"lid": lead_id},
        ).mappings().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    _check_access(current_user, int(lead["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_CRM_LEADS
                SET Nombre=:nombre, Email=:email, Telefono=:tel, Empresa=:empresa,
                    Cargo=:cargo, Origen=:origen, Status=:status,
                    Asignado_Id=:asignado, Equipo_Id=:equipo, Notas=:notas,
                    FechaUltimoContacto=CASE WHEN :contactado=1 THEN GETDATE() ELSE FechaUltimoContacto END,
                    UpdatedAt=GETDATE()
                WHERE Lead_Id=:lid
                """
            ),
            {
                "lid": lead_id,
                "nombre": payload.get("Nombre"),
                "email": payload.get("Email"),
                "tel": payload.get("Telefono"),
                "empresa": payload.get("Empresa"),
                "cargo": payload.get("Cargo"),
                "origen": payload.get("Origen"),
                "status": payload.get("Status"),
                "asignado": payload.get("Asignado_Id"),
                "equipo": payload.get("Equipo_Id"),
                "notas": payload.get("Notas"),
                "contactado": 1 if payload.get("Status") == "CONTACTADO" else 0,
            },
        )
    return {"success": True}


def convertir_a_oportunidad(lead_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        lead = conn.execute(
            text("SELECT * FROM ERP_CRM_LEADS WHERE Lead_Id = :lid"),
            {"lid": lead_id},
        ).mappings().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    _check_access(current_user, int(lead["Company_Id"]))
    if lead["Status"] == "CONVERTIDO":
        raise HTTPException(status_code=400, detail="Lead ya fue convertido a oportunidad")

    with get_transaction() as conn:
        # Obtener primera etapa CRM activa
        etapa = conn.execute(
            text("SELECT TOP 1 Etapa_Id FROM ERP_CRM_ETAPAS WHERE Activo=1 ORDER BY Orden ASC")
        ).mappings().first()
        etapa_id = int(etapa["Etapa_Id"]) if etapa else None

        oport_row = conn.execute(
            text(
                """
                INSERT INTO ERP_CRM_OPORTUNIDADES
                    (NombreOportunidad, Company_Id, Cliente_Id, MontoEstimado,
                     Probabilidad, Etapa_Id, Status, Asignado_Id, Lead_Id, Notas)
                OUTPUT INSERTED.Oportunidad_Id
                VALUES (:nombre, :cid, :cliente, :monto, :prob, :etapa, 'Abierta',
                        :asignado, :lead_id, :notas)
                """
            ),
            {
                "nombre": payload.get("NombreOportunidad") or f"Oportunidad — {lead['Nombre']}",
                "cid": lead["Company_Id"],
                "cliente": payload.get("Client_Id"),
                "monto": payload.get("MontoEstimado"),
                "prob": payload.get("Probabilidad") or 50,
                "etapa": etapa_id,
                "asignado": lead["Asignado_Id"],
                "lead_id": lead_id,
                "notas": lead["Notas"],
            },
        ).mappings().first()
        oportunidad_id = int(oport_row["Oportunidad_Id"])

        conn.execute(
            text(
                "UPDATE ERP_CRM_LEADS SET Status='CONVERTIDO', Oportunidad_Id=:oid, UpdatedAt=GETDATE() WHERE Lead_Id=:lid"
            ),
            {"oid": oportunidad_id, "lid": lead_id},
        )

    return {"success": True, "Oportunidad_Id": oportunidad_id}


def delete_lead(lead_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        lead = conn.execute(
            text("SELECT Company_Id, Status FROM ERP_CRM_LEADS WHERE Lead_Id = :lid"),
            {"lid": lead_id},
        ).mappings().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    _check_access(current_user, int(lead["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_CRM_LEADS SET Status='DESCARTADO', UpdatedAt=GETDATE() WHERE Lead_Id=:lid"),
            {"lid": lead_id},
        )
    return {"success": True}


# ---------------------------------------------------------------------------
# Equipos de venta
# ---------------------------------------------------------------------------

def list_equipos(current_user: dict[str, Any], company_id: int | None) -> list[dict]:
    params: dict[str, Any] = {}
    where: list[str] = []

    ids = user_company_ids(current_user)
    if not current_user.get("is_super_admin"):
        if not ids:
            return []
        clause, clause_params = build_in_clause("cid", ids)
        where.append(f"e.Company_Id IN ({clause})")
        params.update(clause_params)

    if company_id:
        where.append("e.Company_Id = :filter_cid")
        params["filter_cid"] = company_id

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT e.*,
                       u.Name + ' ' + u.Lastname AS LiderNombre,
                       c.NameCompany,
                       (SELECT COUNT(*) FROM ERP_CRM_EQUIPO_MIEMBROS m WHERE m.Equipo_Id = e.Equipo_Id) AS TotalMiembros
                FROM ERP_CRM_EQUIPOS e
                LEFT JOIN ERP_USERS u ON u.User_Id = e.Lider_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = e.Company_Id
                {where_sql}
                ORDER BY e.Nombre
                """
            ),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


def get_equipo(equipo_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        equipo = conn.execute(
            text(
                """
                SELECT e.*, u.Name + ' ' + u.Lastname AS LiderNombre, c.NameCompany
                FROM ERP_CRM_EQUIPOS e
                LEFT JOIN ERP_USERS u ON u.User_Id = e.Lider_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = e.Company_Id
                WHERE e.Equipo_Id = :eid
                """
            ),
            {"eid": equipo_id},
        ).mappings().first()
        if not equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        _check_access(current_user, int(equipo["Company_Id"]))

        miembros = conn.execute(
            text(
                """
                SELECT m.User_Id, u.Name + ' ' + u.Lastname AS Nombre, u.Username, u.Email
                FROM ERP_CRM_EQUIPO_MIEMBROS m
                JOIN ERP_USERS u ON u.User_Id = m.User_Id
                WHERE m.Equipo_Id = :eid
                """
            ),
            {"eid": equipo_id},
        ).mappings().all()

    result = dict(equipo)
    result["miembros"] = [dict(m) for m in miembros]
    return result


def create_equipo(payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    company_id = int(payload.get("Company_Id") or 0)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_access(current_user, company_id)

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_CRM_EQUIPOS (Company_Id, Nombre, Lider_Id, Activo)
                OUTPUT INSERTED.Equipo_Id
                VALUES (:cid, :nombre, :lider, 1)
                """
            ),
            {"cid": company_id, "nombre": payload["Nombre"], "lider": payload.get("Lider_Id")},
        ).mappings().first()
        equipo_id = int(row["Equipo_Id"])

        for uid in payload.get("miembros") or []:
            conn.execute(
                text("INSERT INTO ERP_CRM_EQUIPO_MIEMBROS (Equipo_Id, User_Id) VALUES (:eid, :uid)"),
                {"eid": equipo_id, "uid": int(uid)},
            )
    return {"success": True, "Equipo_Id": equipo_id}


def update_equipo(equipo_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        equipo = conn.execute(
            text("SELECT Company_Id FROM ERP_CRM_EQUIPOS WHERE Equipo_Id=:eid"),
            {"eid": equipo_id},
        ).mappings().first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    _check_access(current_user, int(equipo["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text(
                "UPDATE ERP_CRM_EQUIPOS SET Nombre=:nombre, Lider_Id=:lider, Activo=:activo WHERE Equipo_Id=:eid"
            ),
            {"eid": equipo_id, "nombre": payload["Nombre"], "lider": payload.get("Lider_Id"), "activo": 1 if payload.get("Activo", True) else 0},
        )
        if payload.get("miembros") is not None:
            conn.execute(
                text("DELETE FROM ERP_CRM_EQUIPO_MIEMBROS WHERE Equipo_Id=:eid"),
                {"eid": equipo_id},
            )
            for uid in payload["miembros"]:
                conn.execute(
                    text("INSERT INTO ERP_CRM_EQUIPO_MIEMBROS (Equipo_Id, User_Id) VALUES (:eid, :uid)"),
                    {"eid": equipo_id, "uid": int(uid)},
                )
    return {"success": True}


def delete_equipo(equipo_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        equipo = conn.execute(
            text("SELECT Company_Id FROM ERP_CRM_EQUIPOS WHERE Equipo_Id=:eid"),
            {"eid": equipo_id},
        ).mappings().first()
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    _check_access(current_user, int(equipo["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(text("DELETE FROM ERP_CRM_EQUIPO_MIEMBROS WHERE Equipo_Id=:eid"), {"eid": equipo_id})
        conn.execute(text("DELETE FROM ERP_CRM_EQUIPOS WHERE Equipo_Id=:eid"), {"eid": equipo_id})
    return {"success": True}
