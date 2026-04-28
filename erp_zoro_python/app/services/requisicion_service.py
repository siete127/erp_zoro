from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services import aprobacion_service
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _check_access(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def list_requisiciones(current_user: dict[str, Any], company_id_raw: str | None) -> list[dict]:
    ids = user_company_ids(current_user)
    params: dict[str, Any] = {}
    where_parts: list[str] = []

    if not current_user.get("is_super_admin"):
        if not ids:
            return []
        clause, clause_params = build_in_clause("cid", ids)
        where_parts.append(f"r.Company_Id IN ({clause})")
        params.update(clause_params)

    if company_id_raw and company_id_raw != "all":
        try:
            company_id = int(company_id_raw)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="company_id invalido") from exc
        _check_access(current_user, company_id)
        where_parts.append("r.Company_Id = :filter_cid")
        params["filter_cid"] = company_id

    where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT r.*,
                       u.Name + ' ' + u.Lastname AS SolicitanteNombre,
                       c.NameCompany
                FROM ERP_REQUISICION_COMPRA r
                LEFT JOIN ERP_USERS u ON u.User_Id = r.Solicitante_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = r.Company_Id
                {where}
                ORDER BY r.FechaSolicitud DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def get_requisicion(req_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text(
                """
                SELECT r.*,
                       u.Name + ' ' + u.Lastname AS SolicitanteNombre,
                       c.NameCompany
                FROM ERP_REQUISICION_COMPRA r
                LEFT JOIN ERP_USERS u ON u.User_Id = r.Solicitante_Id
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = r.Company_Id
                WHERE r.Req_Id = :req_id
                """
            ),
            {"req_id": req_id},
        ).mappings().first()
        if not req:
            raise HTTPException(status_code=404, detail="Requisicion no encontrada")
        _check_access(current_user, int(req["Company_Id"]))

        lines = conn.execute(
            text(
                """
                SELECT d.*,
                       p.Description AS ProductoNombre,
                       mp.Nombre AS MateriaPrimaNombre
                FROM ERP_REQUISICION_DETALLE d
                LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = d.Producto_Id
                LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = d.MateriaPrima_Id
                WHERE d.Req_Id = :req_id
                """
            ),
            {"req_id": req_id},
        ).mappings().all()

    return {**dict(req), "lineas": [dict(line) for line in lines]}


