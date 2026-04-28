from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.session import get_connection


CLASIFICACIONES_INVENTARIO = [
    "MATERIA_PRIMA",
    "PRODUCTO_TERMINADO",
    "PRODUCTO_REVENTA",
]


def normalize_clasificacion_inventario(
    value: str | None,
    fallback: str = "PRODUCTO_TERMINADO",
) -> str:
    normalized = str(value or fallback or "PRODUCTO_TERMINADO").strip().upper()
    return normalized if normalized in CLASIFICACIONES_INVENTARIO else fallback


def _list_with_connection(connection: Connection, producto_id: int) -> list[dict[str, Any]]:
    result = connection.execute(
        text(
            """
            SELECT
                cfg.ProductoAlmacenConfig_Id,
                cfg.Producto_Id,
                cfg.Company_Id,
                cfg.Almacen_Id,
                a.Nombre AS AlmacenNombre,
                a.Codigo AS AlmacenCodigo,
                cfg.ClasificacionInventario,
                cfg.Activo,
                cfg.CreatedAt,
                cfg.UpdatedAt,
                cfg.UpdatedBy,
                c.NameCompany
            FROM ERP_PRODUCTO_ALMACEN_CONFIG cfg
            INNER JOIN ERP_COMPANY c ON c.Company_Id = cfg.Company_Id
            LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = cfg.Almacen_Id
            WHERE cfg.Producto_Id = :producto_id
            ORDER BY cfg.Company_Id
            """
        ),
        {"producto_id": producto_id},
    )
    return [dict(row) for row in result.mappings().all()]


def list_producto_inventario_config(
    producto_id: int,
    connection: Connection | None = None,
) -> list[dict[str, Any]]:
    if connection is not None:
        return _list_with_connection(connection, producto_id)

    with get_connection() as local_connection:
        return _list_with_connection(local_connection, producto_id)


def get_producto_inventario_config(
    producto_id: int,
    company_id: int | None = None,
    connection: Connection | None = None,
) -> dict[str, Any] | None:
    query = """
        SELECT TOP 1
            cfg.ProductoAlmacenConfig_Id,
            cfg.Producto_Id,
            cfg.Company_Id,
            cfg.Almacen_Id,
            a.Nombre AS AlmacenNombre,
            a.Codigo AS AlmacenCodigo,
            cfg.ClasificacionInventario,
            cfg.Activo,
            cfg.CreatedAt,
            cfg.UpdatedAt,
            cfg.UpdatedBy,
            c.NameCompany
        FROM ERP_PRODUCTO_ALMACEN_CONFIG cfg
        INNER JOIN ERP_COMPANY c ON c.Company_Id = cfg.Company_Id
        LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = cfg.Almacen_Id
        WHERE cfg.Producto_Id = :producto_id
          AND cfg.Activo = 1
    """
    params: dict[str, Any] = {"producto_id": producto_id}
    if company_id:
        query += " AND cfg.Company_Id = :company_id"
        params["company_id"] = company_id

    query += " ORDER BY CASE WHEN cfg.Almacen_Id IS NULL THEN 1 ELSE 0 END, cfg.Company_Id"

    def _run(local_connection: Connection) -> dict[str, Any] | None:
        row = local_connection.execute(text(query), params).mappings().first()
        return dict(row) if row else None

    if connection is not None:
        return _run(connection)

    with get_connection() as local_connection:
        return _run(local_connection)


def ensure_producto_company_relation(
    connection: Connection,
    producto_id: int,
    company_id: int,
) -> bool:
    result = connection.execute(
        text(
            """
            SELECT COUNT(*) AS Total
            FROM ERP_PRODUCTO_EMPRESA
            WHERE Producto_Id = :producto_id AND Company_Id = :company_id
            """
        ),
        {"producto_id": producto_id, "company_id": company_id},
    ).mappings().first()
    return int(result["Total"] if result else 0) > 0


