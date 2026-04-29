from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company, user_company_ids, build_in_clause


def _check_company(current_user: dict, company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _company_filter(current_user: dict, params: dict, alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    if current_user.get("is_admin"):
        return ""
    companies = user_company_ids(current_user)
    if not companies:
        raise HTTPException(status_code=403, detail="Sin empresas asignadas")
    clause, clause_params = build_in_clause("company", companies)
    params.update(clause_params)
    return f" AND {prefix}Company_Id IN ({clause})"


def list_lotes(
    current_user: dict[str, Any],
    company_id: int | None = None,
    producto_id: int | None = None,
    almacen_id: int | None = None,
    solo_vencidos: bool = False,
) -> dict[str, Any]:
    params: dict[str, Any] = {}
    query = """
        SELECT l.Lote_Id, l.Company_Id, l.Producto_Id, p.Nombre AS ProductoNombre,
               l.NumeroLote, l.NumeroSerie, l.Almacen_Id, a.NombreAlmacen,
               l.FechaRecepcion, l.FechaVencimiento,
               l.CantidadInicial, l.CantidadActual, l.Activo, l.CreatedAt
        FROM ERP_LOTES l
        LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = l.Producto_Id
        LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = l.Almacen_Id
        WHERE l.Activo = 1
    """
    query += _company_filter(current_user, params, "l")
    if company_id:
        query += " AND l.Company_Id = :filter_company"
        params["filter_company"] = company_id
    if producto_id:
        query += " AND l.Producto_Id = :producto_id"
        params["producto_id"] = producto_id
    if almacen_id:
        query += " AND l.Almacen_Id = :almacen_id"
        params["almacen_id"] = almacen_id
    if solo_vencidos:
        query += " AND l.FechaVencimiento IS NOT NULL AND l.FechaVencimiento < CAST(GETDATE() AS DATE)"
    query += " ORDER BY l.FechaVencimiento ASC, l.CreatedAt DESC"

    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def get_lote(lote_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        lote = conn.execute(
            text("""
                SELECT l.*, p.Nombre AS ProductoNombre, a.NombreAlmacen
                FROM ERP_LOTES l
                LEFT JOIN ERP_PRODUCTOS p ON p.Producto_Id = l.Producto_Id
                LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = l.Almacen_Id
                WHERE l.Lote_Id = :id
            """),
            {"id": lote_id},
        ).mappings().first()
        if not lote:
            raise HTTPException(status_code=404, detail="Lote no encontrado")
        _check_company(current_user, int(lote["Company_Id"]))

        movimientos = conn.execute(
            text("""
                SELECT k.Kardex_Id, k.FechaMovimiento, k.TipoMovimiento, k.Cantidad,
                       k.Referencia, k.Notas
                FROM ERP_KARDEX k
                WHERE k.Lote_Id = :lote_id
                ORDER BY k.FechaMovimiento DESC
            """),
            {"lote_id": lote_id},
        ).mappings().all()

    return {
        "success": True,
        "data": {
            "lote": dict(lote),
            "movimientos": [dict(m) for m in movimientos],
        },
    }


def create_lote(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_company(current_user, int(company_id))

    cantidad = float(payload.get("CantidadInicial") or 0)
    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_LOTES (
                    Company_Id, Producto_Id, NumeroLote, NumeroSerie, Almacen_Id,
                    FechaRecepcion, FechaVencimiento, CantidadInicial, CantidadActual,
                    Proveedor_Id, Notas
                )
                OUTPUT INSERTED.Lote_Id
                VALUES (
                    :company_id, :producto_id, :numero_lote, :numero_serie, :almacen_id,
                    :fecha_recepcion, :fecha_vencimiento, :cantidad_inicial, :cantidad_actual,
                    :proveedor_id, :notas
                )
            """),
            {
                "company_id": company_id,
                "producto_id": payload.get("Producto_Id"),
                "numero_lote": payload.get("NumeroLote"),
                "numero_serie": payload.get("NumeroSerie"),
                "almacen_id": payload.get("Almacen_Id"),
                "fecha_recepcion": payload.get("FechaRecepcion"),
                "fecha_vencimiento": payload.get("FechaVencimiento"),
                "cantidad_inicial": cantidad,
                "cantidad_actual": cantidad,
                "proveedor_id": payload.get("Proveedor_Id"),
                "notas": payload.get("Notas"),
            },
        )
        lote_id = result.scalar()

    return {"success": True, "message": "Lote creado", "data": {"Lote_Id": lote_id}}


def consumir_lote(lote_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    cantidad = float(payload.get("Cantidad") or 0)
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="Cantidad debe ser mayor a 0")

    with get_connection() as conn:
        lote = conn.execute(
            text("SELECT Company_Id, CantidadActual FROM ERP_LOTES WHERE Lote_Id=:id AND Activo=1"),
            {"id": lote_id},
        ).mappings().first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    _check_company(current_user, int(lote["Company_Id"]))

    disponible = float(lote["CantidadActual"] or 0)
    if cantidad > disponible:
        raise HTTPException(status_code=400, detail=f"Cantidad solicitada ({cantidad}) supera disponible ({disponible})")

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_LOTES SET CantidadActual = CantidadActual - :qty WHERE Lote_Id=:id"),
            {"qty": cantidad, "id": lote_id},
        )

    return {"success": True, "message": f"Consumidas {cantidad} unidades del lote", "data": {"saldo": disponible - cantidad}}
