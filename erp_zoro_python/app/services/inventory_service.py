from __future__ import annotations

import time
from typing import Any

from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services.inventory_control_service import (
    cancelar_recepcion_produccion,
    insert_kardex_movimiento,
    normalize_clasificacion_inventario,
    registrar_recepcion_produccion,
    resolve_almacen_producto,
    sync_inventario_estado,
    upsert_producto_inventario_config,
    upsert_stock,
    get_current_stock,
)
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


TIPOS_MAQUINA_VALIDOS = ["CORTE", "TUBOS", "ESQUINEROS", "CONOS"]


def _username(current_user: dict[str, Any]) -> str:
    return str(
        current_user.get("Username")
        or current_user.get("UserName")
        or current_user.get("Email")
        or "sistema"
    )


def _ensure_mp_maquina_table(connection: Any) -> None:
    connection.execute(
        text(
            """
            IF OBJECT_ID('dbo.ERP_MP_MAQUINA_DIARIO', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ERP_MP_MAQUINA_DIARIO (
                    Registro_Id INT IDENTITY(1,1) PRIMARY KEY,
                    FechaRegistro DATE NOT NULL,
                    TipoMaquina VARCHAR(30) NOT NULL,
                    MateriaPrima_Id INT NOT NULL,
                    Company_Id INT NOT NULL,
                    Almacen_Id INT NULL,
                    Cantidad DECIMAL(18,2) NOT NULL DEFAULT 0,
                    Observaciones NVARCHAR(500) NULL,
                    CreadoPor VARCHAR(100) NULL,
                    FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
                    ActualizadoPor VARCHAR(100) NULL,
                    FechaActualizacion DATETIME NULL
                );
                CREATE INDEX IX_ERP_MP_MAQUINA_DIARIO_FECHA
                    ON dbo.ERP_MP_MAQUINA_DIARIO (FechaRegistro, TipoMaquina, Company_Id);
            END
            """
        )
    )


def _get_ptc_company(connection: Any) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 Company_Id, NameCompany
            FROM ERP_COMPANY
            WHERE NameCompany LIKE '%PTC%'
               OR NameCompany LIKE '%REMA%'
            ORDER BY CASE WHEN NameCompany LIKE '%PTC%' THEN 0 ELSE 1 END, Company_Id
            """
        )
    ).mappings().first()
    if not row:
        raise ApiServiceError(
            status_code=500,
            content={
                "success": False,
                "message": "No se encontro la empresa productora PTC/REMA",
            },
        )
    return dict(row)


def list_stock(filters: dict[str, Any], current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            s.Producto_Id,
            p.SKU,
            p.Nombre,
            s.Almacen_Id,
            a.Nombre AS AlmacenNombre,
            a.Company_Id,
            c.NameCompany,
            cfg.ClasificacionInventario,
            cfg.Almacen_Id AS AlmacenAsignado_Id,
            aa.Nombre AS AlmacenAsignadoNombre,
            s.Cantidad,
            s.Stock_Minimo
        FROM ERP_STOCK s
        JOIN ERP_PRODUCTOS p ON p.Producto_Id = s.Producto_Id
        JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
        LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
        LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg
            ON cfg.Producto_Id = s.Producto_Id
           AND cfg.Company_Id = a.Company_Id
           AND cfg.Activo = 1
        LEFT JOIN ERP_ALMACENES aa ON aa.Almacen_Id = cfg.Almacen_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    allowed_companies = user_company_ids(current_user)
    if not current_user.get("is_admin"):
        if not allowed_companies:
            return []
        clause, clause_params = build_in_clause("company", allowed_companies)
        query += f" AND a.Company_Id IN ({clause})"
        params.update(clause_params)
    elif filters.get("company_id"):
        query += " AND a.Company_Id = :company_id"
        params["company_id"] = int(filters["company_id"])

    if filters.get("productoId"):
        query += " AND s.Producto_Id = :producto_id"
        params["producto_id"] = int(filters["productoId"])
    if filters.get("almacenId"):
        query += " AND s.Almacen_Id = :almacen_id"
        params["almacen_id"] = int(filters["almacenId"])
    if filters.get("sku"):
        query += " AND p.SKU LIKE :sku"
        params["sku"] = f"%{filters['sku']}%"
    if filters.get("nombre"):
        query += " AND p.Nombre LIKE :nombre"
        params["nombre"] = f"%{filters['nombre']}%"

    query += " ORDER BY p.Nombre, a.Nombre"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return [dict(row) for row in rows]


def get_stock_by_product(producto_id: int, current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            s.Producto_Id,
            p.SKU,
            p.Nombre,
            s.Almacen_Id,
            a.Nombre AS AlmacenNombre,
            a.Company_Id,
            cfg.ClasificacionInventario,
            cfg.Almacen_Id AS AlmacenAsignado_Id,
            aa.Nombre AS AlmacenAsignadoNombre,
            s.Cantidad,
            s.Stock_Minimo
        FROM ERP_STOCK s
        JOIN ERP_PRODUCTOS p ON p.Producto_Id = s.Producto_Id
        JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
        LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg
            ON cfg.Producto_Id = s.Producto_Id
           AND cfg.Company_Id = a.Company_Id
           AND cfg.Activo = 1
        LEFT JOIN ERP_ALMACENES aa ON aa.Almacen_Id = cfg.Almacen_Id
        WHERE s.Producto_Id = :producto_id
    """
    params: dict[str, Any] = {"producto_id": producto_id}
    if not current_user.get("is_admin"):
        allowed = user_company_ids(current_user)
        if not allowed:
            return []
        clause, clause_params = build_in_clause("company", allowed)
        query += f" AND a.Company_Id IN ({clause})"
        params.update(clause_params)
    query += " ORDER BY a.Nombre"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return [dict(row) for row in rows]


