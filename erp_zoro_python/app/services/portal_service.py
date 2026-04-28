from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction


def _get_client_by_token(conn, token: str) -> dict[str, Any]:
    row = conn.execute(
        text(
            """
            SELECT
                c.Client_Id,
                c.Company_Id,
                COALESCE(NULLIF(c.CommercialName, ''), c.LegalName) AS Nombre,
                c.RFC,
                c.Email,
                c.TokenPortal
            FROM ERP_CLIENT c
            WHERE CAST(c.TokenPortal AS NVARCHAR(100)) = :token
              AND c.ClientType IN ('CLIENTE', 'AMBOS')
            """
        ),
        {"token": token},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Token de portal inválido o expirado")
    return dict(row)


def get_cliente_info(token: str) -> dict[str, Any]:
    with get_connection() as conn:
        cliente = _get_client_by_token(conn, token)
    return {
        "Client_Id": cliente["Client_Id"],
        "Nombre": cliente["Nombre"],
        "RFC": cliente["RFC"],
        "Email": cliente["Email"],
    }


def get_cotizaciones(token: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cliente = _get_client_by_token(conn, token)
        rows = conn.execute(
            text(
                """
                SELECT
                    c.Cotizacion_Id,
                    c.FolioCotizacion,
                    c.FechaCreacion,
                    c.FechaVencimiento,
                    c.Status,
                    c.Total,
                    c.Moneda,
                    c.Notas,
                    comp.NameCompany AS EmpresaNombre,
                    comp.Email AS EmpresaEmail
                FROM ERP_COTIZACIONES c
                LEFT JOIN ERP_COMPANY comp ON comp.Company_Id = c.Company_Id
                WHERE c.Client_Id = :client_id
                  AND c.Status NOT IN ('CANCELADA', 'CONVERTIDA')
                ORDER BY c.FechaCreacion DESC
                """
            ),
            {"client_id": cliente["Client_Id"]},
        ).mappings().all()
    return [dict(row) for row in rows]


def get_cotizacion_detalle(token: str, cotizacion_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        cliente = _get_client_by_token(conn, token)

        cab = conn.execute(
            text(
                """
                SELECT
                    c.*,
                    comp.NameCompany AS EmpresaNombre,
                    comp.Email AS EmpresaEmail,
                    comp.RFC AS EmpresaRFC,
                    u.Name AS VendedorNombre
                FROM ERP_COTIZACIONES c
                LEFT JOIN ERP_COMPANY comp ON comp.Company_Id = c.Company_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = c.UserId
                WHERE c.Cotizacion_Id = :cid AND c.Client_Id = :client_id
                """
            ),
            {"cid": cotizacion_id, "client_id": cliente["Client_Id"]},
        ).mappings().first()
        if not cab:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        renglones = conn.execute(
            text(
                """
                SELECT
                    r.*,
                    p.Nombre AS ProductoNombre,
                    p.SKU
                FROM ERP_COTIZACION_RENGLONES r
                LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = r.Producto_Id
                WHERE r.Cotizacion_Id = :cid
                ORDER BY r.Renglon
                """
            ),
            {"cid": cotizacion_id},
        ).mappings().all()

    return {"cotizacion": dict(cab), "renglones": [dict(row) for row in renglones]}


def aprobar_cotizacion(token: str, cotizacion_id: int) -> dict[str, Any]:
    with get_transaction() as conn:
        cliente = _get_client_by_token(conn, token)

        cab = conn.execute(
            text("SELECT Cotizacion_Id, Status FROM ERP_COTIZACIONES WHERE Cotizacion_Id = :cid AND Client_Id = :client_id"),
            {"cid": cotizacion_id, "client_id": cliente["Client_Id"]},
        ).mappings().first()
        if not cab:
            raise HTTPException(status_code=404, detail="Cotización no encontrada")

        status_actual = str(cab.get("Status") or "").upper()
        if status_actual in ("CONVERTIDA", "CANCELADA"):
            raise HTTPException(status_code=400, detail=f"La cotización está {status_actual} y no puede aprobarse")
        if status_actual == "APROBADA":
            return {"message": "La cotización ya estaba aprobada", "already_approved": True}

        conn.execute(
            text("UPDATE ERP_COTIZACIONES SET Status = 'APROBADA', UpdatedAt = GETDATE() WHERE Cotizacion_Id = :cid"),
            {"cid": cotizacion_id},
        )

    return {"message": "Cotización aprobada exitosamente", "Cotizacion_Id": cotizacion_id}


def get_facturas(token: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        cliente = _get_client_by_token(conn, token)
        rows = conn.execute(
            text(
                """
                SELECT
                    f.Factura_Id,
                    f.Folio,
                    f.Serie,
                    f.FechaEmision,
                    f.FechaVencimiento,
                    f.Total,
                    f.Moneda,
                    f.Estatus,
                    f.UUID,
                    comp.NameCompany AS EmpresaNombre
                FROM ERP_FACTURAS f
                LEFT JOIN ERP_COMPANY comp ON comp.Company_Id = f.Company_Id
                WHERE f.Client_Id = :client_id
                  AND f.Estatus NOT IN ('CANCELADA')
                ORDER BY f.FechaEmision DESC
                """
            ),
            {"client_id": cliente["Client_Id"]},
        ).mappings().all()
    return [dict(row) for row in rows]


def generar_token(client_id: int) -> dict[str, Any]:
    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                UPDATE ERP_CLIENT
                SET TokenPortal = NEWID()
                OUTPUT INSERTED.Client_Id, CAST(INSERTED.TokenPortal AS NVARCHAR(100)) AS TokenPortal
                WHERE Client_Id = :cid
                """
            ),
            {"cid": client_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"Client_Id": row["Client_Id"], "TokenPortal": row["TokenPortal"]}