def replace_producto_inventario_config(
    connection: Connection,
    producto_id: int,
    configs: list[dict[str, Any]],
    updated_by: str | None,
) -> list[dict[str, Any]]:
    normalized_configs = []
    for config in configs:
        if not config or not config.get("Company_Id"):
            continue
        normalized_configs.append(
            {
                "Company_Id": int(config["Company_Id"]),
                "Almacen_Id": int(config["Almacen_Id"]) if config.get("Almacen_Id") else None,
                "ClasificacionInventario": normalize_clasificacion_inventario(
                    config.get("ClasificacionInventario")
                ),
                "Activo": 0 if config.get("Activo") is False else 1,
            }
        )

    connection.execute(
        text("DELETE FROM ERP_PRODUCTO_ALMACEN_CONFIG WHERE Producto_Id = :producto_id"),
        {"producto_id": producto_id},
    )

    for config in normalized_configs:
        if not ensure_producto_company_relation(
            connection,
            producto_id,
            config["Company_Id"],
        ):
            raise ValueError(
                f"El producto {producto_id} no esta asignado a la empresa {config['Company_Id']}"
            )

        connection.execute(
            text(
                """
                INSERT INTO ERP_PRODUCTO_ALMACEN_CONFIG (
                    Producto_Id,
                    Company_Id,
                    Almacen_Id,
                    ClasificacionInventario,
                    Activo,
                    UpdatedBy
                ) VALUES (
                    :producto_id,
                    :company_id,
                    :almacen_id,
                    :clasificacion_inventario,
                    :activo,
                    :updated_by
                )
                """
            ),
            {
                "producto_id": producto_id,
                "company_id": config["Company_Id"],
                "almacen_id": config["Almacen_Id"],
                "clasificacion_inventario": config["ClasificacionInventario"],
                "activo": config["Activo"],
                "updated_by": updated_by,
            },
        )

    return normalized_configs


def upsert_producto_inventario_config(
    connection: Connection,
    producto_id: int,
    config: dict[str, Any],
    updated_by: str | None,
) -> dict[str, Any] | None:
    if not config or not config.get("Company_Id"):
        return None

    normalized = {
        "Company_Id": int(config["Company_Id"]),
        "Almacen_Id": int(config["Almacen_Id"]) if config.get("Almacen_Id") else None,
        "ClasificacionInventario": normalize_clasificacion_inventario(
            config.get("ClasificacionInventario")
        ),
        "Activo": 0 if config.get("Activo") is False else 1,
    }

    if not ensure_producto_company_relation(connection, producto_id, normalized["Company_Id"]):
        raise ValueError(
            f"El producto {producto_id} no esta asignado a la empresa {normalized['Company_Id']}"
        )

    exists = connection.execute(
        text(
            """
            SELECT 1
            FROM ERP_PRODUCTO_ALMACEN_CONFIG
            WHERE Producto_Id = :producto_id AND Company_Id = :company_id
            """
        ),
        {"producto_id": producto_id, "company_id": normalized["Company_Id"]},
    ).first()

    if exists:
        connection.execute(
            text(
                """
                UPDATE ERP_PRODUCTO_ALMACEN_CONFIG
                SET
                    Almacen_Id = :almacen_id,
                    ClasificacionInventario = :clasificacion_inventario,
                    Activo = :activo,
                    UpdatedAt = GETDATE(),
                    UpdatedBy = :updated_by
                WHERE Producto_Id = :producto_id AND Company_Id = :company_id
                """
            ),
            {
                "producto_id": producto_id,
                "company_id": normalized["Company_Id"],
                "almacen_id": normalized["Almacen_Id"],
                "clasificacion_inventario": normalized["ClasificacionInventario"],
                "activo": normalized["Activo"],
                "updated_by": updated_by,
            },
        )
    else:
        connection.execute(
            text(
                """
                INSERT INTO ERP_PRODUCTO_ALMACEN_CONFIG (
                    Producto_Id,
                    Company_Id,
                    Almacen_Id,
                    ClasificacionInventario,
                    Activo,
                    UpdatedBy
                ) VALUES (
                    :producto_id,
                    :company_id,
                    :almacen_id,
                    :clasificacion_inventario,
                    :activo,
                    :updated_by
                )
                """
            ),
            {
                "producto_id": producto_id,
                "company_id": normalized["Company_Id"],
                "almacen_id": normalized["Almacen_Id"],
                "clasificacion_inventario": normalized["ClasificacionInventario"],
                "activo": normalized["Activo"],
                "updated_by": updated_by,
            },
        )

    return normalized


