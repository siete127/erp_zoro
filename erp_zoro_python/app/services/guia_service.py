from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company


def _get_venta_company(conn, venta_id: int) -> int | None:
    row = conn.execute(
        text("SELECT Company_Id FROM ERP_VENTAS WHERE Venta_Id = :id"),
        {"id": venta_id},
    ).mappings().first()
    return int(row["Company_Id"]) if row else None


def list_guias(venta_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        company_id = _get_venta_company(conn, venta_id)
        if company_id is None:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, company_id):
            raise HTTPException(status_code=403, detail="Sin acceso a esta venta")

        rows = conn.execute(
            text("""
                SELECT Guia_Id, Venta_Id, FechaSalida, Transportista, NumeroGuia, Status
                FROM ERP_GUIA_EMBARQUE
                WHERE Venta_Id = :venta_id
                ORDER BY Guia_Id DESC
            """),
            {"venta_id": venta_id},
        ).mappings().all()

    return {"success": True, "data": [dict(r) for r in rows]}


def create_guia(venta_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        company_id = _get_venta_company(conn, venta_id)
        if company_id is None:
            raise HTTPException(status_code=404, detail="Venta no encontrada")
        if not can_access_company(current_user, company_id):
            raise HTTPException(status_code=403, detail="Sin acceso a esta venta")

        result = conn.execute(
            text("""
                INSERT INTO ERP_GUIA_EMBARQUE (Venta_Id, FechaSalida, Transportista, NumeroGuia, Status)
                OUTPUT INSERTED.Guia_Id
                VALUES (:venta_id, :fecha_salida, :transportista, :numero_guia, :status)
            """),
            {
                "venta_id": venta_id,
                "fecha_salida": payload.get("fecha_salida"),
                "transportista": payload.get("transportista"),
                "numero_guia": payload.get("numero_guia"),
                "status": payload.get("status", "Pendiente"),
            },
        )
        guia_id = result.scalar()

    return {"success": True, "message": "Guía creada correctamente", "data": {"Guia_Id": guia_id}}


def update_guia(guia_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        guia = conn.execute(
            text("SELECT g.Guia_Id, v.Company_Id FROM ERP_GUIA_EMBARQUE g JOIN ERP_VENTAS v ON v.Venta_Id = g.Venta_Id WHERE g.Guia_Id = :id"),
            {"id": guia_id},
        ).mappings().first()
        if not guia:
            raise HTTPException(status_code=404, detail="Guía no encontrada")
        if not can_access_company(current_user, int(guia["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")

        conn.execute(
            text("""
                UPDATE ERP_GUIA_EMBARQUE
                SET FechaSalida = :fecha_salida,
                    Transportista = :transportista,
                    NumeroGuia = :numero_guia,
                    Status = :status
                WHERE Guia_Id = :id
            """),
            {
                "id": guia_id,
                "fecha_salida": payload.get("fecha_salida"),
                "transportista": payload.get("transportista"),
                "numero_guia": payload.get("numero_guia"),
                "status": payload.get("status"),
            },
        )

    return {"success": True, "message": "Guía actualizada correctamente"}


def delete_guia(guia_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        guia = conn.execute(
            text("SELECT g.Guia_Id, v.Company_Id FROM ERP_GUIA_EMBARQUE g JOIN ERP_VENTAS v ON v.Venta_Id = g.Venta_Id WHERE g.Guia_Id = :id"),
            {"id": guia_id},
        ).mappings().first()
        if not guia:
            raise HTTPException(status_code=404, detail="Guía no encontrada")
        if not can_access_company(current_user, int(guia["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")

        conn.execute(text("DELETE FROM ERP_GUIA_EMBARQUE WHERE Guia_Id = :id"), {"id": guia_id})

    return {"success": True, "message": "Guía eliminada correctamente"}
