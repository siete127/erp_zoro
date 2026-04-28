from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company


def list_reglas(company_id: int, current_user: dict[str, Any]) -> list[dict]:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT r.*,
                       u1.Name + ' ' + u1.Lastname AS Aprobador1Nombre,
                       u2.Name + ' ' + u2.Lastname AS Aprobador2Nombre
                FROM ERP_APROBACION_REGLAS r
                LEFT JOIN ERP_USERS u1 ON u1.User_Id = r.Aprobador1_Id
                LEFT JOIN ERP_USERS u2 ON u2.User_Id = r.Aprobador2_Id
                WHERE r.Company_Id = :cid
                ORDER BY r.Modulo, r.MontoMinimo
                """
            ),
            {"cid": company_id},
        ).mappings().all()
    return [dict(row) for row in rows]


def upsert_regla(payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    company_id = int(payload.get("Company_Id") or 0)
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")

    regla_id = payload.get("Regla_Id")
    with get_transaction() as conn:
        if regla_id:
            conn.execute(
                text(
                    """
                    UPDATE ERP_APROBACION_REGLAS
                    SET Modulo=:modulo, MontoMinimo=:monto, NivelesReq=:niveles,
                        Aprobador1_Id=:ap1, Aprobador2_Id=:ap2, Activo=:activo
                    WHERE Regla_Id=:rid AND Company_Id=:cid
                    """
                ),
                {
                    "rid": regla_id,
                    "cid": company_id,
                    "modulo": payload["Modulo"],
                    "monto": payload.get("MontoMinimo"),
                    "niveles": int(payload.get("NivelesReq") or 1),
                    "ap1": payload.get("Aprobador1_Id"),
                    "ap2": payload.get("Aprobador2_Id"),
                    "activo": 1 if payload.get("Activo", True) else 0,
                },
            )
        else:
            row = conn.execute(
                text(
                    """
                    INSERT INTO ERP_APROBACION_REGLAS
                        (Company_Id, Modulo, MontoMinimo, NivelesReq, Aprobador1_Id, Aprobador2_Id, Activo)
                    OUTPUT INSERTED.Regla_Id
                    VALUES (:cid, :modulo, :monto, :niveles, :ap1, :ap2, :activo)
                    """
                ),
                {
                    "cid": company_id,
                    "modulo": payload["Modulo"],
                    "monto": payload.get("MontoMinimo"),
                    "niveles": int(payload.get("NivelesReq") or 1),
                    "ap1": payload.get("Aprobador1_Id"),
                    "ap2": payload.get("Aprobador2_Id"),
                    "activo": 1,
                },
            ).mappings().first()
            regla_id = int(row["Regla_Id"])
    return {"success": True, "Regla_Id": regla_id}


def delete_regla(regla_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        regla = conn.execute(
            text("SELECT Company_Id FROM ERP_APROBACION_REGLAS WHERE Regla_Id=:rid"),
            {"rid": regla_id},
        ).mappings().first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    if not can_access_company(current_user, int(regla["Company_Id"])):
        raise HTTPException(status_code=403, detail="Sin acceso")

    with get_transaction() as conn:
        conn.execute(text("DELETE FROM ERP_APROBACION_REGLAS WHERE Regla_Id=:rid"), {"rid": regla_id})
    return {"success": True}


def get_regla_aplicable(conn, company_id: int, modulo: str, monto: float | None) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT TOP 1 *
            FROM ERP_APROBACION_REGLAS
            WHERE Company_Id = :cid
              AND Modulo = :mod
              AND Activo = 1
              AND (MontoMinimo IS NULL OR :monto >= MontoMinimo)
            ORDER BY MontoMinimo DESC
            """
        ),
        {"cid": company_id, "mod": modulo, "monto": monto or 0},
    ).mappings().first()
    return dict(row) if row else None


def get_pending_solicitud(
    conn,
    modulo: str,
    documento_id: int,
    company_id: int | None = None,
) -> dict | None:
    query = """
        SELECT TOP 1 *
        FROM ERP_APROBACIONES
        WHERE Modulo = :mod
          AND Documento_Id = :doc_id
          AND Estatus = 'PENDIENTE'
    """
    params: dict[str, Any] = {"mod": modulo, "doc_id": documento_id}
    if company_id is not None:
        query += " AND Company_Id = :cid"
        params["cid"] = company_id
    query += " ORDER BY Aprobacion_Id DESC"

    row = conn.execute(text(query), params).mappings().first()
    return dict(row) if row else None