def create_requisicion(payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    company_id = int(payload.get("Company_Id") or 0)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_access(current_user, company_id)

    solicitante_id = int(payload.get("Solicitante_Id") or current_user.get("User_Id") or 0)
    lineas = list(payload.get("lineas") or [])

    with get_transaction() as conn:
        last = conn.execute(
            text(
                """
                SELECT TOP 1 NumeroReq
                FROM ERP_REQUISICION_COMPRA
                WHERE Company_Id = :cid
                ORDER BY Req_Id DESC
                """
            ),
            {"cid": company_id},
        ).mappings().first()
        numero = _next_numero(last["NumeroReq"] if last else None, company_id)

        row = conn.execute(
            text(
                """
                INSERT INTO ERP_REQUISICION_COMPRA
                    (Company_Id, Solicitante_Id, NumeroReq, FechaRequerida, Estatus, Notas)
                OUTPUT INSERTED.Req_Id
                VALUES (:cid, :sol, :num, :fecha_req, 'BORRADOR', :notas)
                """
            ),
            {
                "cid": company_id,
                "sol": solicitante_id,
                "num": numero,
                "fecha_req": payload.get("FechaRequerida"),
                "notas": payload.get("Notas"),
            },
        ).mappings().first()
        req_id = int(row["Req_Id"])

        for linea in lineas:
            conn.execute(
                text(
                    """
                    INSERT INTO ERP_REQUISICION_DETALLE
                        (Req_Id, Producto_Id, MateriaPrima_Id, Descripcion,
                         CantidadSolicitada, UnidadMedida, CostoEstimado)
                    VALUES (:req_id, :prod, :mp, :desc, :cant, :um, :costo)
                    """
                ),
                {
                    "req_id": req_id,
                    "prod": linea.get("Producto_Id"),
                    "mp": linea.get("MateriaPrima_Id"),
                    "desc": linea.get("Descripcion"),
                    "cant": float(linea.get("CantidadSolicitada") or 1),
                    "um": linea.get("UnidadMedida"),
                    "costo": linea.get("CostoEstimado"),
                },
            )

    return {"success": True, "Req_Id": req_id, "NumeroReq": numero}


def update_requisicion(req_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_REQUISICION_COMPRA WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisicion no encontrada")
    _check_access(current_user, int(req["Company_Id"]))
    if req["Estatus"] != "BORRADOR":
        raise HTTPException(status_code=400, detail="Solo se puede editar en estado BORRADOR")

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_REQUISICION_COMPRA
                SET FechaRequerida = :fecha,
                    Notas = :notas,
                    UpdatedAt = GETDATE()
                WHERE Req_Id = :req_id
                """
            ),
            {"req_id": req_id, "fecha": payload.get("FechaRequerida"), "notas": payload.get("Notas")},
        )
        if payload.get("lineas") is not None:
            conn.execute(text("DELETE FROM ERP_REQUISICION_DETALLE WHERE Req_Id = :req_id"), {"req_id": req_id})
            for linea in payload["lineas"]:
                conn.execute(
                    text(
                        """
                        INSERT INTO ERP_REQUISICION_DETALLE
                            (Req_Id, Producto_Id, MateriaPrima_Id, Descripcion,
                             CantidadSolicitada, UnidadMedida, CostoEstimado)
                        VALUES (:req_id, :prod, :mp, :desc, :cant, :um, :costo)
                        """
                    ),
                    {
                        "req_id": req_id,
                        "prod": linea.get("Producto_Id"),
                        "mp": linea.get("MateriaPrima_Id"),
                        "desc": linea.get("Descripcion"),
                        "cant": float(linea.get("CantidadSolicitada") or 1),
                        "um": linea.get("UnidadMedida"),
                        "costo": linea.get("CostoEstimado"),
                    },
                )

    return {"success": True, "message": "Requisicion actualizada"}


def enviar_requisicion(req_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_REQUISICION_COMPRA WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisicion no encontrada")
    _check_access(current_user, int(req["Company_Id"]))
    if req["Estatus"] != "BORRADOR":
        raise HTTPException(status_code=400, detail="Solo se puede enviar en estado BORRADOR")

    with get_transaction() as conn:
        total_row = conn.execute(
            text(
                """
                SELECT ISNULL(SUM(ISNULL(CantidadSolicitada, 0) * ISNULL(CostoEstimado, 0)), 0) AS TotalEstimado
                FROM ERP_REQUISICION_DETALLE
                WHERE Req_Id = :req_id
                """
            ),
            {"req_id": req_id},
        ).mappings().first()
        aprobacion_id = aprobacion_service.crear_solicitud(
            conn,
            modulo="REQUISICION",
            documento_id=req_id,
            company_id=int(req["Company_Id"]),
            monto=float((total_row or {}).get("TotalEstimado") or 0),
        )
        conn.execute(
            text(
                """
                UPDATE ERP_REQUISICION_COMPRA
                SET Estatus = :estatus,
                    UpdatedAt = GETDATE()
                WHERE Req_Id = :req_id
                """
            ),
            {
                "req_id": req_id,
                "estatus": "PENDIENTE_APROBACION" if aprobacion_id else "APROBADA",
            },
        )

    return {
        "success": True,
        "message": "Requisicion enviada a aprobacion" if aprobacion_id else "Requisicion aprobada automaticamente",
        "Aprobacion_Id": aprobacion_id,
    }


def aprobar_requisicion(req_id: int, aprobado: bool, comentario: str | None, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_REQUISICION_COMPRA WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisicion no encontrada")
    _check_access(current_user, int(req["Company_Id"]))
    if req["Estatus"] != "PENDIENTE_APROBACION":
        raise HTTPException(status_code=400, detail="La requisicion no esta pendiente de aprobacion")

    nuevo = "APROBADA" if aprobado else "RECHAZADA"
    with get_transaction() as conn:
        solicitud = aprobacion_service.get_pending_solicitud(
            conn,
            "REQUISICION",
            req_id,
            int(req["Company_Id"]),
        )
        if solicitud:
            aprobacion_service.decidir_aprobacion_tx(conn, solicitud, aprobado, comentario, current_user)
        else:
            conn.execute(
                text(
                    """
                    UPDATE ERP_REQUISICION_COMPRA
                    SET Estatus = :estatus,
                        AprobadoPor = :aprobador,
                        FechaAprobacion = GETDATE(),
                        ComentarioRechazo = :comentario,
                        UpdatedAt = GETDATE()
                    WHERE Req_Id = :req_id
                    """
                ),
                {
                    "req_id": req_id,
                    "estatus": nuevo,
                    "aprobador": int(current_user.get("User_Id") or 0),
                    "comentario": comentario if not aprobado else None,
                },
            )

    return {"success": True, "message": f"Requisicion {nuevo.lower()}"}


def convertir_a_oc(req_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text("SELECT * FROM ERP_REQUISICION_COMPRA WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().first()
        if not req:
            raise HTTPException(status_code=404, detail="Requisicion no encontrada")
        _check_access(current_user, int(req["Company_Id"]))
        if req["Estatus"] != "APROBADA":
            raise HTTPException(status_code=400, detail="La requisicion debe estar APROBADA para convertir a OC")
        if req["OC_Id"]:
            raise HTTPException(status_code=400, detail="Esta requisicion ya fue convertida a OC")

        lines = conn.execute(
            text("SELECT * FROM ERP_REQUISICION_DETALLE WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().all()

    proveedor_id = int(payload.get("Proveedor_Id") or 0)
    if not proveedor_id:
        raise HTTPException(status_code=400, detail="Proveedor_Id requerido para crear OC")

    with get_transaction() as conn:
        last_oc = conn.execute(
            text("SELECT TOP 1 NumeroOC FROM ERP_COMPRA_ORDEN WHERE Company_Id = :cid ORDER BY OC_Id DESC"),
            {"cid": req["Company_Id"]},
        ).mappings().first()
        numero_oc = _next_oc_numero(last_oc["NumeroOC"] if last_oc else None, int(req["Company_Id"]))

        oc_row = conn.execute(
            text(
                """
                INSERT INTO ERP_COMPRA_ORDEN
                    (NumeroOC, Company_Id, Proveedor_Id, FechaRequerida, Moneda, Subtotal, IVA, Total,
                     Estatus, Observaciones, CreatedBy)
                OUTPUT INSERTED.OC_Id
                VALUES (:num, :cid, :prov, :fecha_req, :moneda, 0, 0, 0, 'BORRADOR', :obs, :creado_por)
                """
            ),
            {
                "num": numero_oc,
                "cid": req["Company_Id"],
                "prov": proveedor_id,
                "fecha_req": req["FechaRequerida"],
                "moneda": payload.get("Moneda") or "MXN",
                "obs": f"Generada desde Requisicion {req['NumeroReq']}",
                "creado_por": str(current_user.get("Username") or "sistema"),
            },
        ).mappings().first()
        oc_id = int(oc_row["OC_Id"])

        for line in lines:
            conn.execute(
                text(
                    """
                    INSERT INTO ERP_COMPRA_ORDEN_DETALLE
                        (OC_Id, Producto_Id, MateriaPrima_Id, Descripcion,
                         Cantidad, PrecioCompra, IVA, Subtotal, Total)
                    VALUES (:oc_id, :prod, :mp, :desc, :cant, :precio, 0,
                            :cant * :precio, :cant * :precio)
                    """
                ),
                {
                    "oc_id": oc_id,
                    "prod": line.get("Producto_Id"),
                    "mp": line.get("MateriaPrima_Id"),
                    "desc": line.get("Descripcion") or "",
                    "cant": float(line["CantidadSolicitada"] or 1),
                    "precio": float(line.get("CostoEstimado") or 0),
                },
            )

        conn.execute(
            text(
                """
                UPDATE ERP_REQUISICION_COMPRA
                SET Estatus = 'CONVERTIDA',
                    OC_Id = :oc_id,
                    UpdatedAt = GETDATE()
                WHERE Req_Id = :req_id
                """
            ),
            {"oc_id": oc_id, "req_id": req_id},
        )

    return {"success": True, "OC_Id": oc_id, "NumeroOC": numero_oc}


def delete_requisicion(req_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        req = conn.execute(
            text("SELECT Company_Id, Estatus FROM ERP_REQUISICION_COMPRA WHERE Req_Id = :req_id"),
            {"req_id": req_id},
        ).mappings().first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisicion no encontrada")
    _check_access(current_user, int(req["Company_Id"]))
    if req["Estatus"] not in {"BORRADOR", "RECHAZADA"}:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar requisiciones en BORRADOR o RECHAZADA")

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_REQUISICION_COMPRA
                SET Estatus = 'CANCELADA',
                    UpdatedAt = GETDATE()
                WHERE Req_Id = :req_id
                """
            ),
            {"req_id": req_id},
        )
    return {"success": True, "message": "Requisicion cancelada"}


def _next_numero(last: str | None, company_id: int) -> str:
    prefix = f"REQ-{company_id:02d}-"
    if last and last.startswith(prefix):
        try:
            return f"{prefix}{int(last[len(prefix):]) + 1:04d}"
        except ValueError:
            pass
    return f"{prefix}0001"


def _next_oc_numero(last: str | None, company_id: int) -> str:
    prefix = f"OC-{company_id:02d}-"
    if last and last.startswith(prefix):
        try:
            return f"{prefix}{int(last[len(prefix):]) + 1:04d}"
        except ValueError:
            pass
    return f"{prefix}0001"
