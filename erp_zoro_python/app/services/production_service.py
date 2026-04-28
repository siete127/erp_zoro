from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services import notificacion_service
from app.services.inventory_control_service import (
    get_current_stock,
    insert_kardex_movimiento,
    registrar_recepcion_produccion,
    resolve_almacen_producto,
    sync_inventario_estado,
    upsert_stock,
)
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _username(current_user: dict[str, Any]) -> str:
    return str(
        current_user.get("Username")
        or current_user.get("UserName")
        or current_user.get("Email")
        or current_user.get("email")
        or "sistema"
    )


def _current_user_id(current_user: dict[str, Any]) -> int:
    return int(current_user.get("User_Id") or current_user.get("id") or 0)


def _get_ptc_company(connection: Any, fallback_company_id: int | None = None) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 Company_Id, NameCompany
            FROM ERP_COMPANY
            WHERE NameCompany LIKE '%PTC%'
            ORDER BY Company_Id
            """
        )
    ).mappings().first()
    if row:
        return dict(row)
    if fallback_company_id:
        return {"Company_Id": int(fallback_company_id), "NameCompany": "Empresa productora"}
    raise ApiServiceError(
        status_code=500,
        content={
            "success": False,
            "message": "No se encontro la compania PTC en la base de datos",
        },
    )


def _can_access_order(
    current_user: dict[str, Any],
    producer_company_id: int | None,
    requester_company_id: int | None,
) -> bool:
    return can_access_company(current_user, producer_company_id) or can_access_company(
        current_user, requester_company_id
    )


def _ensure_order_access(current_user: dict[str, Any], order: dict[str, Any]) -> None:
    if not _can_access_order(
        current_user,
        int(order["Company_Id"]) if order.get("Company_Id") else None,
        int(order["CompanySolicitante_Id"]) if order.get("CompanySolicitante_Id") else None,
    ):
        raise ApiServiceError(
            status_code=403,
            content={
                "success": False,
                "message": "No tiene permisos para acceder a esta orden de produccion",
            },
        )


def list_production_orders(
    filters: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    query = """
        SELECT
            op.OP_Id,
            op.NumeroOP,
            op.Company_Id,
            op.CompanySolicitante_Id,
            op.Venta_Id,
            op.ID_COTIZACION,
            op.Producto_Id,
            p.SKU,
            p.Nombre AS ProductoNombre,
            op.CantidadPlanificada,
            op.CantidadProducida,
            op.MermaUnidades,
            op.Estado,
            op.Prioridad,
            op.FechaCreacion,
            op.FechaEntregaCompromiso,
            cp.NameCompany AS EmpresaProductora,
            cs.NameCompany AS EmpresaSolicitante
        FROM ERP_OP_PRODUCCION op
        LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
        LEFT JOIN ERP_COMPANY cp ON op.Company_Id = cp.Company_Id
        LEFT JOIN ERP_COMPANY cs ON op.CompanySolicitante_Id = cs.Company_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND (op.Company_Id IN ({clause}) OR op.CompanySolicitante_Id IN ({clause}))"
        params.update(clause_params)

    if filters.get("Company_Id"):
        query += " AND (op.Company_Id = :company_id OR op.CompanySolicitante_Id = :company_id)"
        params["company_id"] = int(filters["Company_Id"])

    if filters.get("Estado"):
        query += " AND op.Estado = :estado"
        params["estado"] = str(filters["Estado"])

    query += " ORDER BY op.Prioridad DESC, op.FechaCreacion DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_production_order_detail(
    order_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_connection() as connection:
        order = connection.execute(
            text(
                """
                SELECT
                    op.*,
                    p.SKU,
                    p.Nombre AS ProductoNombre,
                    p.Precio AS PrecioVentaProducto,
                    cp.NameCompany AS EmpresaProductora,
                    cs.NameCompany AS EmpresaSolicitante
                FROM ERP_OP_PRODUCCION op
                LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
                LEFT JOIN ERP_COMPANY cp ON op.Company_Id = cp.Company_Id
                LEFT JOIN ERP_COMPANY cs ON op.CompanySolicitante_Id = cs.Company_Id
                WHERE op.OP_Id = :op_id
                """
            ),
            {"op_id": order_id},
        ).mappings().first()
        if not order:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Orden de produccion no encontrada"},
            )
        _ensure_order_access(current_user, dict(order))

        bom = None
        materiales: list[dict[str, Any]] = []
        operaciones: list[dict[str, Any]] = []

        if order.get("BOM_Id"):
            bom = connection.execute(
                text("SELECT * FROM ERP_BOM WHERE BOM_Id = :bom_id"),
                {"bom_id": int(order["BOM_Id"])},
            ).mappings().first()
            materiales_rows = connection.execute(
                text(
                    """
                    SELECT
                        bm.*,
                        mp.Codigo AS MateriaCodigo,
                        mp.Nombre AS MateriaNombre,
                        mp.CostoUnitario,
                        mp.Moneda
                    FROM ERP_BOM_MATERIALES bm
                    LEFT JOIN ERP_MATERIA_PRIMA mp ON bm.MateriaPrima_Id = mp.MateriaPrima_Id
                    WHERE bm.BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(order["BOM_Id"])},
            ).mappings().all()
            operaciones_rows = connection.execute(
                text(
                    """
                    SELECT *
                    FROM ERP_BOM_OPERACIONES
                    WHERE BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(order["BOM_Id"])},
            ).mappings().all()
            materiales = [dict(row) for row in materiales_rows]
            operaciones = [dict(row) for row in operaciones_rows]

        consumos_rows = connection.execute(
            text(
                """
                SELECT
                    c.*,
                    mp.Codigo AS MateriaCodigo,
                    mp.Nombre AS MateriaNombre,
                    mp.CostoUnitario,
                    mp.Moneda
                FROM ERP_OP_CONSUMO_MATERIAL c
                INNER JOIN ERP_MATERIA_PRIMA mp ON c.MateriaPrima_Id = mp.MateriaPrima_Id
                WHERE c.OP_Id = :op_id
                ORDER BY c.FechaRegistro
                """
            ),
            {"op_id": order_id},
        ).mappings().all()
        resultado = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_OP_RESULTADO
                WHERE OP_Id = :op_id
                """
            ),
            {"op_id": order_id},
        ).mappings().first()

    return {
        "success": True,
        "data": {
            "orden": dict(order),
            "bom": dict(bom) if bom else None,
            "materiales": materiales,
            "operaciones": operaciones,
            "consumos": [dict(row) for row in consumos_rows],
            "resultado": dict(resultado) if resultado else None,
        },
    }


def get_production_close_preview(
    order_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_connection() as connection:
        order = connection.execute(
            text(
                """
                SELECT
                    op.OP_Id,
                    op.NumeroOP,
                    op.CantidadPlanificada,
                    op.BOM_Id,
                    op.Company_Id,
                    op.CompanySolicitante_Id,
                    p.Nombre AS ProductoNombre,
                    p.Precio AS PrecioVentaProducto
                FROM ERP_OP_PRODUCCION op
                LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
                WHERE op.OP_Id = :op_id
                """
            ),
            {"op_id": order_id},
        ).mappings().first()
        if not order:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Orden de produccion no encontrada"},
            )
        _ensure_order_access(current_user, dict(order))

        materiales: list[dict[str, Any]] = []
        operaciones: list[dict[str, Any]] = []
        if order.get("BOM_Id"):
            materiales_rows = connection.execute(
                text(
                    """
                    SELECT
                        bm.MateriaPrima_Id,
                        bm.CantidadTeorica,
                        bm.MermaPct,
                        mp.Nombre AS MateriaNombre,
                        mp.CostoUnitario,
                        mp.Moneda
                    FROM ERP_BOM_MATERIALES bm
                    LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = bm.MateriaPrima_Id
                    WHERE bm.BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(order["BOM_Id"])},
            ).mappings().all()
            operaciones_rows = connection.execute(
                text(
                    """
                    SELECT TipoCosto, CostoPorUnidad
                    FROM ERP_BOM_OPERACIONES
                    WHERE BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(order["BOM_Id"])},
            ).mappings().all()
            materiales = [dict(row) for row in materiales_rows]
            operaciones = [dict(row) for row in operaciones_rows]

    cantidad_planificada = float(order.get("CantidadPlanificada") or 0)
    costo_material_teorico = 0.0
    materiales_resumen: list[dict[str, Any]] = []
    for material in materiales:
        cantidad_base = float(material.get("CantidadTeorica") or 0) * cantidad_planificada
        factor_merma = 1 + (float(material.get("MermaPct") or 0) / 100)
        cantidad_con_merma = cantidad_base * factor_merma
        costo_unitario = float(material.get("CostoUnitario") or 0)
        costo_total = cantidad_con_merma * costo_unitario
        costo_material_teorico += costo_total
        materiales_resumen.append(
            {
                "materiaPrimaId": material.get("MateriaPrima_Id"),
                "materiaNombre": material.get("MateriaNombre"),
                "cantidadBase": cantidad_base,
                "cantidadConMerma": cantidad_con_merma,
                "costoUnitario": costo_unitario,
                "moneda": material.get("Moneda") or "MXN",
                "costoTotal": costo_total,
            }
        )

    costo_operacion_teorico = 0.0
    operaciones_resumen: list[dict[str, Any]] = []
    for operation in operaciones:
        costo_por_unidad = float(operation.get("CostoPorUnidad") or 0)
        costo_total = costo_por_unidad * cantidad_planificada
        costo_operacion_teorico += costo_total
        operaciones_resumen.append(
            {
                "tipoCosto": operation.get("TipoCosto"),
                "costoPorUnidad": costo_por_unidad,
                "costoTotal": costo_total,
            }
        )

    costo_total_teorico = costo_material_teorico + costo_operacion_teorico
    ingreso_teorico = float(order.get("PrecioVentaProducto") or 0) * cantidad_planificada
    margen_teorico = ingreso_teorico - costo_total_teorico

    return {
        "success": True,
        "data": {
            "op": dict(order),
            "resumen": {
                "cantidadPlanificada": cantidad_planificada,
                "costoMaterialTeorico": costo_material_teorico,
                "costoOperacionTeorico": costo_operacion_teorico,
                "costoTotalTeorico": costo_total_teorico,
                "ingresoTeorico": ingreso_teorico,
                "margenTeorico": margen_teorico,
            },
            "materiales": materiales_resumen,
            "operaciones": operaciones_resumen,
        },
    }


def create_production_order(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    producto_id = int(payload.get("Producto_Id") or 0)
    cantidad_planificada = float(payload.get("CantidadPlanificada") or 0)
    prioridad = str(payload.get("Prioridad") or "NORMAL").upper()

    if not company_id or not producto_id or cantidad_planificada <= 0:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "Company_Id, Producto_Id y CantidadPlanificada son requeridos",
            },
        )
    if not can_access_company(current_user, company_id):
        raise ApiServiceError(
            status_code=403,
            content={
                "success": False,
                "message": "No tiene permisos para crear ordenes en esta empresa",
            },
        )

    with get_transaction() as connection:
        product_row = connection.execute(
            text(
                """
                SELECT Producto_Id, Nombre
                FROM ERP_PRODUCTOS
                WHERE Producto_Id = :producto_id
                """
            ),
            {"producto_id": producto_id},
        ).mappings().first()
        if not product_row:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Producto no encontrado"},
            )
        product = dict(product_row)

        if prioridad != "ALTA":
            duplicate = connection.execute(
                text(
                    """
                    SELECT TOP 1 OP_Id, NumeroOP, Estado, FechaCreacion
                    FROM ERP_OP_PRODUCCION
                    WHERE Producto_Id = :producto_id
                      AND CantidadPlanificada = :cantidad_planificada
                      AND Estado IN ('EN_ESPERA', 'EN_PROCESO')
                      AND DATEDIFF(HOUR, FechaCreacion, GETDATE()) < 1
                    ORDER BY FechaCreacion DESC
                    """
                ),
                {
                    "producto_id": producto_id,
                    "cantidad_planificada": cantidad_planificada,
                },
            ).mappings().first()
            if duplicate:
                raise ApiServiceError(
                    status_code=409,
                    content={
                        "success": False,
                        "message": (
                            "Ya existe una orden de produccion duplicada: "
                            f"{duplicate['NumeroOP']} (Estado: {duplicate['Estado']}). "
                            "Se creo hace menos de 1 hora. Las ordenes de ALTA prioridad "
                            "no tienen esta restriccion."
                        ),
                        "existingOP": dict(duplicate),
                    },
                )

        ptc_company = _get_ptc_company(connection, fallback_company_id=company_id)
        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_OP_PRODUCCION (
                    NumeroOP,
                    Company_Id,
                    CompanySolicitante_Id,
                    Venta_Id,
                    ID_COTIZACION,
                    Producto_Id,
                    BOM_Id,
                    CantidadPlanificada,
                    Estado,
                    Prioridad,
                    FechaCreacion,
                    FechaEntregaCompromiso
                )
                OUTPUT INSERTED.*
                SELECT
                    'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' +
                    RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
                    :ptc_company_id,
                    :solicitante_company_id,
                    :venta_id,
                    :cotizacion_id,
                    :producto_id,
                    (
                        SELECT TOP 1 BOM_Id
                        FROM ERP_BOM
                        WHERE Producto_Id = :producto_id
                          AND Vigente = 1
                        ORDER BY CASE WHEN Company_Id = :ptc_company_id THEN 0 ELSE 1 END, Version DESC
                    ),
                    :cantidad_planificada,
                    'EN_ESPERA',
                    :prioridad,
                    GETDATE(),
                    :fecha_entrega
                """
            ),
            {
                "ptc_company_id": int(ptc_company["Company_Id"]),
                "solicitante_company_id": company_id,
                "venta_id": int(payload["Venta_Id"]) if payload.get("Venta_Id") else None,
                "cotizacion_id": (
                    int(payload["ID_COTIZACION"]) if payload.get("ID_COTIZACION") else None
                ),
                "producto_id": producto_id,
                "cantidad_planificada": cantidad_planificada,
                "prioridad": prioridad,
                "fecha_entrega": payload.get("FechaEntregaCompromiso"),
            },
        ).mappings().first()

    op_id = inserted["OP_Id"] if inserted and inserted.get("OP_Id") else None
    if inserted:
        inserted_data = dict(inserted)
        numero_op = str(inserted_data.get("NumeroOP") or f"OP #{op_id}")
        product_name = str(product.get("Nombre") or f"Producto {producto_id}")
        quantity_text = f"{cantidad_planificada:,.2f}".rstrip("0").rstrip(".")
        body = f"Se creo {numero_op} para {product_name} por {quantity_text} unidades."
        link = f"/produccion/ordenes/{op_id}" if op_id else "/produccion/ordenes"
        excluded = {_current_user_id(current_user)}
        notificacion_service.notify_company_users(
            company_id,
            tipo="op_creada",
            titulo=f"Nueva orden de produccion {numero_op}",
            cuerpo=body,
            link=link,
            exclude_user_ids=excluded,
            dedupe_hours=6,
        )

        producer_company_id = int(ptc_company["Company_Id"])
        if producer_company_id != company_id:
            notificacion_service.notify_company_users(
                producer_company_id,
                tipo="op_creada",
                titulo=f"Nueva orden de produccion {numero_op}",
                cuerpo=body,
                link=link,
                exclude_user_ids=excluded,
                dedupe_hours=6,
            )

    emit_background("produccion:nueva", {"op_id": op_id, "company_id": company_id})
    return {"success": True, "data": dict(inserted) if inserted else None}


