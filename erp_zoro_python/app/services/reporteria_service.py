from __future__ import annotations

from datetime import date
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection
from app.services import facturama_service as facturama_svc
from app.services import notificacion_service
from app.utils.company_access import build_in_clause, user_company_ids


def _is_missing_reporteria_dependency(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    tracked_tokens = [
        "erp_facturas",
        "erp_ventas",
        "fechatimbrado",
        "fechaventa",
        "status",
        "total",
        "receptornombre",
        "receptorrfc",
    ]
    return any(token in message for token in tracked_tokens) and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
        or "invalid column name" in message
        or "nombre de columna no valido" in message
    )


def _is_missing_executive_dependency(exc: Exception) -> bool:
    if _is_missing_reporteria_dependency(exc):
        return True
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    tracked_tokens = [
        "erp_crm_oportunidades",
        "erp_crm_etapa",
        "erp_op_produccion",
        "erp_producto",
        "erp_productos",
        "companysolicitante_id",
        "montoestimado",
        "probabilidad",
        "estado",
        "cantidad",
    ]
    return any(token in message for token in tracked_tokens) and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
        or "invalid column name" in message
        or "nombre de columna no valido" in message
    )


def _is_executive_user(current_user: dict[str, Any]) -> bool:
    role_id = int(current_user.get("RolId") or current_user.get("rol") or 0)
    role_name = str(current_user.get("RolName") or "").lower()
    executive_tokens = ("direccion", "dirección", "gerencia")
    return role_id in {1, 2} or any(token in role_name for token in executive_tokens)


def _scope_clause(current_user: dict[str, Any], company_field: str) -> tuple[str, dict[str, Any]]:
    companies = user_company_ids(current_user)
    if not companies:
        return "", {}
    clause, params = build_in_clause("company", companies)
    return f" AND {company_field} IN ({clause})", params