def resolve_almacen_producto(
    connection: Connection,
    *,
    producto_id: int | None = None,
    company_id: int | None = None,
    almacen_id: int | None = None,
    allow_fallback: bool = True,
) -> dict[str, Any] | None:
    if almacen_id:
        params: dict[str, Any] = {"almacen_id": almacen_id}
        query = """
            SELECT TOP 1 Almacen_Id, Company_Id, Nombre, Codigo, Activo
            FROM ERP_ALMACENES
            WHERE Almacen_Id = :almacen_id
        """
        if company_id:
            query += " AND Company_Id = :company_id"
            params["company_id"] = company_id

        row = connection.execute(text(query), params).mappings().first()
        if not row:
            raise ValueError(
                "El almacen indicado no existe o no pertenece a la empresa especificada"
            )
        return dict(row)

    if producto_id:
        config = get_producto_inventario_config(producto_id, company_id, connection)
        if config and config.get("Almacen_Id"):
            return {
                "Almacen_Id": config["Almacen_Id"],
                "Company_Id": config["Company_Id"],
                "Nombre": config.get("AlmacenNombre"),
                "Codigo": config.get("AlmacenCodigo"),
                "Activo": config.get("Activo"),
            }

    if not allow_fallback:
        return None

    resolved_company_id = company_id
    if not resolved_company_id and producto_id:
        relation = connection.execute(
            text(
                """
                SELECT TOP 1 Company_Id
                FROM ERP_PRODUCTO_EMPRESA
                WHERE Producto_Id = :producto_id
                ORDER BY Company_Id
                """
            ),
            {"producto_id": producto_id},
        ).mappings().first()
        resolved_company_id = int(relation["Company_Id"]) if relation else None

    if not resolved_company_id:
        return None

    row = connection.execute(
        text(
            """
            SELECT TOP 1 Almacen_Id, Company_Id, Nombre, Codigo, Activo
            FROM ERP_ALMACENES
            WHERE Company_Id = :company_id AND Activo = 1
            ORDER BY Almacen_Id
            """
        ),
        {"company_id": resolved_company_id},
    ).mappings().first()
    return dict(row) if row else None


def get_current_stock(
    connection: Connection,
    producto_id: int,
    almacen_id: int,
) -> dict[str, float]:
    row = connection.execute(
        text(
            """
            SELECT Cantidad, Stock_Minimo
            FROM ERP_STOCK
            WHERE Producto_Id = :producto_id AND Almacen_Id = :almacen_id
            """
        ),
        {"producto_id": producto_id, "almacen_id": almacen_id},
    ).mappings().first()
    return {
        "cantidad": float(row["Cantidad"] or 0) if row else 0.0,
        "stockMinimo": float(row["Stock_Minimo"] or 0) if row else 0.0,
    }


def upsert_stock(
    connection: Connection,
    producto_id: int,
    almacen_id: int,
    cantidad: float,
) -> None:
    exists = connection.execute(
        text(
            """
            SELECT 1
            FROM ERP_STOCK
            WHERE Producto_Id = :producto_id AND Almacen_Id = :almacen_id
            """
        ),
        {"producto_id": producto_id, "almacen_id": almacen_id},
    ).first()

    if exists:
        connection.execute(
            text(
                """
                UPDATE ERP_STOCK
                SET Cantidad = :cantidad
                WHERE Producto_Id = :producto_id AND Almacen_Id = :almacen_id
                """
            ),
            {
                "producto_id": producto_id,
                "almacen_id": almacen_id,
                "cantidad": cantidad,
            },
        )
    else:
        connection.execute(
            text(
                """
                INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
                VALUES (:producto_id, :almacen_id, :cantidad, 0)
                """
            ),
            {
                "producto_id": producto_id,
                "almacen_id": almacen_id,
                "cantidad": cantidad,
            },
        )


