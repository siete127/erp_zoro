from __future__ import annotations

import random
import string
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, user_company_ids


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def request_price_change(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    product_id = int(payload["Producto_Id"])
    with get_transaction() as connection:
        product = connection.execute(
            text("SELECT Precio, Nombre FROM ERP_PRODUCTOS WHERE Producto_Id = :product_id"),
            {"product_id": product_id},
        ).mappings().first()

        if not product:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        code = _generate_code()
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_SOLICITUD_CAMBIO_PRECIO (
                    Producto_Id,
                    PrecioActual,
                    PrecioNuevo,
                    Motivo,
                    CodigoAprobacion,
                    SolicitadoPor
                )
                OUTPUT INSERTED.Solicitud_Id
                VALUES (
                    :product_id,
                    :precio_actual,
                    :precio_nuevo,
                    :motivo,
                    :codigo,
                    :solicitado_por
                )
                """
            ),
            {
                "product_id": product_id,
                "precio_actual": product["Precio"],
                "precio_nuevo": payload["PrecioNuevo"],
                "motivo": payload.get("Motivo"),
                "codigo": code,
                "solicitado_por": current_user.get("User_Id"),
            },
        )
        row = result.first()

    return {
        "msg": "Solicitud creada. Se ha generado un codigo de aprobacion.",
        "Solicitud_Id": int(row[0]) if row else None,
        "CodigoAprobacion": code,
    }


def approve_price_change(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, str]:
    request_id = int(payload["Solicitud_Id"])
    code = str(payload["CodigoAprobacion"]).strip().upper()

    with get_transaction() as connection:
        row = connection.execute(
            text(
                "SELECT * FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Solicitud_Id = :request_id"
            ),
            {"request_id": request_id},
        ).mappings().first()

        if not row:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")

        if str(row.get("Estado") or "PENDIENTE").upper() != "PENDIENTE":
            raise HTTPException(status_code=400, detail="La solicitud ya fue procesada")

        if str(row.get("CodigoAprobacion") or "").upper() != code:
            raise HTTPException(status_code=400, detail="Codigo de aprobacion incorrecto")

        connection.execute(
            text("UPDATE ERP_PRODUCTOS SET Precio = :precio WHERE Producto_Id = :product_id"),
            {"precio": row["PrecioNuevo"], "product_id": row["Producto_Id"]},
        )
        connection.execute(
            text(
                """
                UPDATE ERP_SOLICITUD_CAMBIO_PRECIO
                SET
                    Estado = 'APROBADO',
                    AprobadoPor = :aprobado_por,
                    FechaAprobacion = GETDATE()
                WHERE Solicitud_Id = :request_id
                """
            ),
            {"request_id": request_id, "aprobado_por": current_user.get("User_Id")},
        )

    return {"msg": "Cambio de precio aprobado y aplicado"}


def list_price_requests(current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            s.*,
            p.SKU,
            p.Nombre,
            u.Username AS Solicitante
        FROM ERP_SOLICITUD_CAMBIO_PRECIO s
        INNER JOIN ERP_PRODUCTOS p ON s.Producto_Id = p.Producto_Id
        LEFT JOIN ERP_USERS u ON s.SolicitadoPor = u.User_Id
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        query += f"""
            WHERE EXISTS (
                SELECT 1
                FROM ERP_PRODUCTO_EMPRESA pe
                WHERE pe.Producto_Id = p.Producto_Id
                  AND pe.Company_Id IN ({clause})
            )
        """
        params.update(clause_params)

    query += " ORDER BY s.FechaSolicitud DESC"

    with get_connection() as connection:
        result = connection.execute(text(query), params)
        return [dict(row) for row in result.mappings().all()]


def delete_price_request(request_id: int) -> dict[str, str]:
    with get_transaction() as connection:
        result = connection.execute(
            text("DELETE FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Solicitud_Id = :request_id"),
            {"request_id": request_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return {"msg": "Solicitud eliminada"}
