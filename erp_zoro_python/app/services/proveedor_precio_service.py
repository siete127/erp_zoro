from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company


def _check_access(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


# ---------------------------------------------------------------------------
# Precios pactados por proveedor
# ---------------------------------------------------------------------------

def list_precios(proveedor_id: int, current_user: dict[str, Any]) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT pp.*,
                       p.Description AS ProductoNombre,
                       mp.Nombre     AS MateriaPrimaNombre,
                       c.NameCompany
                FROM ERP_PROVEEDOR_PRECIOS pp
                LEFT JOIN ERP_PRODUCTOS p  ON p.Producto_Id       = pp.Producto_Id
                LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = pp.MateriaPrima_Id
                LEFT JOIN ERP_COMPANY c    ON c.Company_Id        = pp.Company_Id
                WHERE pp.Proveedor_Id = :pid AND pp.Activo = 1
                ORDER BY pp.CreatedAt DESC
                """
            ),
            {"pid": proveedor_id},
        ).mappings().all()
    return [dict(r) for r in rows]


def get_precio_sugerido(
    proveedor_id: int,
    company_id: int,
    producto_id: int | None,
    materia_prima_id: int | None,
) -> dict | None:
    """Devuelve el precio pactado vigente más reciente para un ítem, o None."""
    with get_connection() as conn:
        row = conn.execute(
            text(
                """
                SELECT TOP 1 PrecioUnitario, Moneda, Vigencia
                FROM ERP_PROVEEDOR_PRECIOS
                WHERE Proveedor_Id = :pid
                  AND Company_Id   = :cid
                  AND Activo       = 1
                  AND (Vigencia IS NULL OR Vigencia >= CAST(GETDATE() AS DATE))
                  AND (
                        (:prod_id IS NOT NULL AND Producto_Id = :prod_id)
                     OR (:mp_id   IS NOT NULL AND MateriaPrima_Id = :mp_id)
                  )
                ORDER BY CreatedAt DESC
                """
            ),
            {
                "pid": proveedor_id,
                "cid": company_id,
                "prod_id": producto_id,
                "mp_id": materia_prima_id,
            },
        ).mappings().first()
    return dict(row) if row else None


def create_precio(payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    company_id = int(payload.get("Company_Id") or 0)
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_access(current_user, company_id)

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_PROVEEDOR_PRECIOS
                    (Proveedor_Id, Producto_Id, MateriaPrima_Id, Descripcion,
                     PrecioUnitario, Moneda, Vigencia, Company_Id, Activo)
                OUTPUT INSERTED.PrecioP_Id
                VALUES (:prov, :prod, :mp, :desc, :precio, :moneda, :vigencia, :cid, 1)
                """
            ),
            {
                "prov": int(payload["Proveedor_Id"]),
                "prod": payload.get("Producto_Id"),
                "mp": payload.get("MateriaPrima_Id"),
                "desc": payload.get("Descripcion"),
                "precio": float(payload["PrecioUnitario"]),
                "moneda": payload.get("Moneda") or "MXN",
                "vigencia": payload.get("Vigencia"),
                "cid": company_id,
            },
        ).mappings().first()
    return {"success": True, "PrecioP_Id": int(row["PrecioP_Id"])}


def update_precio(precio_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        precio = conn.execute(
            text("SELECT Company_Id FROM ERP_PROVEEDOR_PRECIOS WHERE PrecioP_Id = :pid"),
            {"pid": precio_id},
        ).mappings().first()
    if not precio:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    _check_access(current_user, int(precio["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_PROVEEDOR_PRECIOS
                SET Producto_Id=:prod, MateriaPrima_Id=:mp, Descripcion=:desc,
                    PrecioUnitario=:precio, Moneda=:moneda, Vigencia=:vigencia
                WHERE PrecioP_Id=:pid
                """
            ),
            {
                "pid": precio_id,
                "prod": payload.get("Producto_Id"),
                "mp": payload.get("MateriaPrima_Id"),
                "desc": payload.get("Descripcion"),
                "precio": float(payload["PrecioUnitario"]),
                "moneda": payload.get("Moneda") or "MXN",
                "vigencia": payload.get("Vigencia"),
            },
        )
    return {"success": True}


def delete_precio(precio_id: int, current_user: dict[str, Any]) -> dict:
    with get_connection() as conn:
        precio = conn.execute(
            text("SELECT Company_Id FROM ERP_PROVEEDOR_PRECIOS WHERE PrecioP_Id = :pid"),
            {"pid": precio_id},
        ).mappings().first()
    if not precio:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    _check_access(current_user, int(precio["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_PROVEEDOR_PRECIOS SET Activo=0 WHERE PrecioP_Id=:pid"),
            {"pid": precio_id},
        )
    return {"success": True}


# ---------------------------------------------------------------------------
# Historial de OCs del proveedor
# ---------------------------------------------------------------------------

def historial_oc(proveedor_id: int, current_user: dict[str, Any]) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT TOP 50
                    oc.OC_Id, oc.NumeroOC, oc.FechaOC, oc.Estatus,
                    oc.Total, oc.Moneda, c.NameCompany,
                    (SELECT COUNT(*) FROM ERP_COMPRA_ORDEN_DETALLE d WHERE d.OC_Id = oc.OC_Id) AS TotalLineas
                FROM ERP_COMPRA_ORDEN oc
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = oc.Company_Id
                WHERE oc.Proveedor_Id = :pid
                ORDER BY oc.FechaOC DESC
                """
            ),
            {"pid": proveedor_id},
        ).mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Actualizar datos de proveedor (campos extra)
# ---------------------------------------------------------------------------

def update_datos_proveedor(
    proveedor_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict:
    with get_connection() as conn:
        cli = conn.execute(
            text("SELECT Company_Id FROM ERP_CLIENT WHERE Client_Id = :cid"),
            {"cid": proveedor_id},
        ).mappings().first()
    if not cli:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_CLIENT
                SET LeadTimeEntrega       = :lead_time,
                    CalificacionProveedor = :calificacion,
                    TerminosPago          = :terminos,
                    NotasProveedor        = :notas
                WHERE Client_Id = :cid
                """
            ),
            {
                "cid": proveedor_id,
                "lead_time": payload.get("LeadTimeEntrega"),
                "calificacion": payload.get("CalificacionProveedor"),
                "terminos": payload.get("TerminosPago"),
                "notas": payload.get("NotasProveedor"),
            },
        )
    return {"success": True}
