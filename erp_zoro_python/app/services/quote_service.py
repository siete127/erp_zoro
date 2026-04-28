from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.services import aprobacion_service
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _get_cost_config(connection, company_id: int) -> dict[str, Any]:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 *
            FROM ERP_CONFIG_COSTOS_PTC
            WHERE Company_Id = :company_id
            """
        ),
        {"company_id": company_id},
    ).mappings().first()

    if row:
        return dict(row)

    return {
        "MermaPctDefault": 0,
        "CostoHoraManoObra": 0,
        "CostoHoraMaquina": 0,
        "PorcentajeIndirectos": 0,
        "MargenVerdeMin": 25,
        "MargenAmarilloMin": 15,
        "MargenRojoMax": 15,
        "DiasVigenciaDefault": 15,
        "RequiereOverrideBajoMargen": True,
        "HabilitarBloqueoMorosidad": False,
    }


def _calcular_costo_unitario_ptc(connection, producto_id: int, company_id: int) -> float | None:
    bom = connection.execute(
        text(
            """
            SELECT TOP 1 b.BOM_Id, b.MermaPct, cfg.PorcentajeIndirectos
            FROM ERP_BOM b
            LEFT JOIN ERP_CONFIG_COSTOS_PTC cfg ON cfg.Company_Id = b.Company_Id
            WHERE b.Producto_Id = :producto_id
              AND b.Company_Id = :company_id
              AND b.Vigente = 1
            ORDER BY b.Version DESC
            """
        ),
        {"producto_id": producto_id, "company_id": company_id},
    ).mappings().first()

    if not bom:
        return None

    bom_id = bom["BOM_Id"]
    merma_global = float(bom.get("MermaPct") or 0)
    pct_indirectos = float(bom.get("PorcentajeIndirectos") or 0)

    mat_rows = connection.execute(
        text(
            """
            SELECT m.CantidadTeorica, m.MermaPct, mp.CostoUnitario
            FROM ERP_BOM_MATERIALES m
            INNER JOIN ERP_MATERIA_PRIMA mp ON m.MateriaPrima_Id = mp.MateriaPrima_Id
            WHERE m.BOM_Id = :bom_id
            """
        ),
        {"bom_id": bom_id},
    ).mappings().all()

    costo_materiales = 0.0
    for row in mat_rows:
        cantidad = float(row.get("CantidadTeorica") or 0)
        merma_local = float(row.get("MermaPct") or 0)
        costo_unit = float(row.get("CostoUnitario") or 0)
        factor_merma = 1 + (merma_global + merma_local) / 100
        costo_materiales += cantidad * factor_merma * costo_unit

    op_rows = connection.execute(
        text(
            """
            SELECT CostoPorUnidad
            FROM ERP_BOM_OPERACIONES
            WHERE BOM_Id = :bom_id
            """
        ),
        {"bom_id": bom_id},
    ).mappings().all()

    costo_operaciones = sum(float(row.get("CostoPorUnidad") or 0) for row in op_rows)
    costo_base = costo_materiales + costo_operaciones
    if pct_indirectos > 0:
        costo_base *= 1 + pct_indirectos / 100
    return costo_base


def _preparar_detalles_y_totales(connection, body: dict[str, Any]) -> dict[str, Any]:
    company_id = int(body["Company_Id"])
    detalles = body.get("detalles") or []
    if not detalles:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un renglon en la cotizacion")

    config = _get_cost_config(connection, company_id)

    subtotal = 0.0
    iva_total = 0.0
    total = 0.0
    costo_total = 0.0
    detalles_calculados: list[dict[str, Any]] = []

    for detail in detalles:
        tipo_producto = str(detail.get("TipoProducto") or "CATALOGO").upper()
        cantidad = float(detail.get("Cantidad") or detail.get("CANTIDAD") or 0)
        precio_unitario = float(detail.get("PrecioUnitario") or detail.get("PRECIO_UNITARIO") or 0)
        if cantidad <= 0 or precio_unitario <= 0:
            raise HTTPException(
                status_code=400,
                detail="Cada renglon debe tener Cantidad y PrecioUnitario > 0",
            )

        costo_unitario = None
        producto_id = detail.get("Producto_Id") or detail.get("ID_PRODUCTO")
        if tipo_producto == "PTC" and producto_id:
            costo_unitario = _calcular_costo_unitario_ptc(connection, int(producto_id), company_id)

        sub = cantidad * precio_unitario
        iva = sub * 0.16
        total_r = sub + iva

        utilidad = None
        margen_pct = None
        if costo_unitario is not None:
            costo_r = cantidad * costo_unitario
            utilidad = sub - costo_r
            margen_pct = (utilidad / sub) * 100 if sub > 0 else None
            costo_total += costo_r

        subtotal += sub
        iva_total += iva
        total += total_r

        detalles_calculados.append(
            {
                "ID_PRODUCTO": int(producto_id) if producto_id else None,
                "TipoProducto": tipo_producto,
                "SKU": detail.get("SKU"),
                "Descripcion": detail.get("Descripcion") or "",
                "UnidadVenta": detail.get("UnidadVenta") or "PZA",
                "CANTIDAD": cantidad,
                "PRECIO_UNITARIO": precio_unitario,
                "COSTO_UNITARIO": costo_unitario,
                "SUBTOTAL": sub,
                "IVA": iva,
                "TOTAL": total_r,
                "UTILIDAD": utilidad,
                "MARGEN_PCT": margen_pct,
                "DatosPTC_JSON": detail.get("DatosPTC"),
            }
        )

    utilidad_bruta = None
    margen_global = None
    if costo_total > 0:
        utilidad_bruta = subtotal - costo_total
        margen_global = (utilidad_bruta / subtotal) * 100 if subtotal > 0 else None

    return {
        "config": config,
        "subtotal": subtotal,
        "iva": iva_total,
        "total": total,
        "costoTotal": costo_total if costo_total > 0 else None,
        "utilidadBruta": utilidad_bruta,
        "margenGlobal": margen_global,
        "detallesCalculados": detalles_calculados,
    }


def _calc_semaforo(config: dict[str, Any], margen_global: float | None) -> str:
    if margen_global is None:
        return "SIN_COSTO"
    margen_verde = float(config.get("MargenVerdeMin") or 25)
    margen_amarillo = float(config.get("MargenAmarilloMin") or 15)
    margen_rojo = float(config.get("MargenRojoMax") or 15)
    if margen_global > margen_verde:
        return "VERDE"
    if margen_amarillo <= margen_global <= margen_verde:
        return "AMARILLO"
    if margen_global < margen_rojo:
        return "ROJO"
    return "SIN_COSTO"


def create_quote(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload["Company_Id"])
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="No tiene permisos para usar esta empresa")

    if not payload.get("EmpresaCodigo"):
        raise HTTPException(status_code=400, detail="EmpresaCodigo es requerido")
    if not payload.get("Client_Id") and not (payload.get("ClienteRFC") and payload.get("ClienteNombre")):
        raise HTTPException(
            status_code=400,
            detail="Debe indicar Client_Id o (ClienteRFC y ClienteNombre)",
        )

    linked_opportunity_id = int(payload["Oportunidad_Id"]) if payload.get("Oportunidad_Id") else None

    with get_transaction() as connection:
        if linked_opportunity_id:
            opportunity = connection.execute(
                text(
                    """
                    SELECT Oportunidad_Id, Company_Id, Client_Id, ID_COTIZACION
                    FROM ERP_CRM_OPORTUNIDADES
                    WHERE Oportunidad_Id = :opportunity_id
                    """
                ),
                {"opportunity_id": linked_opportunity_id},
            ).mappings().first()
            if not opportunity:
                raise HTTPException(status_code=404, detail="Oportunidad CRM no encontrada")
            if int(opportunity["Company_Id"]) != company_id:
                raise HTTPException(
                    status_code=400,
                    detail="La oportunidad CRM pertenece a otra empresa",
                )
            if opportunity.get("Client_Id") and payload.get("Client_Id"):
                if int(opportunity["Client_Id"]) != int(payload["Client_Id"]):
                    raise HTTPException(
                        status_code=400,
                        detail="La oportunidad CRM pertenece a otro cliente",
                    )
            if opportunity.get("ID_COTIZACION"):
                raise HTTPException(
                    status_code=400,
                    detail="La oportunidad CRM ya tiene una cotizacion vinculada",
                )

        prepared = _preparar_detalles_y_totales(connection, payload)
        config = prepared["config"]
        margen_global = prepared["margenGlobal"]
        semaforo = _calc_semaforo(config, margen_global)

        if (
            semaforo == "ROJO"
            and config.get("RequiereOverrideBajoMargen")
            and not payload.get("OverrideMargen")
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "message": "Margen menor al minimo permitido. Se requiere autorizacion de gerente.",
                    "data": {"margenGlobal": margen_global, "semaforo": semaforo},
                },
            )

        fecha_vigencia = payload.get("FechaVigencia")
        if fecha_vigencia:
            fecha_vigencia_value = fecha_vigencia
        else:
            dias = int(config.get("DiasVigenciaDefault") or 15)
            fecha_vigencia_value = datetime.now() + timedelta(days=dias)

        result = connection.execute(
            text(
                """
                INSERT INTO ERP_COTIZACIONES (
                    Company_Id,
                    Client_Id,
                    ClienteRFC,
                    ClienteNombre,
                    EmpresaCodigo,
                    Moneda,
                    Subtotal,
                    IVA,
                    TOTAL,
                    CostoTotal,
                    UtilidadBruta,
                    MargenPorc,
                    Status,
                    Vendedor,
                    CondicionesPago,
                    ComentarioDescuento,
                    FechaVigencia,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :client_id,
                    :cliente_rfc,
                    :cliente_nombre,
                    :empresa_codigo,
                    :moneda,
                    :subtotal,
                    :iva,
                    :total,
                    :costo_total,
                    :utilidad_bruta,
                    :margen_porc,
                    'BORRADOR',
                    :vendedor,
                    :condiciones_pago,
                    :comentario_descuento,
                    :fecha_vigencia,
                    :creado_por
                )
                """
            ),
            {
                "company_id": company_id,
                "client_id": payload.get("Client_Id"),
                "cliente_rfc": payload.get("ClienteRFC"),
                "cliente_nombre": payload.get("ClienteNombre"),
                "empresa_codigo": payload.get("EmpresaCodigo"),
                "moneda": payload.get("Moneda") or "MXN",
                "subtotal": prepared["subtotal"],
                "iva": prepared["iva"],
                "total": prepared["total"],
                "costo_total": prepared["costoTotal"],
                "utilidad_bruta": prepared["utilidadBruta"],
                "margen_porc": margen_global,
                "vendedor": payload.get("Vendedor"),
                "condiciones_pago": payload.get("CondicionesPago"),
                "comentario_descuento": payload.get("ComentarioDescuento"),
                "fecha_vigencia": fecha_vigencia_value,
                "creado_por": current_user.get("Username") or current_user.get("Email"),
            },
        ).mappings().first()

        quote_id = int(result["ID_COTIZACION"])
        for detail in prepared["detallesCalculados"]:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_COTIZACION_DETALLE (
                        ID_COTIZACION,
                        ID_PRODUCTO,
                        TipoProducto,
                        SKU,
                        Descripcion,
                        UnidadVenta,
                        CANTIDAD,
                        PRECIO_UNITARIO,
                        COSTO_UNITARIO,
                        SUBTOTAL,
                        IVA,
                        TOTAL,
                        UTILIDAD,
                        MARGEN_PCT,
                        DatosPTC_JSON
                    )
                    VALUES (
                        :quote_id,
                        :product_id,
                        :tipo_producto,
                        :sku,
                        :descripcion,
                        :unidad_venta,
                        :cantidad,
                        :precio_unitario,
                        :costo_unitario,
                        :subtotal,
                        :iva,
                        :total,
                        :utilidad,
                        :margen_pct,
                        :datos_ptc_json
                    )
                    """
                ),
                {
                    "quote_id": quote_id,
                    "product_id": detail["ID_PRODUCTO"],
                    "tipo_producto": detail["TipoProducto"],
                    "sku": detail["SKU"],
                    "descripcion": detail["Descripcion"],
                    "unidad_venta": detail["UnidadVenta"],
                    "cantidad": detail["CANTIDAD"],
                    "precio_unitario": detail["PRECIO_UNITARIO"],
                    "costo_unitario": detail["COSTO_UNITARIO"],
                    "subtotal": detail["SUBTOTAL"],
                    "iva": detail["IVA"],
                    "total": detail["TOTAL"],
                    "utilidad": detail["UTILIDAD"],
                    "margen_pct": detail["MARGEN_PCT"],
                    "datos_ptc_json": (
                        None if detail["DatosPTC_JSON"] is None else str(detail["DatosPTC_JSON"])
                    ),
                },
            )

        if linked_opportunity_id:
            connection.execute(
                text(
                    """
                    UPDATE ERP_CRM_OPORTUNIDADES
                    SET
                        ID_COTIZACION = :quote_id,
                        FechaModificacion = GETDATE()
                    WHERE Oportunidad_Id = :opportunity_id
                    """
                ),
                {
                    "quote_id": quote_id,
                    "opportunity_id": linked_opportunity_id,
                },
            )

    emit_background("cotizacion:changed", {"quote_id": quote_id})
    if linked_opportunity_id:
        emit_background("crm:oportunidad:changed", {"opportunity_id": linked_opportunity_id})
    return {
        "success": True,
        "data": {
            "cabecera": dict(result),
            "detalles": prepared["detallesCalculados"],
            "semaforo": semaforo,
            "margenGlobal": margen_global,
        },
    }