def update_production_order_status(
    order_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    estado = str(payload.get("Estado") or "").strip().upper()
    if not estado:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Estado es requerido"},
        )

    with get_transaction() as connection:
        order = connection.execute(
            text(
                """
                SELECT OP_Id, BOM_Id, Producto_Id, Company_Id, CompanySolicitante_Id, Prioridad
                FROM ERP_OP_PRODUCCION
                WHERE OP_Id = :op_id
                """
            ),
            {"op_id": order_id},
        ).mappings().first()
        if not order:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Orden de produccion no encontrada"},
            )
        _ensure_order_access(current_user, dict(order))

        bom_id_to_use = int(order["BOM_Id"]) if order.get("BOM_Id") else None
        if estado == "EN_PROCESO":
            if not bom_id_to_use:
                bom_lookup = connection.execute(
                    text(
                        """
                        SELECT TOP 1 BOM_Id
                        FROM ERP_BOM
                        WHERE Producto_Id = :producto_id
                          AND Vigente = 1
                        ORDER BY CASE WHEN Company_Id = :company_id THEN 0 ELSE 1 END, Version DESC
                        """
                    ),
                    {
                        "producto_id": int(order["Producto_Id"]),
                        "company_id": int(order["Company_Id"]),
                    },
                ).mappings().first()

                if bom_lookup:
                    bom_id_to_use = int(bom_lookup["BOM_Id"])
                    connection.execute(
                        text(
                            """
                            UPDATE ERP_OP_PRODUCCION
                            SET BOM_Id = :bom_id
                            WHERE OP_Id = :op_id
                            """
                        ),
                        {"bom_id": bom_id_to_use, "op_id": order_id},
                    )
                else:
                    bom_any = connection.execute(
                        text(
                            """
                            SELECT COUNT(*) AS total
                            FROM ERP_BOM
                            WHERE Producto_Id = :producto_id
                            """
                        ),
                        {"producto_id": int(order["Producto_Id"])},
                    ).mappings().first()
                    total_bom = int((bom_any or {}).get("total") or 0)
                    if total_bom > 0:
                        raise ApiServiceError(
                            status_code=400,
                            content={
                                "success": False,
                                "message": (
                                    "No se puede iniciar la produccion: el producto tiene "
                                    "recetas, pero ninguna esta marcada como vigente. "
                                    "Marca una receta como vigente en Recetas de Produccion."
                                ),
                            },
                        )
                    raise ApiServiceError(
                        status_code=400,
                        content={
                            "success": False,
                            "message": (
                                "No se puede iniciar la produccion: este producto no tiene "
                                "una receta de produccion (BOM) asignada. "
                                "Crea una receta primero en Recetas de Produccion."
                            ),
                        },
                    )

            if str(order.get("Prioridad") or "").upper() != "ALTA":
                materials = connection.execute(
                    text(
                        """
                        SELECT COUNT(*) AS total
                        FROM ERP_BOM_MATERIALES
                        WHERE BOM_Id = :bom_id
                        """
                    ),
                    {"bom_id": bom_id_to_use},
                ).mappings().first()
                if int((materials or {}).get("total") or 0) == 0:
                    raise ApiServiceError(
                        status_code=400,
                        content={
                            "success": False,
                            "message": (
                                "No se puede iniciar la produccion: la receta (BOM) no "
                                "tiene materias primas definidas. Agrega materiales a la receta primero."
                            ),
                        },
                    )

        update_sql = """
            UPDATE ERP_OP_PRODUCCION
            SET Estado = :estado
        """
        if estado == "EN_PROCESO":
            update_sql += ", FechaInicio = CASE WHEN FechaInicio IS NULL THEN GETDATE() ELSE FechaInicio END"
        elif estado == "TERMINADA":
            update_sql += ", FechaFin = CASE WHEN FechaFin IS NULL THEN GETDATE() ELSE FechaFin END"
        update_sql += " WHERE OP_Id = :op_id"

        connection.execute(text(update_sql), {"estado": estado, "op_id": order_id})

    return {"success": True, "data": {"OP_Id": order_id, "Estado": estado}}