def list_materia_prima_por_maquina(
    filters: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    selected_date = filters.get("fecha") or time.strftime("%Y-%m-%d")
    tipo_maquina = filters.get("tipo_maquina")

    with get_connection() as connection:
        _ensure_mp_maquina_table(connection)
        ptc_company = _get_ptc_company(connection)

        if (
            not current_user.get("is_admin")
            and user_company_ids(current_user)
            and int(ptc_company["Company_Id"]) not in user_company_ids(current_user)
        ):
            return {"data": [], "company": ptc_company}

        query = """
            SELECT
                d.Registro_Id,
                d.FechaRegistro,
                d.TipoMaquina,
                d.MateriaPrima_Id,
                d.Company_Id,
                d.Almacen_Id,
                d.Cantidad,
                d.Observaciones,
                d.CreadoPor,
                d.FechaCreacion,
                mp.Codigo AS SKU,
                mp.Nombre AS NombreMaterial,
                mp.UnidadCompra,
                c.NameCompany,
                a.Nombre AS NombreAlmacen
            FROM ERP_MP_MAQUINA_DIARIO d
            INNER JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = d.MateriaPrima_Id
            INNER JOIN ERP_COMPANY c ON c.Company_Id = d.Company_Id
            LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = d.Almacen_Id
            WHERE d.FechaRegistro = :fecha_registro
              AND d.Company_Id = :company_id
        """
        params: dict[str, Any] = {
            "fecha_registro": selected_date,
            "company_id": int(ptc_company["Company_Id"]),
        }
        if tipo_maquina and tipo_maquina != "all":
            query += " AND d.TipoMaquina = :tipo_maquina"
            params["tipo_maquina"] = str(tipo_maquina).upper()
        query += " ORDER BY d.TipoMaquina, mp.Nombre, d.Registro_Id DESC"

        rows = connection.execute(text(query), params).mappings().all()

    return {"data": [dict(row) for row in rows], "company": ptc_company}


def save_materia_prima_por_maquina(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    required = ["FechaRegistro", "TipoMaquina", "MateriaPrima_Id"]
    for field in required:
        if not payload.get(field):
            raise ApiServiceError(
                status_code=400,
                content={
                    "msg": "Campos requeridos: FechaRegistro, TipoMaquina, MateriaPrima_Id, Cantidad"
                },
            )
    if payload.get("Cantidad") is None:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Campos requeridos: FechaRegistro, TipoMaquina, MateriaPrima_Id, Cantidad"},
        )

    tipo_maquina = str(payload["TipoMaquina"]).upper()
    if tipo_maquina not in TIPOS_MAQUINA_VALIDOS:
        raise ApiServiceError(
            status_code=400,
            content={
                "msg": f"TipoMaquina invalido. Use: {', '.join(TIPOS_MAQUINA_VALIDOS)}"
            },
        )

    with get_transaction() as connection:
        _ensure_mp_maquina_table(connection)
        ptc_company = _get_ptc_company(connection)
        if (
            not current_user.get("is_admin")
            and user_company_ids(current_user)
            and int(ptc_company["Company_Id"]) not in user_company_ids(current_user)
        ):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para registrar materiales en PTC/REMA"},
            )

        params = {
            "fecha_registro": payload["FechaRegistro"],
            "tipo_maquina": tipo_maquina,
            "materia_prima_id": int(payload["MateriaPrima_Id"]),
            "company_id": int(ptc_company["Company_Id"]),
            "almacen_id": int(payload["Almacen_Id"]) if payload.get("Almacen_Id") else None,
            "cantidad": float(payload.get("Cantidad") or 0),
            "observaciones": payload.get("Observaciones"),
            "usuario": _username(current_user),
        }

        upsert_query = """
            IF EXISTS (
                SELECT 1
                FROM ERP_MP_MAQUINA_DIARIO
                WHERE FechaRegistro = :fecha_registro
                  AND TipoMaquina = :tipo_maquina
                  AND MateriaPrima_Id = :materia_prima_id
                  AND Company_Id = :company_id
                  AND ISNULL(Almacen_Id, 0) = ISNULL(:almacen_id, 0)
            )
            BEGIN
                UPDATE ERP_MP_MAQUINA_DIARIO
                SET Cantidad = :cantidad,
                    Observaciones = :observaciones,
                    ActualizadoPor = :usuario,
                    FechaActualizacion = GETDATE()
                WHERE FechaRegistro = :fecha_registro
                  AND TipoMaquina = :tipo_maquina
                  AND MateriaPrima_Id = :materia_prima_id
                  AND Company_Id = :company_id
                  AND ISNULL(Almacen_Id, 0) = ISNULL(:almacen_id, 0)
            END
            ELSE
            BEGIN
                INSERT INTO ERP_MP_MAQUINA_DIARIO (
                    FechaRegistro, TipoMaquina, MateriaPrima_Id, Company_Id,
                    Almacen_Id, Cantidad, Observaciones, CreadoPor
                )
                VALUES (
                    :fecha_registro, :tipo_maquina, :materia_prima_id, :company_id,
                    :almacen_id, :cantidad, :observaciones, :usuario
                )
            END
        """
        connection.execute(text(upsert_query), params)

        saved = connection.execute(
            text(
                """
                SELECT TOP 1 *
                FROM ERP_MP_MAQUINA_DIARIO
                WHERE FechaRegistro = :fecha_registro
                  AND TipoMaquina = :tipo_maquina
                  AND MateriaPrima_Id = :materia_prima_id
                  AND Company_Id = :company_id
                  AND ISNULL(Almacen_Id, 0) = ISNULL(:almacen_id, 0)
                ORDER BY Registro_Id DESC
                """
            ),
            params,
        ).mappings().first()

    return {
        "msg": "Ingreso diario por maquina guardado correctamente",
        "data": dict(saved) if saved else None,
        "company": ptc_company,
    }