def crear_solicitud(
    conn,
    *,
    modulo: str,
    documento_id: int,
    company_id: int,
    monto: float | None = None,
) -> int | None:
    regla = get_regla_aplicable(conn, company_id, modulo, monto)
    if not regla:
        return None

    existente = get_pending_solicitud(conn, modulo, documento_id, company_id)
    if existente:
        return int(existente["Aprobacion_Id"])

    row = conn.execute(
        text(
            """
            INSERT INTO ERP_APROBACIONES
                (Modulo, Documento_Id, Company_Id, Nivel, Aprobador_Id, Estatus)
            OUTPUT INSERTED.Aprobacion_Id
            VALUES (:mod, :doc_id, :cid, 1, :aprobador, 'PENDIENTE')
            """
        ),
        {
            "mod": modulo,
            "doc_id": documento_id,
            "cid": company_id,
            "aprobador": regla.get("Aprobador1_Id"),
        },
    ).mappings().first()
    return int(row["Aprobacion_Id"])


def list_aprobaciones(current_user: dict[str, Any], filtros: dict) -> list[dict]:
    user_id = int(current_user.get("User_Id") or 0)
    is_admin = current_user.get("is_super_admin") or int(current_user.get("RolId") or 99) <= 2

    params: dict[str, Any] = {}
    where: list[str] = []
    if not is_admin:
        where.append("a.Aprobador_Id = :uid")
        params["uid"] = user_id
    if filtros.get("Modulo"):
        where.append("a.Modulo = :modulo")
        params["modulo"] = filtros["Modulo"]
    if filtros.get("Estatus"):
        where.append("a.Estatus = :estatus")
        params["estatus"] = filtros["Estatus"]
    if filtros.get("Company_Id") and filtros["Company_Id"] != "all":
        where.append("a.Company_Id = :cid")
        params["cid"] = int(filtros["Company_Id"])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT a.*,
                       u.Name + ' ' + u.Lastname AS AprobadorNombre,
                       c.NameCompany
                FROM ERP_APROBACIONES a
                LEFT JOIN ERP_USERS u ON u.User_Id = a.Aprobador_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = a.Company_Id
                {where_sql}
                ORDER BY a.FechaSolicitud DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def decidir_aprobacion(
    aprobacion_id: int,
    aprobado: bool,
    comentarios: str | None,
    current_user: dict[str, Any],
) -> dict:
    with get_connection() as conn:
        apro = conn.execute(
            text("SELECT * FROM ERP_APROBACIONES WHERE Aprobacion_Id=:aid"),
            {"aid": aprobacion_id},
        ).mappings().first()
    if not apro:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    with get_transaction() as conn:
        nuevo_estatus = decidir_aprobacion_tx(conn, dict(apro), aprobado, comentarios, current_user)
    return {"success": True, "Estatus": nuevo_estatus}


def decidir_aprobacion_tx(
    conn,
    apro: dict,
    aprobado: bool,
    comentarios: str | None,
    current_user: dict[str, Any],
) -> str:
    if apro["Estatus"] != "PENDIENTE":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue procesada")

    user_id = int(current_user.get("User_Id") or 0)
    is_admin = current_user.get("is_super_admin") or int(current_user.get("RolId") or 99) <= 2
    if not is_admin and apro.get("Aprobador_Id") and int(apro["Aprobador_Id"]) != user_id:
        raise HTTPException(status_code=403, detail="No eres el aprobador asignado para esta solicitud")

    nuevo_estatus = "APROBADO" if aprobado else "RECHAZADO"
    conn.execute(
        text(
            """
            UPDATE ERP_APROBACIONES
            SET Estatus = :estatus,
                DecisionBy = :uid,
                Comentarios = :comentarios,
                FechaDecision = GETDATE()
            WHERE Aprobacion_Id = :aid
            """
        ),
        {
            "aid": int(apro["Aprobacion_Id"]),
            "estatus": nuevo_estatus,
            "uid": user_id,
            "comentarios": comentarios,
        },
    )
    _propagar_decision(conn, dict(apro), aprobado, comentarios)
    return nuevo_estatus


def _propagar_decision(conn, apro: dict, aprobado: bool, comentarios: str | None) -> None:
    modulo = apro["Modulo"]
    documento_id = int(apro["Documento_Id"])

    if modulo == "REQUISICION":
        conn.execute(
            text(
                """
                UPDATE ERP_REQUISICION_COMPRA
                SET Estatus = :estatus,
                    ComentarioRechazo = :comentarios,
                    UpdatedAt = GETDATE()
                WHERE Req_Id = :doc_id
                """
            ),
            {
                "estatus": "APROBADA" if aprobado else "RECHAZADA",
                "comentarios": comentarios if not aprobado else None,
                "doc_id": documento_id,
            },
        )
        return

    if modulo == "COTIZACION":
        conn.execute(
            text(
                """
                UPDATE ERP_COTIZACIONES
                SET Status = :estatus,
                    FechaModificacion = GETDATE()
                WHERE ID_COTIZACION = :doc_id
                """
            ),
            {
                "estatus": "APROBADA" if aprobado else "RECHAZADA",
                "doc_id": documento_id,
            },
        )