def confirm_production_order(
    order_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    can_produce = payload.get("canProduce")
    if not isinstance(can_produce, bool):
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "canProduce (boolean) es requerido",
            },
        )

    with get_transaction() as connection:
        ptc_company = _get_ptc_company(connection)
        user_companies = set(user_company_ids(current_user))
        if (
            not current_user.get("is_super_admin")
            and int(ptc_company["Company_Id"]) not in user_companies
        ):
            raise ApiServiceError(
                status_code=403,
                content={
                    "success": False,
                    "message": "Solo usuarios de PTC pueden confirmar la factibilidad",
                },
            )

        order = connection.execute(
            text("SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = :op_id"),
            {"op_id": order_id},
        ).mappings().first()
        if not order:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Orden de produccion no encontrada"},
            )

        new_state = "APROBADO_PTC" if can_produce else "RECHAZADO_PTC"
        comments = str(payload.get("Comentarios") or "").strip()
        note = (
            f"PTC Confirmacion: {'APROBADO' if can_produce else 'RECHAZADO'} por "
            f"{_username(current_user)} - "
            f"{connection.execute(text('SELECT CONVERT(VARCHAR(33), GETDATE(), 126) AS NowValue')).scalar_one()}"
        )
        if comments:
            note += f" - {comments}"

        connection.execute(
            text(
                """
                UPDATE ERP_OP_PRODUCCION
                SET
                    Estado = :estado,
                    Notas = ISNULL(Notas, '') + CHAR(13) + CHAR(10) + :nota
                WHERE OP_Id = :op_id
                """
            ),
            {"estado": new_state, "nota": note, "op_id": order_id},
        )
        updated = connection.execute(
            text("SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = :op_id"),
            {"op_id": order_id},
        ).mappings().first()

    return {"success": True, "data": dict(updated) if updated else None}