def list_consolidado(filters: dict[str, Any], current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            p.Producto_Id,
            p.SKU,
            p.Nombre,
            pe.Company_Id,
            c.NameCompany,
            cfg.ClasificacionInventario,
            cfg.Almacen_Id AS AlmacenAsignado_Id,
            aw.Nombre AS AlmacenAsignadoNombre,
            aw.Codigo AS AlmacenAsignadoCodigo,
            ISNULL(stock.TotalAlmacen, 0) AS CantidadAlmacen,
            ISNULL(state.CantidadEnMaquina, 0) AS CantidadEnMaquina,
            ISNULL(state.CantidadEntregadaProduccion, 0) AS CantidadEntregadaProduccion,
            ISNULL(state.CantidadEnProceso, 0) AS CantidadEnProceso,
            state.FechaCorte AS UltimoCorte
        FROM ERP_PRODUCTOS p
        INNER JOIN ERP_PRODUCTO_EMPRESA pe ON pe.Producto_Id = p.Producto_Id
        INNER JOIN ERP_COMPANY c ON c.Company_Id = pe.Company_Id
        LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg
            ON cfg.Producto_Id = p.Producto_Id
           AND cfg.Company_Id = pe.Company_Id
           AND cfg.Activo = 1
        LEFT JOIN ERP_ALMACENES aw ON aw.Almacen_Id = cfg.Almacen_Id
        OUTER APPLY (
            SELECT ISNULL(SUM(s.Cantidad), 0) AS TotalAlmacen
            FROM ERP_STOCK s
            INNER JOIN ERP_ALMACENES sa ON sa.Almacen_Id = s.Almacen_Id
            WHERE s.Producto_Id = p.Producto_Id
              AND sa.Company_Id = pe.Company_Id
        ) stock
        OUTER APPLY (
            SELECT TOP 1
                ie.CantidadEnMaquina,
                ie.CantidadEntregadaProduccion,
                ie.CantidadEnProceso,
                ie.FechaCorte
            FROM ERP_INVENTARIO_ESTADO_PRODUCTO ie
            WHERE ie.Producto_Id = p.Producto_Id
              AND ie.Company_Id = pe.Company_Id
              AND (
                (cfg.Almacen_Id IS NULL AND ie.Almacen_Id IS NULL) OR
                ie.Almacen_Id = cfg.Almacen_Id
              )
            ORDER BY ie.FechaCorte DESC, ie.InventarioEstado_Id DESC
        ) state
        WHERE p.Activo = 1
    """
    params: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        allowed = user_company_ids(current_user)
        if not allowed:
            return []
        clause, clause_params = build_in_clause("company", allowed)
        query += f" AND pe.Company_Id IN ({clause})"
        params.update(clause_params)
    elif filters.get("company_id"):
        query += " AND pe.Company_Id = :company_id"
        params["company_id"] = int(filters["company_id"])

    if filters.get("productoId"):
        query += " AND p.Producto_Id = :producto_id"
        params["producto_id"] = int(filters["productoId"])
    if filters.get("search"):
        query += " AND (p.SKU LIKE :search OR p.Nombre LIKE :search)"
        params["search"] = f"%{filters['search']}%"
    if filters.get("clasificacion"):
        query += " AND cfg.ClasificacionInventario = :clasificacion"
        params["clasificacion"] = normalize_clasificacion_inventario(filters["clasificacion"])

    query += " ORDER BY c.NameCompany, p.Nombre"
    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return [dict(row) for row in rows]


def list_recepcion_pendiente(filters: dict[str, Any], current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            op.OP_Id,
            op.NumeroOP,
            op.Company_Id,
            c.NameCompany,
            op.Producto_Id,
            p.SKU,
            p.Nombre AS NombreProducto,
            p.Nombre AS ProductoNombre,
            CASE
                WHEN ISNULL(op.CantidadProducida, 0) > 0 THEN op.CantidadProducida
                ELSE op.CantidadPlanificada
            END AS CantidadListaRecepcion,
            op.CantidadPlanificada,
            op.CantidadProducida,
            op.FechaFin AS FechaCierre,
            op.FechaFin,
            cfg.ClasificacionInventario,
            cfg.Almacen_Id AS AlmacenSugerido_Id,
            aw.Nombre AS AlmacenSugerido,
            aw.Nombre AS AlmacenSugeridoNombre,
            aw.Codigo AS AlmacenSugeridoCodigo
        FROM ERP_OP_PRODUCCION op
        INNER JOIN ERP_PRODUCTOS p ON p.Producto_Id = op.Producto_Id
        INNER JOIN ERP_COMPANY c ON c.Company_Id = op.Company_Id
        LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg
            ON cfg.Producto_Id = op.Producto_Id
           AND cfg.Company_Id = op.Company_Id
           AND cfg.Activo = 1
        LEFT JOIN ERP_ALMACENES aw ON aw.Almacen_Id = cfg.Almacen_Id
        LEFT JOIN ERP_RECEPCION_PRODUCTO_TERMINADO rpt ON rpt.OP_Id = op.OP_Id
        WHERE op.Estado = 'TERMINADA'
          AND rpt.OP_Id IS NULL
    """
    params: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        allowed = user_company_ids(current_user)
        if not allowed:
            return []
        clause, clause_params = build_in_clause("company", allowed)
        query += f" AND op.Company_Id IN ({clause})"
        params.update(clause_params)
    elif filters.get("company_id"):
        query += " AND op.Company_Id = :company_id"
        params["company_id"] = int(filters["company_id"])
    if filters.get("productoId"):
        query += " AND op.Producto_Id = :producto_id"
        params["producto_id"] = int(filters["productoId"])

    query += " ORDER BY op.FechaFin DESC, op.OP_Id DESC"
    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return [dict(row) for row in rows]


def registrar_recepcion_pendiente(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    op_id = int(payload.get("OP_Id") or 0)
    cantidad = float(payload.get("Cantidad") or 0)
    if not op_id or cantidad <= 0:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Campos requeridos: OP_Id, Cantidad"},
        )

    with get_transaction() as connection:
        op = connection.execute(
            text(
                """
                SELECT TOP 1
                    OP_Id,
                    NumeroOP,
                    Producto_Id,
                    Company_Id,
                    Estado,
                    CantidadPlanificada,
                    CantidadProducida
                FROM ERP_OP_PRODUCCION
                WHERE OP_Id = :op_id
                """
            ),
            {"op_id": op_id},
        ).mappings().first()
        if not op:
            raise ApiServiceError(
                status_code=404,
                content={"msg": "No se encontro la orden de produccion"},
            )
        if not can_access_company(current_user, int(op["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para registrar recepcion de esta empresa"},
            )
        if str(op["Estado"]) != "TERMINADA":
            raise ApiServiceError(
                status_code=400,
                content={"msg": "Solo se puede recibir en almacen una OP terminada"},
            )

        try:
            result = registrar_recepcion_produccion(
                connection,
                op=dict(op),
                cantidad_recibida=cantidad,
                almacen_id=int(payload["Almacen_Id"]) if payload.get("Almacen_Id") else None,
                observaciones=payload.get("Observaciones"),
                usuario=_username(current_user),
            )
        except ValueError as exc:
            raise ApiServiceError(status_code=400, content={"msg": str(exc)}) from exc

    emit_background("inventario:recepcion-produccion", {})
    emit_background("inventario:changed", {})
    return {"msg": "Entrada a almacen registrada correctamente", "data": result}


def cancelar_recepcion_pendiente(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    op_id = int(payload.get("OP_Id") or 0)
    motivo = str(payload.get("MotivoCancelacion") or "").strip()
    if not op_id:
        raise ApiServiceError(status_code=400, content={"msg": "Campo requerido: OP_Id"})
    if not motivo:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Debes indicar el motivo de cancelacion"},
        )

    with get_transaction() as connection:
        op = connection.execute(
            text(
                """
                SELECT TOP 1
                    OP_Id,
                    NumeroOP,
                    Producto_Id,
                    Company_Id,
                    Estado,
                    CantidadPlanificada,
                    CantidadProducida
                FROM ERP_OP_PRODUCCION
                WHERE OP_Id = :op_id
                """
            ),
            {"op_id": op_id},
        ).mappings().first()
        if not op:
            raise ApiServiceError(
                status_code=404,
                content={"msg": "No se encontro la orden de produccion"},
            )
        if not can_access_company(current_user, int(op["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para cancelar recepcion de esta empresa"},
            )
        if str(op["Estado"]) != "TERMINADA":
            raise ApiServiceError(
                status_code=400,
                content={"msg": "Solo se puede cancelar la entrada de una OP terminada"},
            )
        try:
            result = cancelar_recepcion_produccion(
                connection,
                op=dict(op),
                motivo_cancelacion=motivo,
                usuario=_username(current_user),
            )
        except ValueError as exc:
            raise ApiServiceError(status_code=400, content={"msg": str(exc)}) from exc

    emit_background("inventario:changed", {})
    emit_background("inventario:changed", {})
    return {"msg": "Entrada a almacen cancelada por producto incompleto", "data": result}


def update_estado_consolidado(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    producto_id = int(payload.get("Producto_Id") or 0)
    company_id = int(payload.get("Company_Id") or 0)
    if not producto_id or not company_id:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Campos requeridos: Producto_Id, Company_Id"},
        )
    if not can_access_company(current_user, company_id):
        raise ApiServiceError(
            status_code=403,
            content={"msg": "No tiene permisos para actualizar inventario de esta empresa"},
        )

    with get_transaction() as connection:
        almacen = resolve_almacen_producto(
            connection,
            producto_id=producto_id,
            company_id=company_id,
            almacen_id=int(payload["Almacen_Id"]) if payload.get("Almacen_Id") else None,
            allow_fallback=False,
        )
        estado = sync_inventario_estado(
            connection,
            producto_id=producto_id,
            company_id=company_id,
            almacen_id=int(almacen["Almacen_Id"]) if almacen and almacen.get("Almacen_Id") else None,
            cantidades={
                "CantidadEnMaquina": payload.get("CantidadEnMaquina"),
                "CantidadEntregadaProduccion": payload.get("CantidadEntregadaProduccion"),
                "CantidadEnProceso": payload.get("CantidadEnProceso"),
            },
        )
    return {"msg": "Inventario consolidado actualizado", "data": estado}


def list_stock_mp(filters: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    query = """
        SELECT
            mp.MateriaPrima_Id,
            mp.Codigo AS SKU,
            mp.Nombre AS NombreProducto,
            mp.Tipo,
            mp.UnidadCompra,
            mp.CostoUnitario,
            mp.Moneda,
            a.Almacen_Id,
            a.Nombre AS NombreAlmacen,
            a.Codigo AS CodigoAlmacen,
            a.Company_Id,
            c.NameCompany,
            ISNULL(s.Cantidad, 0) AS CantidadAlmacen,
            ISNULL(s.Stock_Minimo, 0) AS StockMinimo
        FROM ERP_MATERIA_PRIMA mp
        CROSS JOIN ERP_ALMACENES a
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = a.Company_Id
        LEFT JOIN ERP_STOCK_MP s
            ON s.MateriaPrima_Id = mp.MateriaPrima_Id
           AND s.Almacen_Id = a.Almacen_Id
        WHERE mp.Activo = 1
          AND (s.Cantidad > 0 OR s.StockMP_Id IS NOT NULL)
    """
    params: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        allowed = user_company_ids(current_user)
        if not allowed:
            return {"data": []}
        clause, clause_params = build_in_clause("company", allowed)
        query += f" AND a.Company_Id IN ({clause})"
        params.update(clause_params)
    elif filters.get("company_id"):
        query += " AND a.Company_Id = :company_id"
        params["company_id"] = int(filters["company_id"])
    if filters.get("almacen_id"):
        query += " AND a.Almacen_Id = :almacen_id"
        params["almacen_id"] = int(filters["almacen_id"])
    if filters.get("search"):
        query += " AND (mp.Codigo LIKE :search OR mp.Nombre LIKE :search)"
        params["search"] = f"%{filters['search']}%"
    query += " ORDER BY c.NameCompany, a.Nombre, mp.Nombre"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"data": [dict(row) for row in rows]}


def update_stock_mp(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    materia_prima_id = int(payload.get("MateriaPrima_Id") or 0)
    almacen_id = int(payload.get("Almacen_Id") or 0)
    if not materia_prima_id or not almacen_id:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Se requiere MateriaPrima_Id y Almacen_Id"},
        )

    with get_transaction() as connection:
        warehouse = connection.execute(
            text(
                """
                SELECT TOP 1 Company_Id
                FROM ERP_ALMACENES
                WHERE Almacen_Id = :almacen_id
                """
            ),
            {"almacen_id": almacen_id},
        ).mappings().first()
        if not warehouse:
            raise ApiServiceError(
                status_code=404,
                content={"msg": "No se encontro el almacen especificado"},
            )
        if not can_access_company(current_user, int(warehouse["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para actualizar este almacen"},
            )

        exists = connection.execute(
            text(
                """
                SELECT 1
                FROM ERP_STOCK_MP
                WHERE MateriaPrima_Id = :materia_prima_id AND Almacen_Id = :almacen_id
                """
            ),
            {"materia_prima_id": materia_prima_id, "almacen_id": almacen_id},
        ).first()
        if exists:
            connection.execute(
                text(
                    """
                    UPDATE ERP_STOCK_MP
                    SET Stock_Minimo = :stock_minimo
                    WHERE MateriaPrima_Id = :materia_prima_id AND Almacen_Id = :almacen_id
                    """
                ),
                {
                    "materia_prima_id": materia_prima_id,
                    "almacen_id": almacen_id,
                    "stock_minimo": float(payload.get("StockMinimo") or 0),
                },
            )
        else:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_STOCK_MP (MateriaPrima_Id, Almacen_Id, Cantidad, Stock_Minimo)
                    VALUES (:materia_prima_id, :almacen_id, 0, :stock_minimo)
                    """
                ),
                {
                    "materia_prima_id": materia_prima_id,
                    "almacen_id": almacen_id,
                    "stock_minimo": float(payload.get("StockMinimo") or 0),
                },
            )
    return {"msg": "Stock minimo actualizado"}


def registrar_movimiento(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    producto_id = int(payload.get("Producto_Id") or 0)
    tipo_movimiento = str(payload.get("TipoMovimiento") or "").upper()
    cantidad = float(payload.get("Cantidad") or 0)
    if not producto_id or not tipo_movimiento or cantidad <= 0:
        raise ApiServiceError(
            status_code=400,
            content={"msg": "Campos requeridos: Producto_Id, TipoMovimiento, Cantidad"},
        )

    transaction_id = f"TXN-{time.time_ns()}"
    usuario = _username(current_user)

    with get_transaction() as connection:
        almacen = resolve_almacen_producto(
            connection,
            producto_id=producto_id,
            company_id=int(payload["Company_Id"]) if payload.get("Company_Id") else None,
            almacen_id=int(payload["Almacen_Id"]) if payload.get("Almacen_Id") else None,
            allow_fallback=True,
        )
        if not almacen or not almacen.get("Almacen_Id"):
            raise ApiServiceError(
                status_code=400,
                content={"msg": "No se pudo resolver el almacen para el movimiento"},
            )

        company_id_resolved = int(payload.get("Company_Id") or almacen.get("Company_Id") or 0) or None
        almacen_id_resolved = int(almacen["Almacen_Id"])
        if company_id_resolved and not can_access_company(current_user, company_id_resolved):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para registrar movimientos en esta empresa"},
            )

        if payload.get("ClasificacionInventario") and company_id_resolved:
            upsert_producto_inventario_config(
                connection,
                producto_id,
                {
                    "Company_Id": company_id_resolved,
                    "Almacen_Id": almacen_id_resolved,
                    "ClasificacionInventario": payload.get("ClasificacionInventario"),
                },
                usuario,
            )

        referencia = payload.get("Referencia") or transaction_id
        duplicate = connection.execute(
            text(
                """
                SELECT COUNT(*) AS Count
                FROM ERP_KARDEX
                WHERE Referencia = :referencia
                  AND Producto_Id = :producto_id
                  AND Almacen_Id = :almacen_id
                """
            ),
            {
                "referencia": referencia,
                "producto_id": producto_id,
                "almacen_id": almacen_id_resolved,
            },
        ).mappings().first()
        if int((duplicate or {}).get("Count") or 0) > 0:
            raise ApiServiceError(
                status_code=400,
                content={"msg": "Movimiento duplicado detectado"},
            )

        stock_anterior = get_current_stock(connection, producto_id, almacen_id_resolved)["cantidad"]
        stock_actual = stock_anterior
        if tipo_movimiento in {"ENTRADA", "AJUSTE+", "AJUSTE_POSITIVO", "TRANSFERENCIA_IN"}:
            stock_actual += cantidad
        elif tipo_movimiento in {"SALIDA", "AJUSTE-", "AJUSTE_NEGATIVO", "TRANSFERENCIA_OUT"}:
            stock_actual -= cantidad
            if stock_actual < 0:
                raise ApiServiceError(
                    status_code=400,
                    content={"msg": "El movimiento dejaria stock negativo"},
                )
        else:
            raise ApiServiceError(
                status_code=400,
                content={"msg": "TipoMovimiento no soportado"},
            )

        upsert_stock(connection, producto_id, almacen_id_resolved, stock_actual)
        insert_kardex_movimiento(
            connection,
            producto_id=producto_id,
            almacen_id=almacen_id_resolved,
            tipo_movimiento=tipo_movimiento,
            cantidad=cantidad,
            stock_anterior=stock_anterior,
            stock_actual=stock_actual,
            referencia=referencia,
            usuario=usuario,
        )

        if company_id_resolved:
            sync_inventario_estado(
                connection,
                producto_id=producto_id,
                company_id=company_id_resolved,
                almacen_id=almacen_id_resolved,
            )

    emit_background("inventario:changed", {})
    return {
        "msg": "Movimiento registrado",
        "transactionId": transaction_id,
        "Producto_Id": producto_id,
        "Company_Id": company_id_resolved,
        "Almacen_Id": almacen_id_resolved,
        "ClasificacionInventario": (
            normalize_clasificacion_inventario(payload.get("ClasificacionInventario"))
            if payload.get("ClasificacionInventario")
            else None
        ),
        "TipoMovimiento": tipo_movimiento,
        "Cantidad": cantidad,
        "Stock_Anterior": stock_anterior,
        "Stock_Actual": stock_actual,
    }


def list_kardex(filters: dict[str, Any], current_user: dict[str, Any]) -> list[dict[str, Any]]:
    query = """
        SELECT
            k.Kardex_Id,
            k.Producto_Id,
            p.SKU,
            p.Nombre,
            k.Almacen_Id,
            a.Nombre AS AlmacenNombre,
            k.TipoMovimiento,
            k.Cantidad,
            k.Stock_Anterior,
            k.Stock_Actual,
            k.Referencia,
            k.Usuario,
            k.FechaMovimiento
        FROM ERP_KARDEX k
        JOIN ERP_PRODUCTOS p ON p.Producto_Id = k.Producto_Id
        JOIN ERP_ALMACENES a ON a.Almacen_Id = k.Almacen_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}
    if not current_user.get("is_admin"):
        allowed = user_company_ids(current_user)
        if not allowed:
            return []
        clause, clause_params = build_in_clause("company", allowed)
        query += f" AND a.Company_Id IN ({clause})"
        params.update(clause_params)
    if filters.get("productoId"):
        query += " AND k.Producto_Id = :producto_id"
        params["producto_id"] = int(filters["productoId"])
    if filters.get("almacenId"):
        query += " AND k.Almacen_Id = :almacen_id"
        params["almacen_id"] = int(filters["almacenId"])
    if filters.get("desde"):
        query += " AND k.FechaMovimiento >= :desde"
        params["desde"] = filters["desde"]
    if filters.get("hasta"):
        query += " AND k.FechaMovimiento <= :hasta"
        params["hasta"] = filters["hasta"]
    query += " ORDER BY k.FechaMovimiento DESC, k.Kardex_Id DESC"
    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return [dict(row) for row in rows]


def transferir(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, str]:
    origen_id = int(payload.get("Almacen_Origen_Id") or 0)
    destino_id = int(payload.get("Almacen_Destino_Id") or 0)
    detalles = payload.get("Detalles") or []
    if not origen_id or not destino_id or not detalles:
        raise ApiServiceError(
            status_code=400,
            content={
                "msg": "Campos requeridos: Almacen_Origen_Id, Almacen_Destino_Id, Detalles[]"
            },
        )

    usuario = str(payload.get("Usuario") or _username(current_user))

    with get_transaction() as connection:
        warehouse_rows = connection.execute(
            text(
                """
                SELECT Almacen_Id, Company_Id
                FROM ERP_ALMACENES
                WHERE Almacen_Id IN (:origen_id, :destino_id)
                """
            ),
            {"origen_id": origen_id, "destino_id": destino_id},
        ).mappings().all()

        origin = next((dict(row) for row in warehouse_rows if int(row["Almacen_Id"]) == origen_id), None)
        destination = next((dict(row) for row in warehouse_rows if int(row["Almacen_Id"]) == destino_id), None)
        if not origin or not destination:
            raise ApiServiceError(
                status_code=400,
                content={"msg": "No se encontraron los almacenes de origen y destino"},
            )
        if (
            not can_access_company(current_user, int(origin["Company_Id"]))
            or not can_access_company(current_user, int(destination["Company_Id"]))
        ):
            raise ApiServiceError(
                status_code=403,
                content={"msg": "No tiene permisos para transferir entre estos almacenes"},
            )

        for detail in detalles:
            producto_id = int(detail.get("Producto_Id") or 0)
            cantidad = float(detail.get("Cantidad") or 0)
            if not producto_id or cantidad <= 0:
                raise ApiServiceError(
                    status_code=400,
                    content={"msg": "Detalle de transferencia invalido"},
                )

            stock_origen = get_current_stock(connection, producto_id, origen_id)["cantidad"]
            stock_origen_nuevo = stock_origen - cantidad
            if stock_origen_nuevo < 0:
                raise ApiServiceError(
                    status_code=400,
                    content={
                        "msg": f"Stock insuficiente en almacen origen para producto {producto_id}"
                    },
                )

            upsert_stock(connection, producto_id, origen_id, stock_origen_nuevo)
            insert_kardex_movimiento(
                connection,
                producto_id=producto_id,
                almacen_id=origen_id,
                tipo_movimiento="TRANSFERENCIA_OUT",
                cantidad=cantidad,
                stock_anterior=stock_origen,
                stock_actual=stock_origen_nuevo,
                referencia=payload.get("Referencia"),
                usuario=usuario,
            )

            stock_destino = get_current_stock(connection, producto_id, destino_id)["cantidad"]
            stock_destino_nuevo = stock_destino + cantidad
            upsert_stock(connection, producto_id, destino_id, stock_destino_nuevo)
            insert_kardex_movimiento(
                connection,
                producto_id=producto_id,
                almacen_id=destino_id,
                tipo_movimiento="TRANSFERENCIA_IN",
                cantidad=cantidad,
                stock_anterior=stock_destino,
                stock_actual=stock_destino_nuevo,
                referencia=payload.get("Referencia"),
                usuario=usuario,
            )

            sync_inventario_estado(
                connection,
                producto_id=producto_id,
                company_id=int(origin["Company_Id"]),
                almacen_id=origen_id,
            )
            sync_inventario_estado(
                connection,
                producto_id=producto_id,
                company_id=int(destination["Company_Id"]),
                almacen_id=destino_id,
            )

    emit_background("inventario:changed", {})
    return {"msg": "Transferencia realizada"}