def list_quotes(
    current_user: dict[str, Any],
    company_id: int | None,
    client_id: int | None,
    status: str | None,
) -> dict[str, Any]:
    query = """
        SELECT
            c.*,
            cli.LegalName AS ClientLegalName,
            cli.CommercialName AS ClientCommercialName,
            opp.Oportunidad_Id,
            opp.NombreOportunidad AS OportunidadNombre,
            opp.Status AS OportunidadStatus,
            sale.Venta_Id,
            sale.Status AS VentaStatus,
            sale.Status_Id AS VentaStatus_Id
        FROM ERP_COTIZACIONES c
        LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
        LEFT JOIN ERP_CRM_OPORTUNIDADES opp
            ON opp.Oportunidad_Id = (
                SELECT TOP 1 o2.Oportunidad_Id
                FROM ERP_CRM_OPORTUNIDADES o2
                WHERE o2.ID_COTIZACION = c.ID_COTIZACION
                ORDER BY o2.Oportunidad_Id DESC
            )
        LEFT JOIN ERP_VENTAS sale
            ON sale.Venta_Id = (
                SELECT TOP 1 v2.Venta_Id
                FROM ERP_VENTAS v2
                WHERE v2.ID_COTIZACION = c.ID_COTIZACION
                ORDER BY v2.Venta_Id DESC
            )
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND c.Company_Id IN ({clause})"
        params.update(clause_params)
    elif company_id:
        query += " AND c.Company_Id = :company_id"
        params["company_id"] = company_id

    if client_id:
        query += " AND c.Client_Id = :client_id"
        params["client_id"] = client_id
    if status:
        query += " AND c.Status = :status"
        params["status"] = status

    query += " ORDER BY c.FechaCreacion DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_quote_detail(quote_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        cab = connection.execute(
            text(
                """
                SELECT
                    c.*,
                    cli.LegalName AS ClientLegalName,
                    cli.CommercialName AS ClientCommercialName,
                    cli.RFC AS ClientRFC,
                    opp.Oportunidad_Id,
                    opp.NombreOportunidad AS OportunidadNombre,
                    opp.Status AS OportunidadStatus,
                    sale.Venta_Id,
                    sale.Status AS VentaStatus,
                    sale.Status_Id AS VentaStatus_Id
                FROM ERP_COTIZACIONES c
                LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
                LEFT JOIN ERP_CRM_OPORTUNIDADES opp
                    ON opp.Oportunidad_Id = (
                        SELECT TOP 1 o2.Oportunidad_Id
                        FROM ERP_CRM_OPORTUNIDADES o2
                        WHERE o2.ID_COTIZACION = c.ID_COTIZACION
                        ORDER BY o2.Oportunidad_Id DESC
                    )
                LEFT JOIN ERP_VENTAS sale
                    ON sale.Venta_Id = (
                        SELECT TOP 1 v2.Venta_Id
                        FROM ERP_VENTAS v2
                        WHERE v2.ID_COTIZACION = c.ID_COTIZACION
                        ORDER BY v2.Venta_Id DESC
                    )
                WHERE c.ID_COTIZACION = :quote_id
                """
            ),
            {"quote_id": quote_id},
        ).mappings().first()

        if not cab:
            raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
        if not can_access_company(current_user, int(cab["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para ver esta cotizacion")

        det = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_COTIZACION_DETALLE
                WHERE ID_COTIZACION = :quote_id
                ORDER BY ID_DETALLE
                """
            ),
            {"quote_id": quote_id},
        ).mappings().all()

    return {"success": True, "data": {"cabecera": dict(cab), "detalles": [dict(row) for row in det]}}


