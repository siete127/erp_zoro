from __future__ import annotations

import os
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import text

from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services.email_service import send_multi_price_approval_email, send_price_approval_email
from app.services import notificacion_service

BACKEND_URL = os.getenv("BACKEND_URL", "https://qaerp.ardabytec.vip")


def get_client_prices(client_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    p.Producto_Id AS Product_Id,
                    p.Nombre AS ProductName,
                    p.Precio AS BasePrice,
                    cp.PrecioPersonalizado AS CustomPrice,
                    cp.Activo AS IsActive,
                    cp.FechaActualizacion AS UpdatedAt
                FROM ERP_PRODUCTOS p
                LEFT JOIN ERP_PRECIOS_CLIENTE_PRODUCTO cp
                    ON cp.Producto_Id = p.Producto_Id AND cp.Cliente_Id = :cid
                WHERE p.Activo = 1
                ORDER BY p.Nombre
            """),
            {"cid": client_id},
        ).mappings().all()
    return [dict(r) for r in rows]


def create_price_change_request(data: dict, requested_by: int) -> dict:
    client_id = data["clientId"]
    product_id = data["productId"]
    new_price = data["newPrice"]
    approver1 = data["approver1Email"]
    approver2 = data["approver2Email"]
    reason = data.get("reason", "")
    sale_id = data.get("saleId")

    with get_connection() as conn:
        row = conn.execute(
            text("SELECT PrecioPersonalizado FROM ERP_PRECIOS_CLIENTE_PRODUCTO WHERE Cliente_Id=:cid AND Producto_Id=:pid"),
            {"cid": client_id, "pid": product_id},
        ).fetchone()
    current_price = row[0] if row else None

    with get_transaction() as conn:
        req_row = conn.execute(
            text("""
                INSERT INTO ERP_SOLICITUDES_CAMBIO_PRECIO
                  (Cliente_Id, Producto_Id, PrecioActual, PrecioNuevo, SolicitadoPor,
                   EmailAprobador1, EmailAprobador2, Razon, Venta_Id)
                OUTPUT INSERTED.Solicitud_Id
                VALUES (:cid, :pid, :cur, :new, :por, :e1, :e2, :razon, :sale)
            """),
            {"cid": client_id, "pid": product_id, "cur": current_price, "new": new_price,
             "por": requested_by, "e1": approver1, "e2": approver2, "razon": reason, "sale": sale_id},
        ).fetchone()
    request_id = req_row[0]

    with get_connection() as conn:
        names = conn.execute(
            text("SELECT c.LegalName, p.Nombre FROM ERP_CLIENT c, ERP_PRODUCTOS p WHERE c.Client_Id=:cid AND p.Producto_Id=:pid"),
            {"cid": client_id, "pid": product_id},
        ).fetchone()
    client_name = names[0] if names else "Cliente"
    product_name = names[1] if names else "Producto"

    _send_single_approval_emails(request_id, approver1, approver2, client_name, product_name, new_price)
    return {"success": True, "message": "Solicitud creada. Esperando aprobaciones.", "requestId": request_id}


def create_multi_price_change_request(data: dict, requested_by: int) -> dict:
    client_id = data["clientId"]
    products = data.get("products", [])
    approver1 = data["approver1Email"]
    approver2 = data["approver2Email"]
    reason = data.get("reason", "")
    sale_id = data.get("saleId")

    if not products:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un producto")

    with get_transaction() as conn:
        req_row = conn.execute(
            text("""
                INSERT INTO ERP_SOLICITUDES_CAMBIO_PRECIO
                  (Cliente_Id, SolicitadoPor, EmailAprobador1, EmailAprobador2, Razon, Venta_Id,
                   Estado, EstadoAprobador1, EstadoAprobador2)
                OUTPUT INSERTED.Solicitud_Id
                VALUES (:cid, :por, :e1, :e2, :razon, :sale, 'pending', 'pending', 'pending')
            """),
            {"cid": client_id, "por": requested_by, "e1": approver1, "e2": approver2,
             "razon": reason, "sale": sale_id},
        ).fetchone()
        request_id = req_row[0]

        for p in products:
            conn.execute(
                text("""
                    INSERT INTO ERP_SOLICITUD_PRECIO_DETALLE (Solicitud_Id, Producto_Id, PrecioActual, PrecioNuevo)
                    VALUES (:sol, :pid, :cur, :new)
                """),
                {"sol": request_id, "pid": p["productId"], "cur": p.get("currentPrice"), "new": p["newPrice"]},
            )

    with get_connection() as conn:
        cli_row = conn.execute(
            text("SELECT LegalName FROM ERP_CLIENT WHERE Client_Id=:cid"),
            {"cid": client_id},
        ).fetchone()
    client_name = cli_row[0] if cli_row else "Cliente"

    products_with_names: list[dict] = []
    with get_connection() as conn:
        for p in products:
            nr = conn.execute(
                text("SELECT Nombre FROM ERP_PRODUCTOS WHERE Producto_Id=:pid"),
                {"pid": p["productId"]},
            ).fetchone()
            products_with_names.append({**p, "productName": nr[0] if nr else f"Producto {p['productId']}"})

    _send_multi_approval_emails(request_id, approver1, approver2, client_name, products_with_names)
    return {"success": True, "message": "Solicitud creada. Esperando aprobaciones.", "requestId": request_id}


def approve_price_change(request_id: int, approver_email: str, action: str) -> dict:
    if action not in ("approve", "reject"):
        raise ValueError("Acción inválida")

    norm_email = approver_email.lower().strip()

    with get_connection() as conn:
        req_row = conn.execute(
            text("""
                SELECT Solicitud_Id, Cliente_Id, SolicitadoPor, EmailAprobador1, EmailAprobador2,
                       EstadoAprobador1, EstadoAprobador2, Estado, Venta_Id
                FROM ERP_SOLICITUDES_CAMBIO_PRECIO WHERE Solicitud_Id=:rid
            """),
            {"rid": request_id},
        ).fetchone()

    if not req_row:
        return {"found": False}

    _, cliente_id, solicitado_por, email1, email2, estado_a1, estado_a2, estado, venta_id = req_row

    if estado in ("completed", "rejected"):
        return {"already_processed": True, "estado": estado}

    email1_n = (email1 or "").lower().strip()
    email2_n = (email2 or "").lower().strip()
    status_val = "approved" if action == "approve" else "rejected"
    approver_number = None

    if norm_email == email1_n:
        approver_number = 1
        with get_transaction() as conn:
            conn.execute(
                text("UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO SET EstadoAprobador1=:sv, FechaAprobador1=GETDATE() WHERE Solicitud_Id=:rid"),
                {"sv": status_val, "rid": request_id},
            )
    elif norm_email == email2_n:
        approver_number = 2
        with get_transaction() as conn:
            conn.execute(
                text("UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO SET EstadoAprobador2=:sv, FechaAprobador2=GETDATE() WHERE Solicitud_Id=:rid"),
                {"sv": status_val, "rid": request_id},
            )
    else:
        return {"unauthorized": True}

    with get_connection() as conn:
        upd = conn.execute(
            text("SELECT EstadoAprobador1, EstadoAprobador2, Estado, Cliente_Id, SolicitadoPor FROM ERP_SOLICITUDES_CAMBIO_PRECIO WHERE Solicitud_Id=:rid"),
            {"rid": request_id},
        ).fetchone()
    ea1, ea2, new_estado, cli_id, sol_por = upd

    if ea1 == "rejected" or ea2 == "rejected":
        with get_transaction() as conn:
            conn.execute(
                text("UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO SET Estado='rejected', FechaCompletado=GETDATE() WHERE Solicitud_Id=:rid"),
                {"rid": request_id},
            )
        client_name = _get_client_name(int(cli_id)) if cli_id else "cliente"
        link = f"/ventas/{int(venta_id)}" if venta_id else "/ventas"
        notificacion_service.create_notification(
            int(sol_por or 0),
            "precio_rechazado",
            "Solicitud de precio rechazada",
            f"La solicitud de cambio de precio para {client_name} fue rechazada.",
            link,
            dedupe_hours=24,
        )
        emit_background("priceRequestUpdate", {"requestId": request_id, "action": "rejected"})
        return {"action": "rejected", "requestId": request_id}

    if ea1 == "approved" and ea2 == "approved":
        with get_connection() as conn:
            details = conn.execute(
                text("SELECT Producto_Id, PrecioNuevo FROM ERP_SOLICITUD_PRECIO_DETALLE WHERE Solicitud_Id=:rid"),
                {"rid": request_id},
            ).fetchall()

        with get_transaction() as conn:
            for det in details:
                prod_id, nuevo_precio = det[0], det[1]
                exists = conn.execute(
                    text("SELECT 1 FROM ERP_PRECIOS_CLIENTE_PRODUCTO WHERE Cliente_Id=:cid AND Producto_Id=:pid"),
                    {"cid": cli_id, "pid": prod_id},
                ).fetchone()
                if exists:
                    conn.execute(
                        text("UPDATE ERP_PRECIOS_CLIENTE_PRODUCTO SET PrecioPersonalizado=:p, FechaActualizacion=GETDATE() WHERE Cliente_Id=:cid AND Producto_Id=:pid"),
                        {"p": nuevo_precio, "cid": cli_id, "pid": prod_id},
                    )
                else:
                    conn.execute(
                        text("INSERT INTO ERP_PRECIOS_CLIENTE_PRODUCTO (Cliente_Id, Producto_Id, PrecioPersonalizado, CreadoPor) VALUES (:cid,:pid,:p,:por)"),
                        {"cid": cli_id, "pid": prod_id, "p": nuevo_precio, "por": sol_por},
                    )
            conn.execute(
                text("UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO SET Estado='completed', FechaCompletado=GETDATE() WHERE Solicitud_Id=:rid"),
                {"rid": request_id},
            )
        client_name = _get_client_name(int(cli_id)) if cli_id else "cliente"
        link = f"/ventas/{int(venta_id)}" if venta_id else "/ventas"
        notificacion_service.create_notification(
            int(sol_por or 0),
            "precio_aprobado",
            "Solicitud de precio aprobada",
            f"La solicitud de cambio de precio para {client_name} fue aprobada y aplicada.",
            link,
            dedupe_hours=24,
        )
        emit_background("priceRequestUpdate", {"requestId": request_id, "action": "completed"})
        return {"action": "completed", "requestId": request_id}

    return {"action": "waiting", "approverNumber": approver_number, "userAction": action}


def get_price_request_status(request_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT Solicitud_Id, EstadoAprobador1, EstadoAprobador2, Estado FROM ERP_SOLICITUDES_CAMBIO_PRECIO WHERE Solicitud_Id=:rid"),
            {"rid": request_id},
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return {
        "success": True,
        "data": {
            "requestId": row[0],
            "approver1Status": row[1],
            "approver2Status": row[2],
            "status": row[3],
        },
    }


def get_pending_requests() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT r.Solicitud_Id, c.LegalName, p.Nombre, r.PrecioActual, r.PrecioNuevo,
                       r.EmailAprobador1, r.EmailAprobador2, r.EstadoAprobador1, r.EstadoAprobador2,
                       r.Estado, r.Razon, r.FechaCreacion, u.Name
                FROM ERP_SOLICITUDES_CAMBIO_PRECIO r
                INNER JOIN ERP_CLIENT c ON c.Client_Id = r.Cliente_Id
                INNER JOIN ERP_PRODUCTOS p ON p.Producto_Id = r.Producto_Id
                INNER JOIN ERP_USERS u ON u.User_Id = r.SolicitadoPor
                WHERE r.Estado = 'pending'
                ORDER BY r.FechaCreacion DESC
            """)
        ).fetchall()
    cols = ["Request_Id", "ClientName", "ProductName", "CurrentPrice", "NewPrice",
            "Approver1_Email", "Approver2_Email", "Approver1_Status", "Approver2_Status",
            "Status", "Reason", "CreatedAt", "RequestedByName"]
    return [dict(zip(cols, r)) for r in rows]