def close_production_order(
    order_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if payload.get("PiezasBuenas") is None:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "Debe indicar PiezasBuenas para cierre de la OP",
            },
        )

    consumos = list(payload.get("consumos") or [])
    piezas_buenas = float(payload.get("PiezasBuenas") or 0)
    piezas_merma = float(payload.get("PiezasMerma") or 0)
    comentarios = payload.get("Comentarios")
    operador_cierre = payload.get("OperadorCierre")
    almacen_id = int(payload["Almacen_Id"]) if payload.get("Almacen_Id") else None

    with get_transaction() as connection:
        order = connection.execute(
            text("SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = :op_id"),
            {"op_id": order_id},
        ).mappings().first()
        if not order:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Orden de produccion no encontrada"},
            )
        order_dict = dict(order)
        _ensure_order_access(current_user, order_dict)

        estado_actual = str(order_dict.get("Estado") or "").upper()
        if estado_actual == "CERRADA":
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "La orden ya esta cerrada"},
            )
        if estado_actual not in {"TERMINADA", "EN_PROCESO"}:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": (
                        f"No se puede cerrar una orden en estado {order_dict.get('Estado')}. "
                        "La orden debe estar en estado TERMINADA o EN_PROCESO para poder cerrarla."
                    ),
                },
            )

        if order_dict.get("BOM_Id"):
            material_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*) AS Total
                    FROM ERP_BOM_MATERIALES
                    WHERE BOM_Id = :bom_id
                    """
                ),
                {"bom_id": int(order_dict["BOM_Id"])},
            ).mappings().first()
            if int((material_count or {}).get("Total") or 0) > 0 and not consumos:
                raise ApiServiceError(
                    status_code=400,
                    content={
                        "success": False,
                        "message": (
                            "Debe registrar al menos un consumo de material "
                            "(la OP tiene BOM con materiales)"
                        ),
                    },
                )

        for consumo in consumos:
            materia_prima_id = int(consumo.get("MateriaPrima_Id") or 0)
            cantidad_teorica = float(consumo.get("CantidadTeorica") or 0)
            cantidad_real = float(consumo.get("CantidadReal") or 0)
            unidad_consumo = str(consumo.get("UnidadConsumo") or "KG")
            merma_cantidad = cantidad_real - cantidad_teorica if cantidad_real > cantidad_teorica else 0

            connection.execute(
                text(
                    """
                    INSERT INTO ERP_OP_CONSUMO_MATERIAL (
                        OP_Id,
                        MateriaPrima_Id,
                        CantidadTeorica,
                        CantidadReal,
                        UnidadConsumo,
                        MermaCantidad,
                        FechaRegistro,
                        RegistradoPor
                    )
                    VALUES (
                        :op_id,
                        :materia_prima_id,
                        :cantidad_teorica,
                        :cantidad_real,
                        :unidad_consumo,
                        :merma_cantidad,
                        GETDATE(),
                        :registrado_por
                    )
                    """
                ),
                {
                    "op_id": order_id,
                    "materia_prima_id": materia_prima_id,
                    "cantidad_teorica": cantidad_teorica,
                    "cantidad_real": cantidad_real,
                    "unidad_consumo": unidad_consumo,
                    "merma_cantidad": merma_cantidad,
                    "registrado_por": _username(current_user),
                },
            )

        total_producido = piezas_buenas + piezas_merma
        if total_producido > float(order_dict.get("CantidadPlanificada") or 0):
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": (
                        f"Limite de produccion excedido. Total reportado ({total_producido}) "
                        f"no puede superar lo planificado ({order_dict.get('CantidadPlanificada')})."
                    ),
                },
            )

        connection.execute(
            text(
                """
                INSERT INTO ERP_OP_RESULTADO (
                    OP_Id,
                    PiezasBuenas,
                    PiezasMerma,
                    Comentarios,
                    OperadorCierre,
                    FechaCierre
                )
                VALUES (
                    :op_id,
                    :piezas_buenas,
                    :piezas_merma,
                    :comentarios,
                    :operador_cierre,
                    GETDATE()
                )
                """
            ),
            {
                "op_id": order_id,
                "piezas_buenas": piezas_buenas,
                "piezas_merma": piezas_merma,
                "comentarios": comentarios,
                "operador_cierre": operador_cierre,
            },
        )
        connection.execute(
            text(
                """
                UPDATE ERP_OP_PRODUCCION
                SET
                    CantidadProducida = :cantidad_producida,
                    MermaUnidades = :merma_unidades,
                    Estado = 'CERRADA',
                    FechaFin = GETDATE()
                WHERE OP_Id = :op_id
                """
            ),
            {
                "cantidad_producida": piezas_buenas,
                "merma_unidades": piezas_merma,
                "op_id": order_id,
            },
        )

        usuario = _username(current_user)
        cantidad_entrada = piezas_buenas
        recepcion_result = None
        almacen_productora_id = None
        if cantidad_entrada > 0:
            try:
                recepcion_result = registrar_recepcion_produccion(
                    connection,
                    op=order_dict,
                    cantidad_recibida=cantidad_entrada,
                    almacen_id=almacen_id,
                    observaciones=comentarios,
                    usuario=usuario,
                )
            except ValueError as exc:
                raise ApiServiceError(
                    status_code=400,
                    content={"success": False, "message": str(exc)},
                ) from exc
            almacen_productora_id = int(recepcion_result["almacenId"]) if recepcion_result else None

        cantidad_transferida = 0.0
        cantidad_solicitada = float(order_dict.get("CantidadPlanificada") or 0)
        if (
            cantidad_entrada > 0
            and order_dict.get("CompanySolicitante_Id")
            and int(order_dict["CompanySolicitante_Id"]) != int(order_dict["Company_Id"])
            and almacen_productora_id
        ):
            cantidad_a_transferir = min(cantidad_entrada, cantidad_solicitada)
            almacen_solicitante = resolve_almacen_producto(
                connection,
                producto_id=int(order_dict["Producto_Id"]),
                company_id=int(order_dict["CompanySolicitante_Id"]),
                allow_fallback=True,
            )
            if cantidad_a_transferir > 0 and almacen_solicitante and almacen_solicitante.get("Almacen_Id"):
                almacen_solicitante_id = int(almacen_solicitante["Almacen_Id"])
                referencia = f"{order_dict['NumeroOP']}-TRANSFER"

                stock_ptc_actual = get_current_stock(
                    connection,
                    int(order_dict["Producto_Id"]),
                    almacen_productora_id,
                )["cantidad"]
                stock_ptc_despues = stock_ptc_actual - cantidad_a_transferir
                upsert_stock(
                    connection,
                    int(order_dict["Producto_Id"]),
                    almacen_productora_id,
                    stock_ptc_despues,
                )
                insert_kardex_movimiento(
                    connection,
                    producto_id=int(order_dict["Producto_Id"]),
                    almacen_id=almacen_productora_id,
                    tipo_movimiento="TRANSFERENCIA_OUT",
                    cantidad=cantidad_a_transferir,
                    stock_anterior=stock_ptc_actual,
                    stock_actual=stock_ptc_despues,
                    referencia=referencia,
                    usuario=usuario,
                )

                stock_solicitante_antes = get_current_stock(
                    connection,
                    int(order_dict["Producto_Id"]),
                    almacen_solicitante_id,
                )["cantidad"]
                stock_solicitante_nuevo = stock_solicitante_antes + cantidad_a_transferir
                upsert_stock(
                    connection,
                    int(order_dict["Producto_Id"]),
                    almacen_solicitante_id,
                    stock_solicitante_nuevo,
                )
                insert_kardex_movimiento(
                    connection,
                    producto_id=int(order_dict["Producto_Id"]),
                    almacen_id=almacen_solicitante_id,
                    tipo_movimiento="TRANSFERENCIA_IN",
                    cantidad=cantidad_a_transferir,
                    stock_anterior=stock_solicitante_antes,
                    stock_actual=stock_solicitante_nuevo,
                    referencia=referencia,
                    usuario=usuario,
                )

                sync_inventario_estado(
                    connection,
                    producto_id=int(order_dict["Producto_Id"]),
                    company_id=int(order_dict["Company_Id"]),
                    almacen_id=almacen_productora_id,
                )
                sync_inventario_estado(
                    connection,
                    producto_id=int(order_dict["Producto_Id"]),
                    company_id=int(order_dict["CompanySolicitante_Id"]),
                    almacen_id=almacen_solicitante_id,
                )
                cantidad_transferida = cantidad_a_transferir

    return {
        "success": True,
        "data": {
            "OP_Id": order_id,
            "recepcion": (
                {
                    "Almacen_Id": recepcion_result.get("almacenId"),
                    "AlmacenNombre": recepcion_result.get("almacenNombre"),
                    "CantidadRecibida": cantidad_entrada,
                    "ClasificacionInventario": recepcion_result.get("clasificacion"),
                    "StockAnterior": recepcion_result.get("stockAnterior"),
                    "StockActual": recepcion_result.get("stockActual"),
                }
                if recepcion_result
                else None
            ),
            "transferidoASolicitante": cantidad_transferida > 0,
            "cantidadTransferida": cantidad_transferida,
            "cantidadSolicitada": cantidad_solicitada,
            "excedente": cantidad_entrada - cantidad_transferida,
        },
    }
