from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection, get_transaction


def _username(current_user: dict[str, Any]) -> str | None:
    return (
        current_user.get("Username")
        or current_user.get("username")
        or current_user.get("Email")
        or current_user.get("email")
        or None
    )


def list_raw_materials(filters: dict[str, Any]) -> dict[str, Any]:
    query = "SELECT * FROM ERP_MATERIA_PRIMA WHERE 1 = 1"
    params: dict[str, Any] = {}
    if filters.get("Activo") is not None:
        raw_value = str(filters["Activo"]).lower()
        params["activo"] = 1 if raw_value in {"1", "true", "yes"} else 0
        query += " AND Activo = :activo"
    if filters.get("Tipo"):
        params["tipo"] = filters["Tipo"]
        query += " AND Tipo = :tipo"
    query += " ORDER BY Nombre"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_raw_material_detail(raw_material_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_MATERIA_PRIMA
                WHERE MateriaPrima_Id = :materia_prima_id
                """
            ),
            {"materia_prima_id": raw_material_id},
        ).mappings().first()
    if not row:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Materia prima no encontrada"},
        )
    return {"success": True, "data": dict(row)}


def create_raw_material(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    required_fields = ["Codigo", "Nombre", "Tipo", "UnidadCompra", "UnidadConsumo"]
    if any(not payload.get(field) for field in required_fields):
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "Codigo, Nombre, Tipo, UnidadCompra y UnidadConsumo son requeridos",
            },
        )

    with get_transaction() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO ERP_MATERIA_PRIMA (
                    Codigo,
                    Nombre,
                    Descripcion,
                    Tipo,
                    UnidadCompra,
                    UnidadConsumo,
                    FactorConversion,
                    Gramaje,
                    CostoUnitario,
                    Moneda,
                    Activo,
                    FechaUltimoCosto,
                    FechaCreacion,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :codigo,
                    :nombre,
                    :descripcion,
                    :tipo,
                    :unidad_compra,
                    :unidad_consumo,
                    :factor_conversion,
                    :gramaje,
                    :costo_unitario,
                    :moneda,
                    1,
                    GETDATE(),
                    GETDATE(),
                    :creado_por
                )
                """
            ),
            {
                "codigo": payload["Codigo"],
                "nombre": payload["Nombre"],
                "descripcion": payload.get("Descripcion"),
                "tipo": payload["Tipo"],
                "unidad_compra": payload["UnidadCompra"],
                "unidad_consumo": payload["UnidadConsumo"],
                "factor_conversion": float(payload.get("FactorConversion") or 1),
                "gramaje": payload.get("Gramaje"),
                "costo_unitario": float(payload.get("CostoUnitario") or 0),
                "moneda": payload.get("Moneda") or "MXN",
                "creado_por": _username(current_user),
            },
        ).mappings().first()
    return {"success": True, "data": dict(row) if row else None}


def update_raw_material(
    raw_material_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        exists = connection.execute(
            text(
                """
                SELECT 1
                FROM ERP_MATERIA_PRIMA
                WHERE MateriaPrima_Id = :materia_prima_id
                """
            ),
            {"materia_prima_id": raw_material_id},
        ).first()
        if not exists:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Materia prima no encontrada"},
            )

        connection.execute(
            text(
                """
                UPDATE ERP_MATERIA_PRIMA
                SET
                    Codigo = :codigo,
                    Nombre = :nombre,
                    Descripcion = :descripcion,
                    Tipo = :tipo,
                    UnidadCompra = :unidad_compra,
                    UnidadConsumo = :unidad_consumo,
                    FactorConversion = :factor_conversion,
                    Gramaje = :gramaje,
                    CostoUnitario = :costo_unitario,
                    Moneda = :moneda,
                    Activo = :activo,
                    FechaUltimoCosto = GETDATE(),
                    ModificadoPor = :modificado_por,
                    FechaModificacion = GETDATE()
                WHERE MateriaPrima_Id = :materia_prima_id
                """
            ),
            {
                "materia_prima_id": raw_material_id,
                "codigo": payload.get("Codigo"),
                "nombre": payload.get("Nombre"),
                "descripcion": payload.get("Descripcion"),
                "tipo": payload.get("Tipo"),
                "unidad_compra": payload.get("UnidadCompra"),
                "unidad_consumo": payload.get("UnidadConsumo"),
                "factor_conversion": float(payload.get("FactorConversion") or 1),
                "gramaje": payload.get("Gramaje"),
                "costo_unitario": float(payload.get("CostoUnitario") or 0),
                "moneda": payload.get("Moneda") or "MXN",
                "activo": 1 if payload.get("Activo", True) else 0,
                "modificado_por": _username(current_user),
            },
        )
    return {"success": True, "data": {"MateriaPrima_Id": raw_material_id}}


def delete_raw_material(raw_material_id: int) -> dict[str, Any]:
    with get_transaction() as connection:
        usage = connection.execute(
            text(
                """
                SELECT COUNT(*) AS Total
                FROM ERP_BOM_MATERIALES
                WHERE MateriaPrima_Id = :materia_prima_id
                """
            ),
            {"materia_prima_id": raw_material_id},
        ).mappings().first()
        if int((usage or {}).get("Total") or 0) > 0:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "No se puede eliminar la materia prima porque esta en uso en BOM",
                },
            )

        connection.execute(
            text(
                """
                DELETE FROM ERP_MATERIA_PRIMA
                WHERE MateriaPrima_Id = :materia_prima_id
                """
            ),
            {"materia_prima_id": raw_material_id},
        )

    return {"success": True, "message": "Materia prima eliminada correctamente"}