def insert_kardex_movimiento(
    connection: Connection,
    *,
    producto_id: int,
    almacen_id: int,
    tipo_movimiento: str,
    cantidad: float,
    stock_anterior: float,
    stock_actual: float,
    referencia: str | None,
    usuario: str | None,
) -> None:
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
            ) VALUES (
                :producto_id,
                :almacen_id,
                :tipo_movimiento,
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
            "producto_id": producto_id,
            "almacen_id": almacen_id,
            "tipo_movimiento": tipo_movimiento,
            "cantidad": cantidad,
            "stock_anterior": stock_anterior,
            "stock_actual": stock_actual,
            "referencia": referencia,
            "usuario": usuario or "sistema",
        },
    )


def sync_inventario_estado(
    connection: Connection,
    *,
    producto_id: int,
    company_id: int,
    almacen_id: int | None = None,
    cantidades: dict[str, Any] | None = None,
) -> dict[str, float]:
    cantidades = cantidades or {}
    stock_query = """
        SELECT ISNULL(SUM(s.Cantidad), 0) AS CantidadAlmacen
        FROM ERP_STOCK s
        INNER JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
        WHERE s.Producto_Id = :producto_id
          AND a.Company_Id = :company_id
    """
    stock_params: dict[str, Any] = {
        "producto_id": producto_id,
        "company_id": company_id,
    }
    if almacen_id:
        stock_query += " AND s.Almacen_Id = :almacen_id"
        stock_params["almacen_id"] = almacen_id

    stock_row = connection.execute(text(stock_query), stock_params).mappings().first()
    cantidad_almacen = float(stock_row["CantidadAlmacen"] or 0) if stock_row else 0.0

    state_query = """
        SELECT TOP 1
            InventarioEstado_Id,
            CantidadEnMaquina,
            CantidadEntregadaProduccion,
            CantidadEnProceso
        FROM ERP_INVENTARIO_ESTADO_PRODUCTO
        WHERE Producto_Id = :producto_id
          AND Company_Id = :company_id
    """
    state_params: dict[str, Any] = {
        "producto_id": producto_id,
        "company_id": company_id,
    }
    if almacen_id:
        state_query += " AND Almacen_Id = :almacen_id"
        state_params["almacen_id"] = almacen_id
    else:
        state_query += " AND Almacen_Id IS NULL"

    state_query += " ORDER BY FechaCorte DESC, InventarioEstado_Id DESC"
    current_state = connection.execute(text(state_query), state_params).mappings().first()

    values = {
        "CantidadAlmacen": cantidad_almacen,
        "CantidadEnMaquina": float(
            cantidades.get(
                "CantidadEnMaquina",
                current_state["CantidadEnMaquina"] if current_state else 0,
            )
            or 0
        ),
        "CantidadEntregadaProduccion": float(
            cantidades.get(
                "CantidadEntregadaProduccion",
                current_state["CantidadEntregadaProduccion"] if current_state else 0,
            )
            or 0
        ),
        "CantidadEnProceso": float(
            cantidades.get(
                "CantidadEnProceso",
                current_state["CantidadEnProceso"] if current_state else 0,
            )
            or 0
        ),
    }

    if current_state:
        connection.execute(
            text(
                """
                UPDATE ERP_INVENTARIO_ESTADO_PRODUCTO
                SET
                    CantidadAlmacen = :cantidad_almacen,
                    CantidadEnMaquina = :cantidad_en_maquina,
                    CantidadEntregadaProduccion = :cantidad_entregada,
                    CantidadEnProceso = :cantidad_en_proceso,
                    FechaCorte = GETDATE()
                WHERE InventarioEstado_Id = :inventario_estado_id
                """
            ),
            {
                "inventario_estado_id": current_state["InventarioEstado_Id"],
                "cantidad_almacen": values["CantidadAlmacen"],
                "cantidad_en_maquina": values["CantidadEnMaquina"],
                "cantidad_entregada": values["CantidadEntregadaProduccion"],
                "cantidad_en_proceso": values["CantidadEnProceso"],
            },
        )
    else:
        connection.execute(
            text(
                """
                INSERT INTO ERP_INVENTARIO_ESTADO_PRODUCTO (
                    Company_Id,
                    Producto_Id,
                    Almacen_Id,
                    CantidadAlmacen,
                    CantidadEnMaquina,
                    CantidadEntregadaProduccion,
                    CantidadEnProceso,
                    FechaCorte
                )
                VALUES (
                    :company_id,
                    :producto_id,
                    :almacen_id,
                    :cantidad_almacen,
                    :cantidad_en_maquina,
                    :cantidad_entregada,
                    :cantidad_en_proceso,
                    GETDATE()
                )
                """
            ),
            {
                "company_id": company_id,
                "producto_id": producto_id,
                "almacen_id": almacen_id,
                "cantidad_almacen": values["CantidadAlmacen"],
                "cantidad_en_maquina": values["CantidadEnMaquina"],
                "cantidad_entregada": values["CantidadEntregadaProduccion"],
                "cantidad_en_proceso": values["CantidadEnProceso"],
            },
        )

    return values