def check_sale_pending_requests(sale_id: int) -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT Solicitud_Id, Producto_Id, PrecioNuevo, EstadoAprobador1, EstadoAprobador2, Estado
                FROM ERP_SOLICITUDES_CAMBIO_PRECIO
                WHERE Venta_Id=:sid AND Estado='pending'
            """),
            {"sid": sale_id},
        ).fetchall()
    cols = ["Request_Id", "Product_Id", "NewPrice", "Approver1_Status", "Approver2_Status", "Status"]
    requests = [dict(zip(cols, r)) for r in rows]
    return {"success": True, "hasPending": len(requests) > 0, "requests": requests}


# ── helpers de email ──────────────────────────────────────────────────────────

def _approval_links(request_id: int, email: str) -> tuple[str, str]:
    enc = quote(email)
    base = f"{BACKEND_URL}/api/client-pricing/price-change-request/{request_id}/approve"
    return (
        f"{base}?approverEmail={enc}&action=approve",
        f"{base}?approverEmail={enc}&action=reject",
    )


def _get_client_name(client_id: int) -> str:
    with get_connection() as conn:
        value = conn.execute(
            text("SELECT TOP 1 LegalName FROM ERP_CLIENT WHERE Client_Id=:cid"),
            {"cid": client_id},
        ).scalar()
    return str(value or f"cliente {client_id}")


def _send_single_approval_emails(request_id, email1, email2, client_name, product_name, new_price):
    try:
        a1, r1 = _approval_links(request_id, email1)
        send_price_approval_email(email1, request_id, client_name, product_name, new_price, a1, r1)
        a2, r2 = _approval_links(request_id, email2)
        send_price_approval_email(email2, request_id, client_name, product_name, new_price, a2, r2)
    except Exception:
        pass


def _send_multi_approval_emails(request_id, email1, email2, client_name, products):
    try:
        a1, r1 = _approval_links(request_id, email1)
        send_multi_price_approval_email(email1, request_id, client_name, products, a1, r1)
        a2, r2 = _approval_links(request_id, email2)
        send_multi_price_approval_email(email2, request_id, client_name, products, a2, r2)
    except Exception:
        pass
