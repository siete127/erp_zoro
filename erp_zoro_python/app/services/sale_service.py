from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ApiServiceError
from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services import factura_service, facturama_service, ledger_service
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _is_missing_sales_summary_dependency(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    tracked_tokens = [
        "erp_company",
        "erp_ventas",
        "namecompany",
        "status_id",
        "total",
        "company_id",
    ]
    return any(token in message for token in tracked_tokens) and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
        or "invalid column name" in message
        or "nombre de columna no valido" in message
    )


def create_sale(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload["Company_Id"])
    if not can_access_company(current_user, company_id):
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para crear ventas en esta empresa",
        )

    status_id = int(payload.get("Status_Id") or 1)
    with get_transaction() as connection:
        status_row = connection.execute(
            text("SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = :status_id"),
            {"status_id": status_id},
        ).mappings().first()
        status_name = status_row["Nombre"] if status_row else "Pendiente"

        sale = connection.execute(
            text(
                """
                INSERT INTO ERP_VENTAS (
                    Company_Id,
                    Client_Id,
                    Total,
                    IVA,
                    Subtotal,
                    Moneda,
                    Status_Id,
                    FechaVenta,
                    Status
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :client_id,
                    0,
                    0,
                    0,
                    :moneda,
                    :status_id,
                    GETDATE(),
                    :status_name
                )
                """
            ),
            {
                "company_id": company_id,
                "client_id": payload["Client_Id"],
                "moneda": payload.get("Moneda") or "MXN",
                "status_id": status_id,
                "status_name": status_name,
            },
        ).mappings().first()

    sale_id = sale["Venta_Id"] if sale else None
    if sale_id:
        emit_background("venta:changed", {"sale_id": sale_id})
    return {"success": True, "data": dict(sale) if sale else None}