def registrar_recepcion_produccion(
    connection: Connection,
    *,
    op: dict[str, Any],
    cantidad_recibida: float,
    almacen_id: int | None,
    observaciones: str | None,
    usuario: str | None,
) -> dict[str, Any] | None:
    cantidad = float(cantidad_recibida or 0)
    if cantidad <= 0:
        return None

    existing = connection.execute(
        text(
            """
            SELECT TOP 1 RecepcionPT_Id, Estatus
            FROM ERP_RECEPCION_PRODUCTO_TERMINADO
            WHERE OP_Id = :op_id
            """
        ),
        {"op_id": op["OP_Id"]},
    ).mappings().first()
    if existing:
        if str(existing["Estatus"] or "").upper() == "CANCELADA":
            raise ValueError(
                "Esta orden fue cancelada para entrada a almacen y ya no puede recibirse"
            )
        raise ValueError("Esta orden ya tiene una recepcion de producto terminado registrada")

    product_config = get_producto_inventario_config(
        int(op["Producto_Id"]),
        int(op["Company_Id"]),
        connection,
    )
    clasificacion = normalize_clasificacion_inventario(
        product_config["ClasificacionInventario"] if product_config else None,
        "PRODUCTO_TERMINADO",
    )
    almacen = resolve_almacen_producto(
        connection,
        producto_id=int(op["Producto_Id"]),
        company_id=int(op["Company_Id"]),
        almacen_id=almacen_id,
        allow_fallback=True,
    )
    if not almacen or not almacen.get("Almacen_Id"):
        raise ValueError("No se encontro un almacen activo para recibir el producto terminado")

    referencia = f"{op['NumeroOP']}-RECEPCION"
    stock_anterior = get_current_stock(
        connection,
        int(op["Producto_Id"]),
        int(almacen["Almacen_Id"]),
    )["cantidad"]
    stock_actual = stock_anterior + cantidad

    upsert_stock(connection, int(op["Producto_Id"]), int(almacen["Almacen_Id"]), stock_actual)
    insert_kardex_movimiento(
        connection,
        producto_id=int(op["Producto_Id"]),
        almacen_id=int(almacen["Almacen_Id"]),
        tipo_movimiento="ENTRADA",
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_actual=stock_actual,
        referencia=referencia,
        usuario=usuario,
    )
    connection.execute(
        text(
            """
            INSERT INTO ERP_RECEPCION_PRODUCTO_TERMINADO (
                OP_Id,
                Producto_Id,
                Company_Id,
                Almacen_Id,
                CantidadRecibida,
                ClasificacionInventario,
                Estatus,
                Referencia,
                Observaciones,
                CreatedBy
            )
            VALUES (
                :op_id,
                :producto_id,
                :company_id,
                :almacen_id,
                :cantidad_recibida,
                :clasificacion,
                'RECIBIDA',
                :referencia,
                :observaciones,
                :created_by
            )
            """
        ),
        {
            "op_id": op["OP_Id"],
            "producto_id": op["Producto_Id"],
            "company_id": op["Company_Id"],
            "almacen_id": almacen["Almacen_Id"],
            "cantidad_recibida": cantidad,
            "clasificacion": clasificacion,
            "referencia": referencia,
            "observaciones": observaciones,
            "created_by": usuario or "sistema",
        },
    )

    estado = sync_inventario_estado(
        connection,
        producto_id=int(op["Producto_Id"]),
        company_id=int(op["Company_Id"]),
        almacen_id=int(almacen["Almacen_Id"]),
        cantidades={"CantidadEnMaquina": 0, "CantidadEnProceso": 0},
    )

    return {
        "almacenId": almacen["Almacen_Id"],
        "almacenNombre": almacen.get("Nombre"),
        "clasificacion": clasificacion,
        "referencia": referencia,
        "stockAnterior": stock_anterior,
        "stockActual": stock_actual,
        "estado": estado,
    }