def approve_quote(
    quote_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        cab = connection.execute(
            text("SELECT * FROM ERP_COTIZACIONES WHERE ID_COTIZACION = :quote_id"),
            {"quote_id": quote_id},
        ).mappings().first()
        if not cab:
            raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
        if not can_access_company(current_user, int(cab["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para usar esta cotizacion")

        status_actual = str(cab.get("Status") or "BORRADOR").upper()
        if status_actual == "CONVERTIDA":
            raise HTTPException(status_code=400, detail="La cotizacion ya fue convertida a venta")
        if status_actual == "APROBADA":
            return {
                "success": True,
                "message": "Cotizacion ya aprobada",
                "data": {
                    "ID_COTIZACION": quote_id,
                    "Status": status_actual,
                    "margenGlobal": float(cab["MargenPorc"]) if cab.get("MargenPorc") is not None else None,
                },
            }

        config = _get_cost_config(connection, int(cab["Company_Id"]))
        margen_global = float(cab["MargenPorc"]) if cab.get("MargenPorc") is not None else None
        semaforo = _calc_semaforo(config, margen_global)

        if (
            semaforo == "ROJO"
            and config.get("RequiereOverrideBajoMargen")
            and not payload.get("OverrideMargen")
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "message": "Margen menor al minimo permitido. Se requiere autorizacion de gerente para aprobar.",
                    "data": {"margenGlobal": margen_global, "semaforo": semaforo},
                },
            )

        comentario_descuento = payload.get("ComentarioDescuento") or cab.get("ComentarioDescuento")
        modificado_por = current_user.get("Username") or current_user.get("Email")
        aprobacion_id = None

        if status_actual == "PENDIENTE_APROBACION":
            solicitud = aprobacion_service.get_pending_solicitud(
                connection,
                "COTIZACION",
                quote_id,
                int(cab["Company_Id"]),
            )
            if not solicitud:
                raise HTTPException(status_code=400, detail="La cotizacion no tiene una aprobacion pendiente")

            aprobacion_service.decidir_aprobacion_tx(
                connection,
                solicitud,
                True,
                comentario_descuento,
                current_user,
            )
            connection.execute(
                text(
                    """
                    UPDATE ERP_COTIZACIONES
                    SET ComentarioDescuento = :comentario_descuento,
                        ModificadoPor = :modificado_por,
                        FechaModificacion = GETDATE()
                    WHERE ID_COTIZACION = :quote_id
                    """
                ),
                {
                    "quote_id": quote_id,
                    "comentario_descuento": comentario_descuento,
                    "modificado_por": modificado_por,
                },
            )
            nuevo_status = "APROBADA"
            message = "Cotizacion aprobada"
        else:
            aprobacion_id = aprobacion_service.crear_solicitud(
                connection,
                modulo="COTIZACION",
                documento_id=quote_id,
                company_id=int(cab["Company_Id"]),
                monto=float(cab.get("TOTAL") or 0),
            )
            nuevo_status = "PENDIENTE_APROBACION" if aprobacion_id else "APROBADA"
            message = "Cotizacion enviada a aprobacion" if aprobacion_id else "Cotizacion aprobada"
            connection.execute(
                text(
                    """
                    UPDATE ERP_COTIZACIONES
                    SET Status = :status,
                        ComentarioDescuento = :comentario_descuento,
                        ModificadoPor = :modificado_por,
                        FechaModificacion = GETDATE()
                    WHERE ID_COTIZACION = :quote_id
                    """
                ),
                {
                    "quote_id": quote_id,
                    "status": nuevo_status,
                    "comentario_descuento": comentario_descuento,
                    "modificado_por": modificado_por,
                },
            )

    emit_background("cotizacion:changed", {"quote_id": quote_id})
    return {
        "success": True,
        "message": message,
        "data": {
            "ID_COTIZACION": quote_id,
            "Status": nuevo_status,
            "Aprobacion_Id": aprobacion_id,
            "semaforo": semaforo,
            "margenGlobal": margen_global,
        },
    }


def confirm_order_from_quote(quote_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    linked_opportunity_id: int | None = None
    with get_transaction() as connection:
        quote = connection.execute(
            text(
                """
                SELECT c.*, cli.LegalName AS ClientLegalName, cli.CommercialName AS ClientCommercialName
                FROM ERP_COTIZACIONES c
                LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
                WHERE c.ID_COTIZACION = :quote_id
                """
            ),
            {"quote_id": quote_id},
        ).mappings().first()
        if not quote:
            raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
        if not can_access_company(current_user, int(quote["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para usar esta cotizacion")
        if str(quote.get("Status") or "").upper() != "APROBADA":
            raise HTTPException(
                status_code=400,
                detail="La cotizacion debe estar APROBADA para confirmar el pedido",
            )

        details = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_COTIZACION_DETALLE
                WHERE ID_COTIZACION = :quote_id
                """
            ),
            {"quote_id": quote_id},
        ).mappings().all()
        if not details:
            raise HTTPException(status_code=400, detail="La cotizacion no tiene detalle capturado")

        sale_status = connection.execute(
            text("SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = 2")
        ).mappings().first()
        sale = connection.execute(
            text(
                """
                INSERT INTO ERP_VENTAS (
                    Company_Id,
                    Total,
                    IVA,
                    Subtotal,
                    Moneda,
                    Status_Id,
                    FechaVenta,
                    Status,
                    ID_COTIZACION,
                    Client_Id
                )
                OUTPUT INSERTED.Venta_Id
                VALUES (
                    :company_id,
                    :total,
                    :iva,
                    :subtotal,
                    :moneda,
                    2,
                    GETDATE(),
                    :status,
                    :quote_id,
                    :client_id
                )
                """
            ),
            {
                "company_id": quote["Company_Id"],
                "total": quote["TOTAL"],
                "iva": quote["IVA"],
                "subtotal": quote["Subtotal"],
                "moneda": quote.get("Moneda") or "MXN",
                "status": sale_status["Nombre"] if sale_status else "Completada",
                "quote_id": quote_id,
                "client_id": quote.get("Client_Id"),
            },
        ).first()
        sale_id = int(sale[0]) if sale else None

        for detail in details:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_VENTA_DETALLE (
                        Venta_Id,
                        Producto_Id,
                        Cantidad,
                        PrecioUnitario,
                        Subtotal,
                        IVA,
                        Total
                    )
                    VALUES (
                        :sale_id,
                        :product_id,
                        :cantidad,
                        :precio_unitario,
                        :subtotal,
                        :iva,
                        :total
                    )
                    """
                ),
                {
                    "sale_id": sale_id,
                    "product_id": detail.get("ID_PRODUCTO"),
                    "cantidad": detail.get("CANTIDAD"),
                    "precio_unitario": detail.get("PRECIO_UNITARIO"),
                    "subtotal": detail.get("SUBTOTAL"),
                    "iva": detail.get("IVA"),
                    "total": detail.get("TOTAL"),
                },
            )

        connection.execute(
            text(
                """
                UPDATE ERP_COTIZACIONES
                SET
                    Status = 'CONVERTIDA',
                    ModificadoPor = :modificado_por,
                    FechaModificacion = GETDATE()
                WHERE ID_COTIZACION = :quote_id
                """
            ),
            {
                "quote_id": quote_id,
                "modificado_por": current_user.get("Username") or current_user.get("Email"),
            },
        )

        if sale_id:
            connection.execute(
                text(
                    """
                    UPDATE ERP_CRM_OPORTUNIDADES
                    SET
                        Status = 'Ganada',
                        Venta_Id = :sale_id,
                        FechaCierreReal = GETDATE(),
                        FechaModificacion = GETDATE()
                    WHERE ID_COTIZACION = :quote_id
                    """
                ),
                {
                    "sale_id": sale_id,
                    "quote_id": quote_id,
                },
            )
            linked_opp = connection.execute(
                text(
                    """
                    SELECT TOP 1 Oportunidad_Id
                    FROM ERP_CRM_OPORTUNIDADES
                    WHERE ID_COTIZACION = :quote_id
                    ORDER BY Oportunidad_Id
                    """
                ),
                {"quote_id": quote_id},
            ).mappings().first()
            linked_opportunity_id = (
                int(linked_opp["Oportunidad_Id"])
                if linked_opp and linked_opp.get("Oportunidad_Id")
                else None
            )

    emit_background("cotizacion:changed", {"quote_id": quote_id})
    if linked_opportunity_id:
        emit_background("crm:oportunidad:changed", {"opportunity_id": linked_opportunity_id})
    return {"success": True, "data": {"ID_COTIZACION": quote_id, "Venta_Id": sale_id}}
