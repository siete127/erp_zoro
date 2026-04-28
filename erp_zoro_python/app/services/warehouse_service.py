from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def list_warehouses(current_user: dict[str, Any], company_id: str | None) -> list[dict[str, Any]]:
    query = """
        SELECT
            a.Almacen_Id,
            a.Nombre,
            a.Codigo,
            a.Direccion,
            a.Activo,
            a.FechaCreacion,
            a.Company_Id,
            c.NameCompany
        FROM ERP_ALMACENES a
        LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND a.Company_Id IN ({clause})"
        params.update(clause_params)
    elif company_id:
        query += " AND a.Company_Id = :company_id"
        params["company_id"] = int(company_id)

    query += " ORDER BY a.Nombre"

    with get_connection() as connection:
        result = connection.execute(text(query), params)
        return [dict(row) for row in result.mappings().all()]


def get_warehouse(warehouse_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    query = """
        SELECT
            Almacen_Id,
            Nombre,
            Codigo,
            Direccion,
            Activo,
            FechaCreacion,
            Company_Id
        FROM ERP_ALMACENES
        WHERE Almacen_Id = :warehouse_id
    """
    params: dict[str, Any] = {"warehouse_id": warehouse_id}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            raise HTTPException(status_code=404, detail="Almacen no encontrado")
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND Company_Id IN ({clause})"
        params.update(clause_params)

    with get_connection() as connection:
        result = connection.execute(text(query), params).mappings().first()

    if not result:
        raise HTTPException(status_code=404, detail="Almacen no encontrado")
    return dict(result)


def create_warehouse(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if company_id and not can_access_company(current_user, int(company_id)):
        raise HTTPException(status_code=403, detail="No tiene permisos para usar esta empresa")

    try:
        with get_transaction() as connection:
            result = connection.execute(
                text(
                    """
                    INSERT INTO ERP_ALMACENES (
                        Nombre,
                        Codigo,
                        Direccion,
                        Activo,
                        Company_Id,
                        FechaCreacion
                    )
                    OUTPUT INSERTED.Almacen_Id
                    VALUES (
                        :nombre,
                        :codigo,
                        :direccion,
                        :activo,
                        :company_id,
                        GETDATE()
                    )
                    """
                ),
                {
                    "nombre": payload.get("Nombre"),
                    "codigo": payload.get("Codigo"),
                    "direccion": payload.get("Direccion"),
                    "activo": False if payload.get("Activo") is False else True,
                    "company_id": company_id,
                },
            )
            row = result.first()
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "2627" in message:
            raise HTTPException(status_code=409, detail="El codigo de almacen ya existe") from exc
        raise

    return {"msg": "Almacen creado", "Almacen_Id": int(row[0]) if row else None}


def update_warehouse(
    warehouse_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    company_id = payload.get("Company_Id")
    if company_id and not can_access_company(current_user, int(company_id)):
        raise HTTPException(status_code=403, detail="No tiene permisos para usar esta empresa")

    get_warehouse(warehouse_id, current_user)

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_ALMACENES
                SET
                    Nombre = COALESCE(:nombre, Nombre),
                    Codigo = COALESCE(:codigo, Codigo),
                    Direccion = :direccion,
                    Activo = COALESCE(:activo, Activo),
                    Company_Id = :company_id
                WHERE Almacen_Id = :warehouse_id
                """
            ),
            {
                "warehouse_id": warehouse_id,
                "nombre": payload.get("Nombre"),
                "codigo": payload.get("Codigo"),
                "direccion": payload.get("Direccion"),
                "activo": payload.get("Activo"),
                "company_id": company_id,
            },
        )
    return {"msg": "Almacen actualizado"}


def delete_warehouse(warehouse_id: int, current_user: dict[str, Any]) -> dict[str, str]:
    get_warehouse(warehouse_id, current_user)
    with get_transaction() as connection:
        connection.execute(
            text("DELETE FROM ERP_ALMACENES WHERE Almacen_Id = :warehouse_id"),
            {"warehouse_id": warehouse_id},
        )
    return {"msg": "Almacen eliminado"}


# --- Ubicaciones ---

def list_ubicaciones(warehouse_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    get_warehouse(warehouse_id, current_user)
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT u.Ubicacion_Id, u.Almacen_Id, u.Pasillo, u.Estante, u.Posicion, u.Codigo, u.Activo
                FROM ERP_ALMACEN_UBICACIONES u
                WHERE u.Almacen_Id = :almacen_id
                ORDER BY u.Pasillo, u.Estante, u.Posicion
            """),
            {"almacen_id": warehouse_id},
        ).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def create_ubicacion(warehouse_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    get_warehouse(warehouse_id, current_user)
    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_ALMACEN_UBICACIONES (Almacen_Id, Pasillo, Estante, Posicion, Codigo, Activo)
                OUTPUT INSERTED.Ubicacion_Id
                VALUES (:almacen_id, :pasillo, :estante, :posicion, :codigo, 1)
            """),
            {
                "almacen_id": warehouse_id,
                "pasillo": payload.get("pasillo"),
                "estante": payload.get("estante"),
                "posicion": payload.get("posicion"),
                "codigo": payload.get("codigo"),
            },
        )
        ubicacion_id = result.scalar()
    return {"success": True, "message": "Ubicación creada", "data": {"Ubicacion_Id": ubicacion_id}}


def update_ubicacion(ubicacion_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        ub = conn.execute(
            text("SELECT u.Ubicacion_Id, a.Company_Id FROM ERP_ALMACEN_UBICACIONES u JOIN ERP_ALMACENES a ON a.Almacen_Id = u.Almacen_Id WHERE u.Ubicacion_Id = :id"),
            {"id": ubicacion_id},
        ).mappings().first()
        if not ub:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")
        if not can_access_company(current_user, int(ub["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")
        conn.execute(
            text("""
                UPDATE ERP_ALMACEN_UBICACIONES
                SET Pasillo = :pasillo, Estante = :estante, Posicion = :posicion, Codigo = :codigo, Activo = :activo
                WHERE Ubicacion_Id = :id
            """),
            {
                "id": ubicacion_id,
                "pasillo": payload.get("pasillo"),
                "estante": payload.get("estante"),
                "posicion": payload.get("posicion"),
                "codigo": payload.get("codigo"),
                "activo": payload.get("activo", True),
            },
        )
    return {"success": True, "message": "Ubicación actualizada"}


def delete_ubicacion(ubicacion_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        ub = conn.execute(
            text("SELECT u.Ubicacion_Id, a.Company_Id FROM ERP_ALMACEN_UBICACIONES u JOIN ERP_ALMACENES a ON a.Almacen_Id = u.Almacen_Id WHERE u.Ubicacion_Id = :id"),
            {"id": ubicacion_id},
        ).mappings().first()
        if not ub:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")
        if not can_access_company(current_user, int(ub["Company_Id"])):
            raise HTTPException(status_code=403, detail="Sin acceso")
        conn.execute(text("DELETE FROM ERP_ALMACEN_UBICACIONES WHERE Ubicacion_Id = :id"), {"id": ubicacion_id})
    return {"success": True, "message": "Ubicación eliminada"}