def cancelar_recepcion_produccion(
    connection: Connection,
    *,
    op: dict[str, Any],
    motivo_cancelacion: str,
    usuario: str | None,
) -> dict[str, Any]:
    motivo = str(motivo_cancelacion or "").strip()
    if not motivo:
        raise ValueError("Debes indicar el motivo de cancelacion")

    existing = connection.execute(
        text(
            """
            SELECT TOP 1 RecepcionPT_Id, Estatus
            FROM ERP_RECEPCION_PRODUCTO_TERMINADO
            WHERE OP_Id = :op_id
            """
        ),
        {"op_id": op["OP_Id"]},
    ).mappings().first()
    if existing:
        if str(existing["Estatus"] or "").upper() == "CANCELADA":
            raise ValueError("Esta orden ya fue cancelada para entrada a almacen")
        raise ValueError("Esta orden ya fue recibida en almacen y no puede cancelarse")

    product_config = get_producto_inventario_config(
        int(op["Producto_Id"]),
        int(op["Company_Id"]),
        connection,
    )
    clasificacion = normalize_clasificacion_inventario(
        product_config["ClasificacionInventario"] if product_config else None,
        "PRODUCTO_TERMINADO",
    )
    referencia = f"{op['NumeroOP']}-RECEPCION-CANCELADA"
    connection.execute(
        text(
            """
            INSERT INTO ERP_RECEPCION_PRODUCTO_TERMINADO (
                OP_Id,
                Producto_Id,
                Company_Id,
                Almacen_Id,
                CantidadRecibida,
                ClasificacionInventario,
                Estatus,
                Referencia,
                Observaciones,
                MotivoCancelacion,
                FechaCancelacion,
                CanceladoBy,
                CreatedBy
            )
            VALUES (
                :op_id,
                :producto_id,
                :company_id,
                NULL,
                0,
                :clasificacion,
                'CANCELADA',
                :referencia,
                :observaciones,
                :motivo_cancelacion,
                GETDATE(),
                :cancelado_by,
                :created_by
            )
            """
        ),
        {
            "op_id": op["OP_Id"],
            "producto_id": op["Producto_Id"],
            "company_id": op["Company_Id"],
            "clasificacion": clasificacion,
            "referencia": referencia,
            "observaciones": motivo,
            "motivo_cancelacion": motivo,
            "cancelado_by": usuario or "sistema",
            "created_by": usuario or "sistema",
        },
    )
    return {
        "referencia": referencia,
        "clasificacion": clasificacion,
        "estatus": "CANCELADA",
        "motivoCancelacion": motivo,
    }