def _safe_query_list(sql: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        with get_connection() as conn:
            rows = conn.execute(text(sql), params).mappings().all()
        return [dict(row) for row in rows]
    except Exception as exc:
        if _is_missing_executive_dependency(exc):
            return []
        raise


def _safe_query_one(
    sql: str,
    params: dict[str, Any],
    default: dict[str, Any],
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            row = conn.execute(text(sql), params).mappings().first()
        return dict(row) if row else default
    except Exception as exc:
        if _is_missing_executive_dependency(exc):
            return default
        raise


def list_facturas(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    cliente: Optional[str] = None,
    status: Optional[str] = None,
) -> list[dict[str, Any]]:
    conditions = ["1=1"]
    params: dict[str, Any] = {}

    if fecha_inicio:
        conditions.append("f.FechaTimbrado >= :fi")
        params["fi"] = fecha_inicio
    if fecha_fin:
        conditions.append("f.FechaTimbrado <= :ff")
        params["ff"] = fecha_fin
    if cliente:
        conditions.append("(f.ReceptorNombre LIKE :cli OR f.ReceptorRFC LIKE :cli)")
        params["cli"] = f"%{cliente}%"
    if status:
        conditions.append("f.Status = :status")
        params["status"] = status

    where = " AND ".join(conditions)
    try:
        with get_connection() as conn:
            rows = conn.execute(
                text(f"""
                    SELECT
                        f.Factura_Id,
                        f.UUID,
                        f.FacturamaId,
                        f.Serie,
                        f.Folio,
                        f.ReceptorRFC,
                        f.ReceptorNombre,
                        f.Subtotal,
                        f.IVA,
                        f.Total,
                        f.Moneda,
                        f.Status,
                        f.FechaTimbrado,
                        f.Venta_Id,
                        v.FechaVenta
                    FROM ERP_FACTURAS f
                    LEFT JOIN ERP_VENTAS v ON f.Venta_Id = v.Venta_Id
                    WHERE {where}
                    ORDER BY f.FechaTimbrado DESC
                """),
                params,
            ).mappings().all()
    except Exception as exc:
        if _is_missing_reporteria_dependency(exc):
            return []
        raise
    return [dict(r) for r in rows]


def get_estadisticas(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
) -> dict[str, Any]:
    conditions = ["1=1"]
    params: dict[str, Any] = {}

    if fecha_inicio:
        conditions.append("FechaTimbrado >= :fi")
        params["fi"] = fecha_inicio
    if fecha_fin:
        conditions.append("FechaTimbrado <= :ff")
        params["ff"] = fecha_fin

    where = " AND ".join(conditions)
    try:
        with get_connection() as conn:
            row = conn.execute(
                text(f"""
                    SELECT
                        COUNT(*) AS TotalFacturas,
                        SUM(CASE WHEN Status = 'Vigente' THEN 1 ELSE 0 END) AS FacturasVigentes,
                        SUM(CASE WHEN Status = 'Cancelada' THEN 1 ELSE 0 END) AS FacturasCanceladas,
                        SUM(CASE WHEN Status = 'Vigente' THEN Total ELSE 0 END) AS TotalFacturado,
                        AVG(CASE WHEN Status = 'Vigente' THEN Total ELSE NULL END) AS PromedioFactura
                    FROM ERP_FACTURAS
                    WHERE {where}
                """),
                params,
            ).mappings().first()
    except Exception as exc:
        if _is_missing_reporteria_dependency(exc):
            return {
                "TotalFacturas": 0,
                "FacturasVigentes": 0,
                "FacturasCanceladas": 0,
                "TotalFacturado": 0,
                "PromedioFactura": 0,
            }
        raise
    return dict(row) if row else {
        "TotalFacturas": 0,
        "FacturasVigentes": 0,
        "FacturasCanceladas": 0,
        "TotalFacturado": 0,
        "PromedioFactura": 0,
    }


def _get_factura_ids(factura_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT FacturamaId, UUID FROM ERP_FACTURAS WHERE Factura_Id = :id"),
            {"id": factura_id},
        ).mappings().first()
    return dict(row) if row else {}


def descargar_pdf(factura_id: int) -> bytes:
    ids = _get_factura_ids(factura_id)
    if not ids:
        raise ValueError("Factura no encontrada")
    facturama_id = ids.get("FacturamaId") or ids.get("UUID")
    if not facturama_id or str(facturama_id).startswith("TEMP-"):
        raise ValueError("Esta factura no tiene un ID válido de Facturama")
    return facturama_svc.descargar_pdf(str(facturama_id))


def get_vencimientos(
    dias_alerta: int = 7,
    current_user: dict[str, Any] | None = None,
) -> dict[str, Any]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    f.Factura_Id, f.UUID, f.Serie, f.Folio,
                    f.ReceptorNombre, f.ReceptorRFC,
                    f.Total, f.Moneda, f.Status,
                    f.FechaTimbrado, f.FechaVencimiento,
                    DATEDIFF(DAY, GETDATE(), f.FechaVencimiento) AS DiasRestantes,
                    v.Venta_Id
                FROM ERP_FACTURAS f
                LEFT JOIN ERP_VENTAS v ON f.Venta_Id = v.Venta_Id
                WHERE f.Status = 'Vigente'
                  AND f.FechaVencimiento IS NOT NULL
                ORDER BY f.FechaVencimiento ASC
            """),
        ).mappings().all()

    todas = [dict(r) for r in rows]
    vencidas = [r for r in todas if (r["DiasRestantes"] or 0) < 0]
    proximas = [r for r in todas if 0 <= (r["DiasRestantes"] or 0) <= dias_alerta]
    result = {
        "vencidas": vencidas,
        "proximas_a_vencer": proximas,
        "total_vencidas": len(vencidas),
        "total_proximas": len(proximas),
    }
    if current_user:
        notificacion_service.sync_factura_vencimiento_notifications(result, current_user)
    return result


def descargar_xml(factura_id: int) -> bytes:
    ids = _get_factura_ids(factura_id)
    if not ids:
        raise ValueError("Factura no encontrada")
    facturama_id = ids.get("FacturamaId") or ids.get("UUID")
    if not facturama_id or str(facturama_id).startswith("TEMP-"):
        raise ValueError("Esta factura no tiene un ID válido de Facturama")
    return facturama_svc.descargar_xml(str(facturama_id))


def get_executive_dashboard(current_user: dict[str, Any]) -> dict[str, Any]:
    if not _is_executive_user(current_user):
        raise ApiServiceError(
            status_code=403,
            content={"success": False, "message": "Vista ejecutiva disponible solo para Direccion o SuperAdmin"},
        )

    month_start = date.today().replace(day=1).isoformat()

    ventas_scope, ventas_params = _scope_clause(current_user, "v.Company_Id")
    facturas_scope, facturas_params = _scope_clause(current_user, "v.Company_Id")
    crm_scope, crm_params = _scope_clause(current_user, "o.Company_Id")
    op_scope, op_params = _scope_clause(current_user, "ISNULL(op.CompanySolicitante_Id, op.Company_Id)")
    productos_scope, productos_params = _scope_clause(current_user, "v.Company_Id")

    resumen = _safe_query_one(
        f"""
            SELECT
                ISNULL((
                    SELECT SUM(ISNULL(v.Total, 0))
                    FROM ERP_VENTAS v
                    WHERE v.FechaVenta >= :month_start
                    {ventas_scope}
                ), 0) AS VentasMes,
                ISNULL((
                    SELECT SUM(ISNULL(f.Total, 0))
                    FROM ERP_FACTURAS f
                    LEFT JOIN ERP_VENTAS v ON v.Venta_Id = f.Venta_Id
                    WHERE f.Status = 'Vigente'
                      AND f.FechaTimbrado >= :month_start
                      {facturas_scope}
                ), 0) AS FacturacionMes,
                ISNULL((
                    SELECT COUNT(*)
                    FROM ERP_CRM_OPORTUNIDADES o
                    WHERE ISNULL(UPPER(o.Status), 'ABIERTA') NOT IN ('GANADA', 'PERDIDA', 'CERRADA')
                    {crm_scope}
                ), 0) AS OportunidadesAbiertas,
                ISNULL((
                    SELECT SUM(ISNULL(o.MontoEstimado, 0) * (ISNULL(o.Probabilidad, 0) / 100.0))
                    FROM ERP_CRM_OPORTUNIDADES o
                    WHERE ISNULL(UPPER(o.Status), 'ABIERTA') NOT IN ('GANADA', 'PERDIDA', 'CERRADA')
                    {crm_scope}
                ), 0) AS ForecastPonderado,
                ISNULL((
                    SELECT COUNT(*)
                    FROM ERP_OP_PRODUCCION op
                    WHERE ISNULL(UPPER(op.Estado), '') NOT IN ('CERRADA', 'CANCELADA')
                    {op_scope}
                ), 0) AS OpsActivas,
                ISNULL((
                    SELECT COUNT(*)
                    FROM ERP_FACTURAS f
                    LEFT JOIN ERP_VENTAS v ON v.Venta_Id = f.Venta_Id
                    WHERE f.Status = 'Vigente'
                      AND f.FechaVencimiento IS NOT NULL
                      AND f.FechaVencimiento < GETDATE()
                      {facturas_scope}
                ), 0) AS FacturasVencidas
        """,
        {
            "month_start": month_start,
            **ventas_params,
            **facturas_params,
            **crm_params,
            **op_params,
        },
        default={
            "VentasMes": 0,
            "FacturacionMes": 0,
            "OportunidadesAbiertas": 0,
            "ForecastPonderado": 0,
            "OpsActivas": 0,
            "FacturasVencidas": 0,
        },
    )

    ventas_mes_por_empresa = _safe_query_list(
        f"""
            SELECT
                c.Company_Id,
                c.NameCompany,
                SUM(ISNULL(v.Total, 0)) AS MontoVentasMes
            FROM ERP_VENTAS v
            INNER JOIN ERP_COMPANY c ON c.Company_Id = v.Company_Id
            WHERE v.FechaVenta >= :month_start
            {ventas_scope}
            GROUP BY c.Company_Id, c.NameCompany
            ORDER BY MontoVentasMes DESC
        """,
        {"month_start": month_start, **ventas_params},
    )

    forecast_pipeline = _safe_query_list(
        f"""
            SELECT
                ISNULL(e.Nombre, 'Sin etapa') AS EtapaNombre,
                COUNT(*) AS TotalOportunidades,
                SUM(ISNULL(o.MontoEstimado, 0)) AS MontoPipeline,
                SUM(ISNULL(o.MontoEstimado, 0) * (ISNULL(o.Probabilidad, 0) / 100.0)) AS ForecastPonderado,
                AVG(ISNULL(o.Probabilidad, 0)) AS ProbabilidadPromedio
            FROM ERP_CRM_OPORTUNIDADES o
            LEFT JOIN ERP_CRM_ETAPA e ON e.Etapa_Id = o.Etapa_Id
            WHERE ISNULL(UPPER(o.Status), 'ABIERTA') NOT IN ('GANADA', 'PERDIDA', 'CERRADA')
            {crm_scope}
            GROUP BY ISNULL(e.Nombre, 'Sin etapa')
            ORDER BY ForecastPonderado DESC, MontoPipeline DESC
        """,
        crm_params,
    )

    top_productos = _safe_query_list(
        f"""
            SELECT TOP 5
                ISNULL(p.Producto_Id, 0) AS Producto_Id,
                ISNULL(p.Nombre, 'Producto sin nombre') AS ProductoNombre,
                ISNULL(p.SKU, '') AS SKU,
                SUM(ISNULL(vd.Cantidad, 0)) AS CantidadVendida,
                SUM(ISNULL(vd.Total, ISNULL(vd.Subtotal, 0) + ISNULL(vd.IVA, 0))) AS MontoVendido
            FROM ERP_VENTA_DETALLE vd
            INNER JOIN ERP_VENTAS v ON v.Venta_Id = vd.Venta_Id
            LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = vd.Producto_Id
            WHERE v.FechaVenta >= :month_start
            {productos_scope}
            GROUP BY p.Producto_Id, p.Nombre, p.SKU
            ORDER BY MontoVendido DESC, CantidadVendida DESC
        """,
        {"month_start": month_start, **productos_params},
    )

    ops_por_estado = _safe_query_list(
        f"""
            SELECT
                ISNULL(op.Estado, 'SIN_ESTADO') AS Estado,
                COUNT(*) AS Total
            FROM ERP_OP_PRODUCCION op
            WHERE 1 = 1
            {op_scope}
            GROUP BY ISNULL(op.Estado, 'SIN_ESTADO')
            ORDER BY Total DESC, Estado
        """,
        op_params,
    )

    return {
        "success": True,
        "data": {
            "resumen": resumen,
            "ventasMesPorEmpresa": ventas_mes_por_empresa,
            "forecastPipeline": forecast_pipeline,
            "topProductos": top_productos,
            "opsPorEstado": ops_por_estado,
            "fechaCorte": date.today().isoformat(),
        },
    }
