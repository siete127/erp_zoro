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


def _get_ptc_rema_company(connection: Any) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 Company_Id, NameCompany
            FROM ERP_COMPANY
            WHERE UPPER(ISNULL(NameCompany, '')) LIKE '%PTC REMA%'
               OR (
                    UPPER(ISNULL(NameCompany, '')) LIKE '%PTC%'
                AND UPPER(ISNULL(NameCompany, '')) LIKE '%REMA%'
               )
            ORDER BY CASE
                WHEN UPPER(ISNULL(NameCompany, '')) = 'PTC REMA' THEN 0
                WHEN UPPER(ISNULL(NameCompany, '')) LIKE '%PTC REMA%' THEN 1
                WHEN UPPER(ISNULL(NameCompany, '')) LIKE '%PTC%'
                 AND UPPER(ISNULL(NameCompany, '')) LIKE '%REMA%' THEN 2
                ELSE 3
            END, Company_Id
            """
        )
    ).mappings().first()
    if not row:
        raise ApiServiceError(
            status_code=500,
            content={"success": False, "message": "No se encontro la empresa PTC REMA"},
        )
    return dict(row)


def list_bom(filters: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        ptc_company = _get_ptc_rema_company(connection)
        query = """
            SELECT
                b.*,
                p.Nombre AS ProductoNombre,
                p.SKU,
                (SELECT COUNT(*) FROM ERP_BOM_MATERIALES WHERE BOM_Id = b.BOM_Id) AS TotalMateriales,
                (SELECT COUNT(*) FROM ERP_BOM_OPERACIONES WHERE BOM_Id = b.BOM_Id) AS TotalOperaciones
            FROM ERP_BOM b
            LEFT JOIN ERP_PRODUCTOS p ON b.Producto_Id = p.Producto_Id
            WHERE b.Company_Id = :company_id
        """
        params: dict[str, Any] = {"company_id": int(ptc_company["Company_Id"])}
        if filters.get("Producto_Id"):
            query += " AND b.Producto_Id = :producto_id"
            params["producto_id"] = int(filters["Producto_Id"])
        if filters.get("Vigente") is not None:
            raw_value = str(filters["Vigente"]).lower()
            params["vigente"] = 1 if raw_value in {"1", "true", "yes"} else 0
            query += " AND b.Vigente = :vigente"
        query += " ORDER BY b.Vigente DESC, b.Version DESC, b.FechaCreacion DESC"

        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_bom_detail(bom_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        bom = connection.execute(
            text(
                """
                SELECT b.*, p.Nombre AS ProductoNombre, p.SKU
                FROM ERP_BOM b
                LEFT JOIN ERP_PRODUCTOS p ON b.Producto_Id = p.Producto_Id
                WHERE b.BOM_Id = :bom_id
                """
            ),
            {"bom_id": bom_id},
        ).mappings().first()
        if not bom:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "BOM no encontrado"},
            )

        materiales = connection.execute(
            text(
                """
                SELECT
                    bm.*,
                    mp.Codigo AS MateriaCodigo,
                    mp.Nombre AS MateriaNombre,
                    mp.UnidadConsumo AS UnidadMedida,
                    mp.CostoUnitario,
                    mp.Moneda
                FROM ERP_BOM_MATERIALES bm
                LEFT JOIN ERP_MATERIA_PRIMA mp ON bm.MateriaPrima_Id = mp.MateriaPrima_Id
                WHERE bm.BOM_Id = :bom_id
                ORDER BY bm.BOM_Material_Id
                """
            ),
            {"bom_id": bom_id},
        ).mappings().all()

        operaciones = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_BOM_OPERACIONES
                WHERE BOM_Id = :bom_id
                ORDER BY BOM_Operacion_Id
                """
            ),
            {"bom_id": bom_id},
        ).mappings().all()

    return {
        "success": True,
        "data": {
            "bom": dict(bom),
            "materiales": [dict(row) for row in materiales],
            "operaciones": [dict(row) for row in operaciones],
        },
    }