def add_sale_products(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    sale_id = int(payload["Venta_Id"])
    products = payload.get("productos") or []
    if not products:
        raise HTTPException(status_code=400, detail="Debe especificar al menos un producto")

    with get_transaction() as connection:
        sale_row = connection.execute(
            text("SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        ).mappings().first()
        if not sale_row:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale_row["Company_Id"])):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para agregar productos a ventas de esta empresa",
            )

        subtotal_total = 0.0
        iva_total = 0.0
        total = 0.0
        for product in products:
            subtotal = float(product["Cantidad"]) * float(product["PrecioUnitario"])
            iva = subtotal * 0.16
            total_prod = subtotal + iva
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_VENTA_DETALLE (
                        Venta_Id,
                        Producto_Id,
                        Cantidad,
                        PrecioUnitario,
                        Subtotal,
                        IVA,
                        Total
                    )
                    VALUES (
                        :sale_id,
                        :product_id,
                        :cantidad,
                        :precio_unitario,
                        :subtotal,
                        :iva,
                        :total
                    )
                    """
                ),
                {
                    "sale_id": sale_id,
                    "product_id": product["Producto_Id"],
                    "cantidad": product["Cantidad"],
                    "precio_unitario": product["PrecioUnitario"],
                    "subtotal": subtotal,
                    "iva": iva,
                    "total": total_prod,
                },
            )
            subtotal_total += subtotal
            iva_total += iva
            total += total_prod

        status_row = connection.execute(
            text("SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = :status_id"),
            {"status_id": int(sale_row["Status_Id"])},
        ).mappings().first()
        status_name = status_row["Nombre"] if status_row else "Pendiente"

        connection.execute(
            text(
                """
                UPDATE ERP_VENTAS
                SET
                    Subtotal = :subtotal,
                    IVA = :iva,
                    Total = :total,
                    Status_Id = :status_id,
                    Status = :status_name
                WHERE Venta_Id = :sale_id
                """
            ),
            {
                "sale_id": sale_id,
                "subtotal": subtotal_total,
                "iva": iva_total,
                "total": total,
                "status_id": int(sale_row["Status_Id"]),
                "status_name": status_name,
            },
        )

    return {
        "success": True,
        "message": "Productos agregados correctamente",
        "data": {"Subtotal": subtotal_total, "IVA": iva_total, "Total": total},
    }


def get_sale_detail(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        sale = connection.execute(
            text(
                """
                SELECT
                    v.*,
                    CASE
                        WHEN UPPER(ISNULL(v.Status, '')) = 'CONFIRMADA' THEN v.Status
                        ELSE ISNULL(s.Nombre, v.Status)
                    END AS StatusNombre,
                    s.Descripcion AS StatusDescripcion,
                    c.RFC AS ClienteRFC,
                    c.LegalName AS ClienteNombre
                FROM ERP_VENTAS v
                LEFT JOIN ERP_VENTA_STATUS s ON v.Status_Id = s.Status_Id
                LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
                WHERE v.Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().first()

        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para ver ventas de esta empresa",
            )

        detail_rows = connection.execute(
            text(
                """
                SELECT
                    vd.*,
                    ISNULL(p.Nombre, 'Producto sin nombre') AS ProductoNombre,
                    p.SKU AS ProductoCodigo
                FROM ERP_VENTA_DETALLE vd
                LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
                WHERE vd.Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().all()

        solicitudes = connection.execute(
            text(
                """
                SELECT
                    s.Solicitud_Id,
                    s.Estado,
                    s.EstadoAprobador1,
                    s.EstadoAprobador2,
                    s.EmailAprobador1,
                    s.EmailAprobador2,
                    s.FechaCreacion,
                    s.FechaCompletado,
                    COUNT(d.Detalle_Id) AS CantidadProductos
                FROM ERP_SOLICITUDES_CAMBIO_PRECIO s
                LEFT JOIN ERP_SOLICITUD_PRECIO_DETALLE d ON s.Solicitud_Id = d.Solicitud_Id
                WHERE s.Venta_Id = :sale_id
                GROUP BY
                    s.Solicitud_Id,
                    s.Estado,
                    s.EstadoAprobador1,
                    s.EstadoAprobador2,
                    s.EmailAprobador1,
                    s.EmailAprobador2,
                    s.FechaCreacion,
                    s.FechaCompletado
                """
            ),
            {"sale_id": sale_id},
        ).mappings().all()

        solicitud_detalles = connection.execute(
            text(
                """
                SELECT
                    d.Detalle_Id,
                    d.Solicitud_Id,
                    d.Producto_Id,
                    p.Nombre AS ProductoNombre,
                    p.SKU AS ProductoCodigo,
                    d.PrecioActual,
                    d.PrecioNuevo
                FROM ERP_SOLICITUD_PRECIO_DETALLE d
                INNER JOIN ERP_SOLICITUDES_CAMBIO_PRECIO s ON d.Solicitud_Id = s.Solicitud_Id
                LEFT JOIN ERP_PRODUCTOS p ON d.Producto_Id = p.Producto_Id
                WHERE s.Venta_Id = :sale_id
                ORDER BY d.Solicitud_Id, d.Detalle_Id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().all()

    grouped = []
    for solicitud in solicitudes:
        grouped.append(
            {
                **dict(solicitud),
                "detalles": [
                    dict(item)
                    for item in solicitud_detalles
                    if int(item["Solicitud_Id"]) == int(solicitud["Solicitud_Id"])
                ],
            }
        )

    return {
        "success": True,
        "data": {
            "venta": dict(sale),
            "detalle": [dict(row) for row in detail_rows],
            "solicitudesPrecio": grouped,
        },
    }


def list_sales(
    current_user: dict[str, Any],
    company_id: int | None,
    status_id: int | None,
) -> dict[str, Any]:
    query = """
        SELECT
            v.*,
            CASE
                WHEN UPPER(ISNULL(v.Status, '')) = 'CONFIRMADA' THEN v.Status
                ELSE s.Nombre
            END AS StatusNombre,
            c.RFC AS ClienteRFC,
            c.LegalName AS ClienteNombre
        FROM ERP_VENTAS v
        LEFT JOIN ERP_VENTA_STATUS s ON v.Status_Id = s.Status_Id
        LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND v.Company_Id IN ({clause})"
        params.update(clause_params)
    elif company_id:
        query += " AND v.Company_Id = :company_id"
        params["company_id"] = company_id

    if status_id:
        query += " AND v.Status_Id = :status_id"
        params["status_id"] = status_id

    query += " ORDER BY v.FechaVenta DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def cancel_sale(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        sale = connection.execute(
            text("SELECT Company_Id FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        ).mappings().first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para cancelar ventas de esta empresa",
            )

        connection.execute(
            text(
                """
                UPDATE ERP_VENTAS
                SET
                    Status_Id = 4,
                    Status = 'Cancelada'
                WHERE Venta_Id = :sale_id AND Status_Id != 3
                """
            ),
            {"sale_id": sale_id},
        )

    emit_background("venta:changed", {"sale_id": sale_id})
    return {"success": True, "message": "Venta cancelada correctamente"}


def sales_summary_by_company(current_user: dict[str, Any]) -> dict[str, Any]:
    query = """
        SELECT
            c.Company_Id,
            c.NameCompany,
            COUNT(v.Venta_Id) AS TotalVentas,
            SUM(v.Total) AS TotalVentas_Monto,
            SUM(CASE WHEN v.Status_Id = 1 THEN 1 ELSE 0 END) AS VentasPendientes,
            SUM(CASE WHEN v.Status_Id = 2 THEN 1 ELSE 0 END) AS VentasEnProduccion,
            SUM(CASE WHEN v.Status_Id = 3 THEN 1 ELSE 0 END) AS VentasFacturadas,
            SUM(CASE WHEN v.Status_Id = 4 THEN 1 ELSE 0 END) AS VentasCanceladas,
            SUM(CASE WHEN v.Status_Id = 3 THEN v.Total ELSE 0 END) AS MontoFacturado
        FROM ERP_COMPANY c
        LEFT JOIN ERP_VENTAS v ON c.Company_Id = v.Company_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND c.Company_Id IN ({clause})"
        params.update(clause_params)

    query += " GROUP BY c.Company_Id, c.NameCompany ORDER BY c.Company_Id"
    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).mappings().all()
    except Exception as exc:
        if _is_missing_sales_summary_dependency(exc):
            return {"success": True, "data": []}
        raise
    return {"success": True, "data": [dict(row) for row in rows]}


def get_rentabilidad(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        sale = conn.execute(
            text("SELECT Venta_Id, Company_Id, Total FROM ERP_VENTAS WHERE Venta_Id=:id"),
            {"id": sale_id},
        ).mappings().first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")

        rows = conn.execute(
            text("""
                SELECT
                    vd.Producto_Id,
                    p.Nombre AS ProductoNombre,
                    p.SKU,
                    vd.Cantidad,
                    vd.Precio AS PrecioVenta,
                    ISNULL(vd.CostoUnitario, 0) AS CostoUnitario,
                    vd.Subtotal,
                    ISNULL(vd.CostoUnitario, 0) * vd.Cantidad AS CostoTotal,
                    CASE WHEN ISNULL(vd.CostoUnitario,0) > 0
                         THEN ROUND((vd.Precio - vd.CostoUnitario) / vd.Precio * 100, 2)
                         ELSE NULL END AS MargenPct
                FROM ERP_VENTA_DETALLE vd
                LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = vd.Producto_Id
                WHERE vd.Venta_Id = :id
            """),
            {"id": sale_id},
        ).mappings().all()

    detalle = [dict(r) for r in rows]
    total_costo = sum(float(r["CostoTotal"] or 0) for r in detalle)
    total_venta = float(sale["Total"] or 0)
    margen_total = round((total_venta - total_costo) / total_venta * 100, 2) if total_venta > 0 else None

    return {
        "Venta_Id": sale_id,
        "TotalVenta": total_venta,
        "TotalCosto": total_costo,
        "Utilidad": round(total_venta - total_costo, 2),
        "MargenPct": margen_total,
        "Detalle": detalle,
    }


def get_dashboard_kpis(current_user: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    company_filter = ""

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": {"ops_activas": 0, "margen_promedio": None}}
        clause, clause_params = build_in_clause("company", companies)
        company_filter = f" AND Company_Id IN ({clause})"
        params.update(clause_params)

    with get_connection() as conn:
        # ERP_ORDEN_PRODUCCION usa Status y no tiene Company_Id — se une por Venta_Id
        ops_filter = ""
        ops_params: dict[str, Any] = {}
        if company_filter:
            ops_filter = f" AND v.Company_Id IN ({','.join(str(c) for c in user_company_ids(current_user))})"

        ops_row = conn.execute(
            text(f"""
                SELECT COUNT(*) AS ops_activas
                FROM ERP_ORDEN_PRODUCCION op
                JOIN ERP_VENTAS v ON op.Venta_Id = v.Venta_Id
                WHERE op.Status NOT IN ('Cerrada', 'Cancelada'){ops_filter}
            """),
            ops_params,
        ).mappings().first()

        margen_row = conn.execute(
            text(f"""
                SELECT
                    AVG(sub.margen) AS margen_promedio
                FROM (
                    SELECT
                        v.Venta_Id,
                        CASE WHEN v.Total > 0
                            THEN (v.Total - SUM(vd.CostoUnitario * vd.Cantidad)) / v.Total * 100
                            ELSE NULL END AS margen
                    FROM ERP_VENTAS v
                    JOIN ERP_VENTA_DETALLE vd ON vd.Venta_Id = v.Venta_Id
                    WHERE v.Status_Id IN (2, 3){company_filter.replace('Company_Id', 'v.Company_Id')}
                    GROUP BY v.Venta_Id, v.Total
                ) sub
            """),
            params,
        ).mappings().first()

    ops_activas = int(ops_row["ops_activas"]) if ops_row else 0
    margen = float(margen_row["margen_promedio"]) if margen_row and margen_row["margen_promedio"] is not None else None

    return {"success": True, "data": {"ops_activas": ops_activas, "margen_promedio": round(margen, 1) if margen is not None else None}}


def get_sale_statuses() -> dict[str, Any]:
    with get_connection() as connection:
        rows = connection.execute(
            text("SELECT * FROM ERP_VENTA_STATUS ORDER BY Status_Id")
        ).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def update_sale(sale_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        sale = connection.execute(
            text("SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        ).mappings().first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para editar ventas de esta empresa",
            )
        if int(sale["Status_Id"]) == 3:
            raise HTTPException(status_code=400, detail="No se puede editar una venta facturada")

        updates: list[str] = []
        params: dict[str, Any] = {"sale_id": sale_id}

        if payload.get("Client_Id") is not None:
            updates.append("Client_Id = :client_id")
            params["client_id"] = payload["Client_Id"]
        if payload.get("Moneda") is not None:
            updates.append("Moneda = :moneda")
            params["moneda"] = payload["Moneda"]
        if payload.get("Status_Id") is not None:
            status_row = connection.execute(
                text("SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = :status_id"),
                {"status_id": int(payload["Status_Id"])},
            ).mappings().first()
            updates.append("Status_Id = :status_id")
            updates.append("Status = :status_name")
            params["status_id"] = int(payload["Status_Id"])
            params["status_name"] = status_row["Nombre"] if status_row else "Pendiente"

        if not updates:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        connection.execute(
            text(f"UPDATE ERP_VENTAS SET {', '.join(updates)} WHERE Venta_Id = :sale_id"),
            params,
        )

    emit_background("venta:changed", {"sale_id": sale_id})
    return {"success": True, "message": "Venta actualizada correctamente"}


def delete_sale(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        sale = connection.execute(
            text("SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        ).mappings().first()
        if not sale:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para eliminar ventas de esta empresa",
            )
        if int(sale["Status_Id"]) == 3:
            raise HTTPException(status_code=400, detail="No se puede eliminar una venta facturada")

        connection.execute(
            text("DELETE FROM ERP_VENTA_DETALLE WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        )
        connection.execute(
            text("DELETE FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        )

    emit_background("venta:changed", {"sale_id": sale_id})
    return {"success": True, "message": "Venta eliminada correctamente"}


def _with_fallback(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    normalized = str(value).strip()
    return normalized if normalized else fallback


def _get_stock_empresa(connection: Any, producto_id: int, company_id: int) -> float:
    row = connection.execute(
        text(
            """
            SELECT SUM(s.Cantidad) AS StockTotal
            FROM ERP_STOCK s
            INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
            WHERE s.Producto_Id = :producto_id
              AND a.Company_Id = :company_id
            """
        ),
        {"producto_id": producto_id, "company_id": company_id},
    ).mappings().first()
    return float(row["StockTotal"] or 0) if row else 0.0


def _get_stock_reservado_otras_ventas(
    connection: Any,
    *,
    producto_id: int,
    company_id: int,
    venta_id: int,
) -> float:
    row = connection.execute(
        text(
            """
            SELECT SUM(
                CASE
                    WHEN ISNULL(r.PiezasBuenas, 0) < ISNULL(op.CantidadPlanificada, 0)
                        THEN ISNULL(r.PiezasBuenas, 0)
                    ELSE ISNULL(op.CantidadPlanificada, 0)
                END
            ) AS CantidadReservada
            FROM ERP_OP_PRODUCCION op
            INNER JOIN ERP_OP_RESULTADO r ON r.OP_Id = op.OP_Id
            INNER JOIN ERP_VENTAS v ON v.Venta_Id = op.Venta_Id
            WHERE op.Producto_Id = :producto_id
              AND op.CompanySolicitante_Id = :company_id
              AND op.Venta_Id <> :venta_id
              AND op.Estado = 'CERRADA'
              AND v.Status_Id NOT IN (3, 4)
            """
        ),
        {
            "producto_id": producto_id,
            "company_id": company_id,
            "venta_id": venta_id,
        },
    ).mappings().first()
    return float(row["CantidadReservada"] or 0) if row else 0.0


def _get_stock_disponible_para_venta(
    connection: Any,
    *,
    producto_id: int,
    company_id: int,
    venta_id: int,
) -> dict[str, float]:
    stock_total = _get_stock_empresa(connection, producto_id, company_id)
    stock_reservado = _get_stock_reservado_otras_ventas(
        connection,
        producto_id=producto_id,
        company_id=company_id,
        venta_id=venta_id,
    )
    return {
        "stockTotal": stock_total,
        "stockReservado": stock_reservado,
        "stockDisponible": max(0.0, stock_total - stock_reservado),
    }


def _get_ptc_company_id(connection: Any) -> int | None:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 Company_Id
            FROM ERP_COMPANY
            WHERE NameCompany LIKE '%PTC%'
            """
        )
    ).mappings().first()
    return int(row["Company_Id"]) if row and row.get("Company_Id") else None


def _load_sale_for_invoicing(connection: Any, sale_id: int) -> dict[str, Any] | None:
    return connection.execute(
        text(
            """
            SELECT
                v.*,
                c.RFC AS ClienteRFC,
                c.LegalName AS ClienteNombre,
                c.TaxRegime AS ClienteFiscalRegime,
                addr.PostalCode AS ClienteTaxZipCode,
                cont.Email AS ClienteEmail
            FROM ERP_VENTAS v
            LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
            LEFT JOIN ERP_CLIENTADRESSES addr ON c.Client_Id = addr.Client_Id AND addr.IsPrimary = 1
            LEFT JOIN ERP_CLIENTCONTACTS cont ON c.Client_Id = cont.Client_Id AND cont.IsPrimary = 1
            WHERE v.Venta_Id = :sale_id
            """
        ),
        {"sale_id": sale_id},
    ).mappings().first()


def _load_sale_products(connection: Any, sale_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        text(
            """
            SELECT vd.*, p.Nombre
            FROM ERP_VENTA_DETALLE vd
            LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
            WHERE vd.Venta_Id = :sale_id
            """
        ),
        {"sale_id": sale_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _inventory_shortages(
    connection: Any,
    *,
    sale_id: int,
    sale: dict[str, Any],
    detail_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int | None]:
    shortages: list[dict[str, Any]] = []
    ptc_company_id = _get_ptc_company_id(connection)

    for item in detail_rows:
        producto_id = item.get("Producto_Id")
        if not producto_id:
            continue

        stock_propio_info = _get_stock_disponible_para_venta(
            connection,
            producto_id=int(producto_id),
            company_id=int(sale["Company_Id"]),
            venta_id=sale_id,
        )
        stock_propio = float(stock_propio_info["stockDisponible"])
        cantidad = float(item.get("Cantidad") or 0)

        if stock_propio >= cantidad:
            continue

        stock_ptc = 0.0
        if ptc_company_id and ptc_company_id != int(sale["Company_Id"]):
            stock_ptc_info = _get_stock_disponible_para_venta(
                connection,
                producto_id=int(producto_id),
                company_id=ptc_company_id,
                venta_id=sale_id,
            )
            stock_ptc = float(stock_ptc_info["stockDisponible"])

        faltante_propio = cantidad - stock_propio
        disponible_ptc = min(stock_ptc, faltante_propio)
        faltante_total = faltante_propio - disponible_ptc

        bom = connection.execute(
            text(
                """
                SELECT TOP 1 BOM_Id
                FROM ERP_BOM
                WHERE Producto_Id = :producto_id
                  AND Vigente = 1
                ORDER BY Version DESC
                """
            ),
            {"producto_id": producto_id},
        ).mappings().first()

        if faltante_total > 0:
            shortages.append(
                {
                    "Producto_Id": producto_id,
                    "Nombre": item.get("Nombre"),
                    "StockPropio": stock_propio,
                    "StockPropioFisico": stock_propio_info["stockTotal"],
                    "StockPropioReservado": stock_propio_info["stockReservado"],
                    "StockPTC": stock_ptc,
                    "DisponiblePTC": disponible_ptc,
                    "CantidadRequerida": cantidad,
                    "Faltante": max(0.0, faltante_total),
                    "FaltantePropio": faltante_propio,
                    "TieneBOM": bool(bom),
                    "RequiereProduccion": bool(bom) and faltante_total > 0,
                    "PuedeSurtirPTC": disponible_ptc > 0,
                }
            )

    return shortages, ptc_company_id


def _resolve_issuer_company_id(
    payload: dict[str, Any],
    current_user: dict[str, Any],
    sale_company_id: int,
) -> int:
    explicit_company = (
        payload.get("issuerCompanyId")
        or payload.get("IssuerCompanyId")
        or payload.get("x-company-id")
    )
    user_companies = [int(company_id) for company_id in current_user.get("companies") or []]

    if explicit_company is not None:
        issuer_company_id = int(explicit_company)
        if not current_user.get("is_admin") and user_companies and issuer_company_id not in user_companies:
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para timbrar como esa empresa",
                },
            )
        return issuer_company_id

    if current_user.get("is_admin"):
        return user_companies[0] if len(user_companies) == 1 else sale_company_id

    if len(user_companies) == 1:
        return user_companies[0]
    if len(user_companies) > 1:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": (
                    "Usuario asignado a multiples empresas. "
                    "Especifique `issuerCompanyId` en el body."
                ),
            },
        )
    return sale_company_id


def _consume_product_stock(
    connection: Any,
    *,
    company_id: int,
    product_id: int,
    product_name: str,
    quantity: float,
    sale_id: int,
    username: str,
) -> list[dict[str, Any]]:
    warehouses = connection.execute(
        text(
            """
            SELECT
                a.Almacen_Id,
                a.Nombre,
                ISNULL(s.Cantidad, 0) AS CantidadActual
            FROM ERP_ALMACENES a
            LEFT JOIN ERP_STOCK s
                ON s.Almacen_Id = a.Almacen_Id
               AND s.Producto_Id = :product_id
            WHERE a.Company_Id = :company_id
            ORDER BY
                CASE WHEN ISNULL(s.Cantidad, 0) >= :quantity THEN 0 ELSE 1 END,
                ISNULL(s.Cantidad, 0) DESC,
                a.Almacen_Id
            """
        ),
        {
            "product_id": product_id,
            "company_id": company_id,
            "quantity": quantity,
        },
    ).mappings().all()

    if not warehouses:
        return []

    remaining = float(quantity)
    movements: list[dict[str, Any]] = []
    reference = f"VENTA-{sale_id}"

    for warehouse in warehouses:
        if remaining <= 0:
            break

        stock_anterior = float(warehouse["CantidadActual"] or 0)
        if stock_anterior <= 0 and len(warehouses) > 1:
            continue

        deduction = min(stock_anterior, remaining) if stock_anterior > 0 else remaining
        stock_nuevo = stock_anterior - deduction

        stock_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM ERP_STOCK
                WHERE Producto_Id = :product_id AND Almacen_Id = :warehouse_id
                """
            ),
            {"product_id": product_id, "warehouse_id": warehouse["Almacen_Id"]},
        ).first()

        if stock_exists:
            connection.execute(
                text(
                    """
                    UPDATE ERP_STOCK
                    SET Cantidad = :cantidad
                    WHERE Producto_Id = :product_id AND Almacen_Id = :warehouse_id
                    """
                ),
                {
                    "cantidad": stock_nuevo,
                    "product_id": product_id,
                    "warehouse_id": warehouse["Almacen_Id"],
                },
            )
        else:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
                    VALUES (:product_id, :warehouse_id, :cantidad, 0)
                    """
                ),
                {
                    "product_id": product_id,
                    "warehouse_id": warehouse["Almacen_Id"],
                    "cantidad": stock_nuevo,
                },
            )

        connection.execute(
            text(
                """
                INSERT INTO ERP_KARDEX (
                    Producto_Id,
                    Almacen_Id,
                    TipoMovimiento,
                    Cantidad,
                    Stock_Anterior,
                    Stock_Actual,
                    Referencia,
                    Usuario,
                    FechaMovimiento
                )
                VALUES (
                    :product_id,
                    :warehouse_id,
                    'SALIDA',
                    :cantidad,
                    :stock_anterior,
                    :stock_actual,
                    :referencia,
                    :usuario,
                    GETDATE()
                )
                """
            ),
            {
                "product_id": product_id,
                "warehouse_id": warehouse["Almacen_Id"],
                "cantidad": deduction,
                "stock_anterior": stock_anterior,
                "stock_actual": stock_nuevo,
                "referencia": reference,
                "usuario": username,
            },
        )

        movements.append(
            {
                "Producto": product_name,
                "Almacen": warehouse["Nombre"],
                "Cantidad": deduction,
                "StockAnterior": stock_anterior,
                "StockNuevo": stock_nuevo,
            }
        )
        remaining = round(remaining - deduction, 2)

    return movements


def confirm_sale(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        sale = connection.execute(
            text(
                """
                SELECT Venta_Id, Company_Id, Status_Id, Status
                FROM ERP_VENTAS
                WHERE Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().first()

        if not sale:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Venta no encontrada"},
            )
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para confirmar ventas de esta empresa",
                },
            )

        if int(sale["Status_Id"] or 0) == 3:
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "La venta ya esta facturada"},
            )
        if int(sale["Status_Id"] or 0) == 4:
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "No se puede confirmar una venta cancelada"},
            )
        if str(sale.get("Status") or "").strip().lower() == "confirmada":
            return {
                "success": True,
                "message": "La venta ya estaba confirmada",
                "data": {"Venta_Id": sale_id, "Status_Id": 2, "Status": "Confirmada"},
            }

        op_summary = connection.execute(
            text(
                """
                SELECT
                    COUNT(*) AS TotalOP,
                    SUM(CASE WHEN Estado <> 'CERRADA' THEN 1 ELSE 0 END) AS TotalOPPendientes
                FROM ERP_OP_PRODUCCION
                WHERE Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().first()
        total_op = int((op_summary or {}).get("TotalOP") or 0)
        total_op_pendientes = int((op_summary or {}).get("TotalOPPendientes") or 0)
        if total_op > 0 and total_op_pendientes > 0:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": (
                        "No se puede confirmar la venta: hay "
                        f"{total_op_pendientes} orden(es) de produccion pendientes de cierre"
                    ),
                },
            )

        detail_rows = _load_sale_products(connection, sale_id)
        if not detail_rows:
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "No se puede confirmar una venta sin productos."},
            )

        shortages, ptc_company_id = _inventory_shortages(
            connection,
            sale_id=sale_id,
            sale=dict(sale),
            detail_rows=detail_rows,
        )
        if shortages:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "Inventario insuficiente. Verifique stock de PTC o solicite produccion.",
                    "requiereProduccion": True,
                    "productos": shortages,
                    "ptcCompanyId": ptc_company_id,
                    "sugerencia": (
                        "Los productos con faltante pueden solicitarse a PTC "
                        "(produccion) o surtirse de su stock existente"
                    ),
                },
            )

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_VENTAS
                SET Status_Id = 2, Status = 'Confirmada'
                WHERE Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        )
        # Asiento contable automático al confirmar la venta
        totales = connection.execute(
            text("SELECT Total, IVA, Subtotal, Company_Id FROM ERP_VENTAS WHERE Venta_Id = :sid"),
            {"sid": sale_id},
        ).mappings().first()
        if totales and float(totales["Total"] or 0) > 0:
            try:
                ledger_service.post_venta(
                    connection,
                    venta_id=sale_id,
                    company_id=int(totales["Company_Id"]),
                    total=float(totales["Total"] or 0),
                    subtotal=float(totales["Subtotal"] or 0),
                    iva=float(totales["IVA"] or 0),
                )
            except Exception:
                pass  # El asiento es best-effort — nunca bloquea la confirmación

    emit_background("venta:changed", {"sale_id": sale_id})
    return {
        "success": True,
        "message": "Venta confirmada correctamente. Ahora puede facturar.",
        "data": {"Venta_Id": sale_id, "Status_Id": 2, "Status": "Confirmada", "TotalOP": total_op},
    }


def invoice_sale(sale_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    generic_rfcs = {"XAXX010101000", "XEXX010101000"}

    with get_connection() as connection:
        sale = _load_sale_for_invoicing(connection, sale_id)
        if not sale:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Venta no encontrada"},
            )
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para facturar ventas de esta empresa",
                },
            )
        if int(sale["Status_Id"] or 0) == 3:
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "La venta ya esta facturada"},
            )

        sale_confirmed = str(sale.get("Status") or "").strip().lower() == "confirmada"
        if int(sale["Status_Id"] or 0) != 2 or not sale_confirmed:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "Primero debe confirmar la venta para poder facturarla",
                },
            )

        pending_ops = connection.execute(
            text(
                """
                SELECT COUNT(*) AS TotalPendientes
                FROM ERP_OP_PRODUCCION
                WHERE Venta_Id = :sale_id
                  AND Estado <> 'CERRADA'
                """
            ),
            {"sale_id": sale_id},
        ).mappings().first()
        total_pending_ops = int((pending_ops or {}).get("TotalPendientes") or 0)
        if total_pending_ops > 0:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": (
                        f"La venta tiene {total_pending_ops} orden(es) de produccion sin cerrar. "
                        "Confirme la venta cuando la produccion este concluida."
                    ),
                },
            )

        detail_rows = _load_sale_products(connection, sale_id)
        if not detail_rows:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": (
                        "No se puede facturar una venta sin productos. "
                        "Por favor, agrega al menos un producto a la venta antes de facturar."
                    ),
                },
            )

        shortages, ptc_company_id = _inventory_shortages(
            connection,
            sale_id=sale_id,
            sale=dict(sale),
            detail_rows=detail_rows,
        )
        if shortages:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "Inventario insuficiente. Verifique stock de PTC o solicite produccion.",
                    "requiereProduccion": True,
                    "productos": shortages,
                    "ptcCompanyId": ptc_company_id,
                    "sugerencia": (
                        "Los productos con faltante pueden solicitarse a PTC "
                        "(produccion) o surtirse de su stock existente"
                    ),
                },
            )

        conceptos = [
            {
                "ClaveProdServ": "01010101",
                "Cantidad": row.get("Cantidad"),
                "ClaveUnidad": "E48",
                "Unidad": "Pieza",
                "Descripcion": row.get("Nombre"),
                "ValorUnitario": row.get("PrecioUnitario"),
                "Importe": row.get("Subtotal"),
                "Impuestos": {
                    "Traslados": [
                        {
                            "Base": row.get("Subtotal"),
                            "Impuesto": "002",
                            "TipoFactor": "Tasa",
                            "TasaOCuota": "0.160000",
                            "Importe": row.get("IVA"),
                        }
                    ]
                },
            }
            for row in detail_rows
        ]

        client_rfc = str(sale.get("ClienteRFC") or "").strip().upper()
        body_rfc = str(payload.get("ReceptorRFC") or "").strip().upper()
        if client_rfc and body_rfc and body_rfc != client_rfc:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "El RFC del receptor no coincide con el RFC fiscal del cliente asociado a la venta",
                },
            )

        receiver_rfc = _with_fallback(body_rfc, client_rfc)
        legal_name = _with_fallback(sale.get("ClienteNombre"), None)
        requested_name = _with_fallback(payload.get("ReceptorNombre"), None)
        should_use_legal_name = bool(legal_name and receiver_rfc and receiver_rfc not in generic_rfcs)
        receiver_name = legal_name if should_use_legal_name else _with_fallback(requested_name, legal_name)
        issuer_company_id = _resolve_issuer_company_id(payload, current_user, int(sale["Company_Id"]))

        cfdi_data = {
            "Receptor": {
                "Rfc": receiver_rfc,
                "Nombre": receiver_name,
                "Email": _with_fallback(payload.get("ReceptorEmail"), sale.get("ClienteEmail")),
                "FiscalRegime": _with_fallback(
                    payload.get("ReceptorFiscalRegime"),
                    sale.get("ClienteFiscalRegime"),
                ),
                "TaxZipCode": _with_fallback(
                    payload.get("ReceptorTaxZipCode"),
                    sale.get("ClienteTaxZipCode"),
                ),
                "UsoCfdi": payload.get("UsoCFDI") or "G03",
            },
            "Conceptos": conceptos,
            "FormaPago": payload.get("FormaPago") or "01",
            "MetodoPago": payload.get("MetodoPago") or "PUE",
            "Moneda": sale.get("Moneda") or "MXN",
        }

    factura_payload = facturama_service.build_factura_payload(cfdi_data, issuer_company_id)
    cfdi_result = facturama_service.timbrar_for_company(factura_payload, issuer_company_id)

    movimientos_inventario: list[dict[str, Any]] = []
    with get_transaction() as connection:
        sale_row = _load_sale_for_invoicing(connection, sale_id)
        detail_rows = _load_sale_products(connection, sale_id)

        for row in detail_rows:
            producto_id = row.get("Producto_Id")
            if not producto_id:
                continue
            movimientos_inventario.extend(
                _consume_product_stock(
                    connection,
                    company_id=int(sale_row["Company_Id"]),
                    product_id=int(producto_id),
                    product_name=str(row.get("Nombre") or "Producto"),
                    quantity=float(row.get("Cantidad") or 0),
                    sale_id=sale_id,
                    username=str(current_user.get("Username") or "sistema"),
                )
            )

        factura_service.persist_invoice_record(
            connection,
            sale_id=sale_id,
            company_id=int(sale_row["Company_Id"]),
            factura_payload=factura_payload,
            cfdi_result=cfdi_result,
            metodo_pago=cfdi_data["MetodoPago"],
            forma_pago=cfdi_data["FormaPago"],
            created_by=str(current_user.get("Username") or "sistema"),
            default_totals=(
                float(sale_row.get("Subtotal") or 0),
                float(sale_row.get("IVA") or 0),
                float(sale_row.get("Total") or 0),
            ),
        )
        connection.execute(
            text(
                """
                UPDATE ERP_VENTAS
                SET Status_Id = 3, Status = 'Facturada'
                WHERE Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        )

    emit_background("venta:changed", {"sale_id": sale_id})
    return {
        "success": True,
        "message": "Venta facturada correctamente",
        "data": cfdi_result,
        "movimientosInventario": movimientos_inventario,
    }


def create_production_orders(
    sale_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    products = payload.get("productos") or []
    if payload.get("Producto_Id") and payload.get("Cantidad"):
        products = [{"Producto_Id": payload["Producto_Id"], "Cantidad": payload["Cantidad"]}]
    if not products:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Debe especificar al menos un producto"},
        )

    with get_transaction() as connection:
        sale = connection.execute(
            text("SELECT * FROM ERP_VENTAS WHERE Venta_Id = :sale_id"),
            {"sale_id": sale_id},
        ).mappings().first()
        if not sale:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Venta no encontrada"},
            )
        if not can_access_company(current_user, int(sale["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para crear ordenes de produccion para ventas de esta empresa",
                },
            )

        ptc_company_id = _get_ptc_company_id(connection) or int(sale["Company_Id"])
        created_orders: list[dict[str, Any]] = []

        for product in products:
            inserted = connection.execute(
                text(
                    """
                    INSERT INTO ERP_OP_PRODUCCION (
                        NumeroOP,
                        Company_Id,
                        CompanySolicitante_Id,
                        Venta_Id,
                        Producto_Id,
                        BOM_Id,
                        CantidadPlanificada,
                        Estado,
                        Prioridad,
                        FechaCreacion
                    )
                    OUTPUT INSERTED.*
                    SELECT
                        'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' +
                        RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
                        :ptc_company_id,
                        :sale_company_id,
                        :sale_id,
                        :product_id,
                        (
                            SELECT TOP 1 BOM_Id
                            FROM ERP_BOM
                            WHERE Producto_Id = :product_id
                              AND Vigente = 1
                            ORDER BY CASE WHEN Company_Id = :ptc_company_id THEN 0 ELSE 1 END, Version DESC
                        ),
                        :cantidad,
                        'EN_ESPERA',
                        'ALTA',
                        GETDATE()
                    """
                ),
                {
                    "ptc_company_id": ptc_company_id,
                    "sale_company_id": int(sale["Company_Id"]),
                    "sale_id": sale_id,
                    "product_id": int(product["Producto_Id"]),
                    "cantidad": float(product["Cantidad"]),
                },
            ).mappings().first()
            if inserted:
                created_orders.append(dict(inserted))

        connection.execute(
            text(
                """
                UPDATE ERP_VENTAS
                SET Status_Id = 1, Status = 'Pendiente'
                WHERE Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        )

    return {
        "success": True,
        "message": "Ordenes de produccion creadas correctamente",
        "data": created_orders,
    }


def register_production_entry(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    op_id = int(payload["OP_Id"])
    warehouse_id = int(payload["Almacen_Id"])

    with get_transaction() as connection:
        op = connection.execute(
            text(
                """
                SELECT op.*, r.PiezasBuenas
                FROM ERP_OP_PRODUCCION op
                INNER JOIN ERP_OP_RESULTADO r ON op.OP_Id = r.OP_Id
                WHERE op.OP_Id = :op_id AND op.Estado = 'CERRADA'
                """
            ),
            {"op_id": op_id},
        ).mappings().first()
        if not op:
            raise ApiServiceError(
                status_code=404,
                content={
                    "success": False,
                    "message": "Orden de produccion no encontrada o no esta cerrada",
                },
            )
        if not can_access_company(current_user, int(op["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para registrar entrada de produccion en esta empresa",
                },
            )

        stock = connection.execute(
            text(
                """
                SELECT Cantidad
                FROM ERP_STOCK
                WHERE Producto_Id = :product_id AND Almacen_Id = :warehouse_id
                """
            ),
            {"product_id": int(op["Producto_Id"]), "warehouse_id": warehouse_id},
        ).mappings().first()
        stock_anterior = float(stock["Cantidad"] or 0) if stock else 0.0
        stock_nuevo = stock_anterior + float(op["PiezasBuenas"] or 0)

        if stock:
            connection.execute(
                text(
                    """
                    UPDATE ERP_STOCK
                    SET Cantidad = :cantidad
                    WHERE Producto_Id = :product_id AND Almacen_Id = :warehouse_id
                    """
                ),
                {
                    "cantidad": stock_nuevo,
                    "product_id": int(op["Producto_Id"]),
                    "warehouse_id": warehouse_id,
                },
            )
        else:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
                    VALUES (:product_id, :warehouse_id, :cantidad, 0)
                    """
                ),
                {
                    "product_id": int(op["Producto_Id"]),
                    "warehouse_id": warehouse_id,
                    "cantidad": stock_nuevo,
                },
            )

        connection.execute(
            text(
                """
                INSERT INTO ERP_KARDEX (
                    Producto_Id,
                    Almacen_Id,
                    TipoMovimiento,
                    Cantidad,
                    Stock_Anterior,
                    Stock_Actual,
                    Referencia,
                    Usuario,
                    FechaMovimiento
                )
                VALUES (
                    :product_id,
                    :warehouse_id,
                    'ENTRADA',
                    :cantidad,
                    :stock_anterior,
                    :stock_actual,
                    :referencia,
                    :usuario,
                    GETDATE()
                )
                """
            ),
            {
                "product_id": int(op["Producto_Id"]),
                "warehouse_id": warehouse_id,
                "cantidad": float(op["PiezasBuenas"] or 0),
                "stock_anterior": stock_anterior,
                "stock_actual": stock_nuevo,
                "referencia": op["NumeroOP"],
                "usuario": str(current_user.get("Username") or "sistema"),
            },
        )

    return {
        "success": True,
        "message": "Entrada de produccion registrada correctamente",
        "data": {"Stock_Anterior": stock_anterior, "Stock_Actual": stock_nuevo},
    }


def get_invoice_pdf(sale_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        factura = connection.execute(
            text(
                """
                SELECT f.FacturamaId, f.UUID, v.Company_Id
                FROM ERP_FACTURAS f
                INNER JOIN ERP_VENTAS v ON v.Venta_Id = f.Venta_Id
                WHERE f.Venta_Id = :sale_id
                """
            ),
            {"sale_id": sale_id},
        ).mappings().first()
        if not factura:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Factura no encontrada"},
            )
        if not can_access_company(current_user, int(factura["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "No tiene permisos para descargar factura de esta empresa",
                },
            )

        facturama_id = str(factura.get("FacturamaId") or factura.get("UUID") or "").strip()
        if not facturama_id or facturama_id.startswith("TEMP-"):
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "Esta factura no tiene un ID valido de Facturama",
                },
            )

    return {
        "filename": f"factura-{facturama_id}.pdf",
        "content": facturama_service.descargar_pdf(facturama_id),
    }