def get_bom_cost_variation(bom_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        bom_actual = connection.execute(
            text(
                """
                SELECT BOM_Id, Producto_Id, Version, CodigoBOM
                FROM ERP_BOM
                WHERE BOM_Id = :bom_id
                """
            ),
            {"bom_id": bom_id},
        ).mappings().first()
        if not bom_actual:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "BOM no encontrado"},
            )

        bom_previo = connection.execute(
            text(
                """
                SELECT TOP 1 BOM_Id, Version, CodigoBOM
                FROM ERP_BOM
                WHERE Producto_Id = :producto_id
                  AND Version < :version_actual
                ORDER BY Version DESC
                """
            ),
            {
                "producto_id": int(bom_actual["Producto_Id"]),
                "version_actual": int(bom_actual["Version"]),
            },
        ).mappings().first()

        materiales_actuales = connection.execute(
            text(
                """
                SELECT
                    bm.MateriaPrima_Id,
                    bm.CantidadTeorica,
                    bm.MermaPct,
                    mp.Codigo AS MateriaCodigo,
                    mp.Nombre AS MateriaNombre,
                    mp.CostoUnitario,
                    mp.Moneda
                FROM ERP_BOM_MATERIALES bm
                LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = bm.MateriaPrima_Id
                WHERE bm.BOM_Id = :bom_id
                """
            ),
            {"bom_id": int(bom_actual["BOM_Id"])},
        ).mappings().all()

        materiales_previos: dict[int, dict[str, Any]] = {}
        if bom_previo and bom_previo.get("BOM_Id"):
            previous_rows = connection.execute(
                text(
                    """
                    SELECT MateriaPrima_Id, CantidadTeorica, MermaPct
                    FROM ERP_BOM_MATERIALES
                    WHERE BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(bom_previo["BOM_Id"])},
            ).mappings().all()
            materiales_previos = {
                int(row["MateriaPrima_Id"]): dict(row) for row in previous_rows
            }

    total_actual = 0.0
    total_previo = 0.0
    variaciones = []
    for material in materiales_actuales:
        materia_id = int(material["MateriaPrima_Id"])
        previo = materiales_previos.get(materia_id, {})
        costo_unitario = float(material.get("CostoUnitario") or 0)
        cantidad_actual = float(material.get("CantidadTeorica") or 0)
        merma_actual = float(material.get("MermaPct") or 0)
        cantidad_actual_ajustada = cantidad_actual * (1 + merma_actual / 100)
        costo_actual = cantidad_actual_ajustada * costo_unitario

        cantidad_previa = float(previo.get("CantidadTeorica") or 0)
        merma_previa = float(previo.get("MermaPct") or 0)
        cantidad_previa_ajustada = cantidad_previa * (1 + merma_previa / 100)
        costo_previo = cantidad_previa_ajustada * costo_unitario

        variacion_abs = costo_actual - costo_previo
        variacion_pct = (variacion_abs / costo_previo * 100) if costo_previo > 0 else None

        total_actual += costo_actual
        total_previo += costo_previo

        variaciones.append(
            {
                "MateriaPrima_Id": materia_id,
                "MateriaCodigo": material.get("MateriaCodigo"),
                "MateriaNombre": material.get("MateriaNombre"),
                "Moneda": material.get("Moneda") or "MXN",
                "CostoUnitarioActual": costo_unitario,
                "CantidadActual": cantidad_actual,
                "MermaActual": merma_actual,
                "CostoActual": costo_actual,
                "CantidadPrevia": cantidad_previa,
                "MermaPrevia": merma_previa,
                "CostoPrevio": costo_previo,
                "VariacionAbs": variacion_abs,
                "VariacionPct": variacion_pct,
            }
        )

    total_variacion = total_actual - total_previo
    total_variacion_pct = (total_variacion / total_previo * 100) if total_previo > 0 else None
    return {
        "success": True,
        "data": {
            "bomActual": dict(bom_actual),
            "bomPrevio": dict(bom_previo) if bom_previo else None,
            "resumen": {
                "costoTotalActual": total_actual,
                "costoTotalPrevio": total_previo,
                "variacionAbs": total_variacion,
                "variacionPct": total_variacion_pct,
            },
            "variaciones": variaciones,
        },
    }


def delete_bom_operation(operation_id: int) -> dict[str, Any]:
    with get_transaction() as connection:
        operation = connection.execute(
            text(
                """
                SELECT BOM_Operacion_Id, BOM_Id
                FROM ERP_BOM_OPERACIONES
                WHERE BOM_Operacion_Id = :operation_id
                """
            ),
            {"operation_id": operation_id},
        ).mappings().first()
        if not operation:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Operacion no encontrada"},
            )
        connection.execute(
            text(
                """
                DELETE FROM ERP_BOM_OPERACIONES
                WHERE BOM_Operacion_Id = :operation_id
                """
            ),
            {"operation_id": operation_id},
        )

    return {
        "success": True,
        "message": "Operacion eliminada de la receta",
        "data": {
            "BOM_Id": operation["BOM_Id"],
            "BOM_Operacion_Id": operation["BOM_Operacion_Id"],
        },
    }


def _insert_bom_materials(connection: Any, bom_id: int, materiales: list[dict[str, Any]]) -> None:
    for material in materiales:
        connection.execute(
            text(
                """
                INSERT INTO ERP_BOM_MATERIALES (
                    BOM_Id,
                    MateriaPrima_Id,
                    CantidadTeorica,
                    TipoComponente,
                    MermaPct,
                    Notas
                )
                VALUES (
                    :bom_id,
                    :materia_prima_id,
                    :cantidad_teorica,
                    :tipo_componente,
                    :merma_pct,
                    :notas
                )
                """
            ),
            {
                "bom_id": bom_id,
                "materia_prima_id": int(material["MateriaPrima_Id"]),
                "cantidad_teorica": float(material.get("CantidadTeorica") or 0),
                "tipo_componente": material.get("TipoComponente") or "Principal",
                "merma_pct": float(material.get("MermaPct") or 0),
                "notas": material.get("Notas"),
            },
        )


def _insert_bom_operations(connection: Any, bom_id: int, operaciones: list[dict[str, Any]]) -> None:
    for operation in operaciones:
        connection.execute(
            text(
                """
                INSERT INTO ERP_BOM_OPERACIONES (
                    BOM_Id,
                    TipoCosto,
                    CostoPorUnidad,
                    MinutosPorUnidad,
                    CostoHoraReferencia,
                    Notas
                )
                VALUES (
                    :bom_id,
                    :tipo_costo,
                    :costo_por_unidad,
                    :minutos_por_unidad,
                    :costo_hora_referencia,
                    :notas
                )
                """
            ),
            {
                "bom_id": bom_id,
                "tipo_costo": operation.get("TipoCosto") or "MANO_OBRA",
                "costo_por_unidad": float(operation.get("CostoPorUnidad") or 0),
                "minutos_por_unidad": float(operation.get("MinutosPorUnidad") or 0),
                "costo_hora_referencia": float(operation.get("CostoHoraReferencia") or 0),
                "notas": operation.get("Notas") or operation.get("NombreOperacion"),
            },
        )


def create_bom(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    if not payload.get("Producto_Id"):
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Producto_Id es requerido"},
        )

    materiales = payload.get("materiales") or []
    operaciones = payload.get("operaciones") or []

    with get_transaction() as connection:
        ptc_company = _get_ptc_rema_company(connection)
        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_BOM (
                    Company_Id,
                    Producto_Id,
                    CodigoBOM,
                    Version,
                    Vigente,
                    MermaPct,
                    Descripcion,
                    CreadoPor,
                    FechaCreacion
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :producto_id,
                    :codigo_bom,
                    :version,
                    1,
                    :merma_pct,
                    :descripcion,
                    :creado_por,
                    GETDATE()
                )
                """
            ),
            {
                "company_id": int(ptc_company["Company_Id"]),
                "producto_id": int(payload["Producto_Id"]),
                "codigo_bom": payload.get("CodigoBOM")
                or f"BOM-{payload['Producto_Id']}-{__import__('time').time_ns()}",
                "version": int(payload.get("Version") or 1),
                "merma_pct": float(payload.get("MermaPct") or 0),
                "descripcion": payload.get("Descripcion"),
                "creado_por": _username(current_user),
            },
        ).mappings().first()
        bom_id = int(inserted["BOM_Id"])
        _insert_bom_materials(connection, bom_id, list(materiales))
        _insert_bom_operations(connection, bom_id, list(operaciones))

    return {"success": True, "data": {"BOM_Id": bom_id}}


def update_bom(bom_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    materiales = payload.get("materiales")
    operaciones = payload.get("operaciones")

    with get_transaction() as connection:
        ptc_company = _get_ptc_rema_company(connection)
        connection.execute(
            text(
                """
                UPDATE ERP_BOM
                SET
                    Company_Id = :company_id,
                    Producto_Id = ISNULL(:producto_id, Producto_Id),
                    CodigoBOM = :codigo_bom,
                    Version = :version,
                    MermaPct = :merma_pct,
                    Descripcion = :descripcion,
                    Vigente = :vigente
                WHERE BOM_Id = :bom_id
                """
            ),
            {
                "bom_id": bom_id,
                "company_id": int(ptc_company["Company_Id"]),
                "producto_id": int(payload["Producto_Id"]) if payload.get("Producto_Id") else None,
                "codigo_bom": payload.get("CodigoBOM"),
                "version": int(payload.get("Version") or 1),
                "merma_pct": float(payload.get("MermaPct") or 0),
                "descripcion": payload.get("Descripcion"),
                "vigente": 1 if payload.get("Vigente", True) else 0,
            },
        )

        if isinstance(materiales, list):
            connection.execute(
                text("DELETE FROM ERP_BOM_MATERIALES WHERE BOM_Id = :bom_id"),
                {"bom_id": bom_id},
            )
            _insert_bom_materials(connection, bom_id, materiales)

        if isinstance(operaciones, list):
            connection.execute(
                text("DELETE FROM ERP_BOM_OPERACIONES WHERE BOM_Id = :bom_id"),
                {"bom_id": bom_id},
            )
            _insert_bom_operations(connection, bom_id, operaciones)

    return {"success": True, "data": {"BOM_Id": bom_id}}


def delete_bom(bom_id: int) -> dict[str, Any]:
    with get_transaction() as connection:
        usage = connection.execute(
            text(
                """
                SELECT COUNT(*) AS Total
                FROM ERP_OP_PRODUCCION
                WHERE BOM_Id = :bom_id
                """
            ),
            {"bom_id": bom_id},
        ).mappings().first()
        if int((usage or {}).get("Total") or 0) > 0:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "No se puede eliminar el BOM porque tiene ordenes de produccion asociadas",
                },
            )

        connection.execute(text("DELETE FROM ERP_BOM_MATERIALES WHERE BOM_Id = :bom_id"), {"bom_id": bom_id})
        connection.execute(text("DELETE FROM ERP_BOM_OPERACIONES WHERE BOM_Id = :bom_id"), {"bom_id": bom_id})
        connection.execute(text("DELETE FROM ERP_BOM WHERE BOM_Id = :bom_id"), {"bom_id": bom_id})

    return {"success": True, "message": "BOM eliminado correctamente"}


def clone_bom(
    bom_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        original = connection.execute(
            text("SELECT * FROM ERP_BOM WHERE BOM_Id = :bom_id"),
            {"bom_id": bom_id},
        ).mappings().first()
        if not original:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "BOM no encontrado"},
            )

        connection.execute(
            text("UPDATE ERP_BOM SET Vigente = 0 WHERE BOM_Id = :bom_id"),
            {"bom_id": bom_id},
        )

        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_BOM (
                    Company_Id,
                    Producto_Id,
                    CodigoBOM,
                    Version,
                    Vigente,
                    MermaPct,
                    Descripcion,
                    CreadoPor,
                    FechaCreacion
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :producto_id,
                    :codigo_bom,
                    :version,
                    1,
                    :merma_pct,
                    :descripcion,
                    :creado_por,
                    GETDATE()
                )
                """
            ),
            {
                "company_id": int(original["Company_Id"]),
                "producto_id": int(original["Producto_Id"]),
                "codigo_bom": original["CodigoBOM"],
                "version": int(payload.get("nuevaVersion") or (int(original["Version"]) + 1)),
                "merma_pct": float(original.get("MermaPct") or 0),
                "descripcion": original.get("Descripcion"),
                "creado_por": _username(current_user),
            },
        ).mappings().first()
        new_bom_id = int(inserted["BOM_Id"])

        connection.execute(
            text(
                """
                INSERT INTO ERP_BOM_MATERIALES (
                    BOM_Id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas
                )
                SELECT
                    :new_bom_id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas
                FROM ERP_BOM_MATERIALES
                WHERE BOM_Id = :bom_id
                """
            ),
            {"new_bom_id": new_bom_id, "bom_id": bom_id},
        )
        connection.execute(
            text(
                """
                INSERT INTO ERP_BOM_OPERACIONES (
                    BOM_Id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas
                )
                SELECT
                    :new_bom_id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas
                FROM ERP_BOM_OPERACIONES
                WHERE BOM_Id = :bom_id
                """
            ),
            {"new_bom_id": new_bom_id, "bom_id": bom_id},
        )

    return {"success": True, "data": {"BOM_Id": new_bom_id}}


def list_available_raw_materials() -> dict[str, Any]:
    with get_connection() as connection:
        rows = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_MATERIA_PRIMA
                WHERE Activo = 1
                ORDER BY Nombre
                """
            )
        ).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}
