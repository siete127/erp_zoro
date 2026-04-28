from __future__ import annotations

import html
import json
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.core.socketio import emit_background
from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


def _username(current_user: dict[str, Any]) -> str | None:
    return (
        current_user.get("Username")
        or current_user.get("username")
        or current_user.get("Email")
        or current_user.get("email")
        or None
    )


def _load_opportunity(connection: Any, opportunity_id: int) -> dict[str, Any] | None:
    row = connection.execute(
        text(
            """
            SELECT *
            FROM ERP_CRM_OPORTUNIDADES
            WHERE Oportunidad_Id = :oportunidad_id
            """
        ),
        {"oportunidad_id": opportunity_id},
    ).mappings().first()
    return dict(row) if row else None


def _ensure_company_access(current_user: dict[str, Any], company_id: int | None) -> None:
    if not can_access_company(current_user, company_id):
        raise ApiServiceError(
            status_code=403,
            content={"success": False, "message": "No tiene permisos para acceder a esta empresa"},
        )


def _ensure_opportunity_access(
    connection: Any,
    opportunity_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    opportunity = _load_opportunity(connection, opportunity_id)
    if not opportunity:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Oportunidad no encontrada"},
        )
    _ensure_company_access(current_user, int(opportunity["Company_Id"]))
    return opportunity


def _get_ptc_company_id(connection: Any, fallback_company_id: int) -> int:
    row = connection.execute(
        text(
            """
            SELECT TOP 1 Company_Id
            FROM ERP_COMPANY
            WHERE NameCompany LIKE '%PTC%'
            ORDER BY Company_Id
            """
        )
    ).mappings().first()
    return int(row["Company_Id"]) if row and row.get("Company_Id") else fallback_company_id


def _parse_activity_products(activity: dict[str, Any]) -> dict[str, Any]:
    parsed = dict(activity)
    descripcion = parsed.get("Descripcion")
    if not descripcion:
        return parsed

    try:
        cleaned = html.unescape(str(descripcion))
        if "[{" not in cleaned:
            return parsed
        match = re.search(r"\[\{.*\}\]", cleaned)
        if not match:
            return parsed
        parsed["Productos"] = json.loads(match.group(0))
    except (json.JSONDecodeError, TypeError, ValueError):
        return parsed
    return parsed


def get_etapas() -> dict[str, Any]:
    with get_connection() as connection:
        rows = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_CRM_ETAPA
                WHERE Activo = 1
                ORDER BY Orden
                """
            )
        ).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def create_opportunity(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    if not company_id:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Company_Id es requerido"},
        )
    if not payload.get("NombreOportunidad"):
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "NombreOportunidad es requerido"},
        )
    _ensure_company_access(current_user, company_id)

    with get_transaction() as connection:
        etapa_id = int(payload["Etapa_Id"]) if payload.get("Etapa_Id") else None
        if not etapa_id:
            etapa = connection.execute(
                text(
                    """
                    SELECT TOP 1 Etapa_Id
                    FROM ERP_CRM_ETAPA
                    WHERE Activo = 1
                    ORDER BY Orden
                    """
                )
            ).mappings().first()
            etapa_id = int(etapa["Etapa_Id"]) if etapa else None

        if not etapa_id:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "No se encontro una etapa inicial para CRM",
                },
            )

        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_CRM_OPORTUNIDADES (
                    Company_Id,
                    Client_Id,
                    Etapa_Id,
                    NombreOportunidad,
                    MontoEstimado,
                    Moneda,
                    Probabilidad,
                    Origen,
                    FechaCierreEstimada,
                    Notas,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :client_id,
                    :etapa_id,
                    :nombre_oportunidad,
                    :monto_estimado,
                    :moneda,
                    :probabilidad,
                    :origen,
                    :fecha_cierre_estimada,
                    :notas,
                    :creado_por
                )
                """
            ),
            {
                "company_id": company_id,
                "client_id": int(payload["Client_Id"]) if payload.get("Client_Id") else None,
                "etapa_id": etapa_id,
                "nombre_oportunidad": payload.get("NombreOportunidad"),
                "monto_estimado": payload.get("MontoEstimado"),
                "moneda": payload.get("Moneda") or "MXN",
                "probabilidad": payload.get("Probabilidad"),
                "origen": payload.get("Origen"),
                "fecha_cierre_estimada": payload.get("FechaCierreEstimada"),
                "notas": payload.get("Notas"),
                "creado_por": _username(current_user),
            },
        ).mappings().first()

    opp_id = inserted["Opportunity_Id"] if inserted else None
    if opp_id:
        emit_background("crm:oportunidad:changed", {"opportunity_id": opp_id})
    return {"success": True, "data": dict(inserted) if inserted else None}


def list_opportunities(filters: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(filters["Company_Id"]) if filters.get("Company_Id") else None
    if company_id:
        _ensure_company_access(current_user, company_id)

    query = """
        SELECT
            o.*,
            e.Nombre AS EtapaNombre,
            c.LegalName AS ClientLegalName,
            c.CommercialName AS ClientCommercialName,
            c.RFC AS ClientRFC,
            v.Total AS VentaTotal,
            v.Status AS VentaStatus,
            cot.TOTAL AS CotizacionTotal
        FROM ERP_CRM_OPORTUNIDADES o
        LEFT JOIN ERP_CRM_ETAPA e ON o.Etapa_Id = e.Etapa_Id
        LEFT JOIN ERP_CLIENT c ON o.Client_Id = c.Client_Id
        LEFT JOIN ERP_VENTAS v ON o.Venta_Id = v.Venta_Id
        LEFT JOIN ERP_COTIZACIONES cot ON o.ID_COTIZACION = cot.ID_COTIZACION
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}

    if company_id:
        query += " AND o.Company_Id = :company_id"
        params["company_id"] = company_id
    elif not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        query += f" AND o.Company_Id IN ({clause})"
        params.update(clause_params)

    if filters.get("Etapa_Id"):
        query += " AND o.Etapa_Id = :etapa_id"
        params["etapa_id"] = int(filters["Etapa_Id"])
    if filters.get("Status"):
        query += " AND o.Status = :status"
        params["status"] = str(filters["Status"])
    if filters.get("Client_Id"):
        query += " AND o.Client_Id = :client_id"
        params["client_id"] = int(filters["Client_Id"])

    query += " ORDER BY o.FechaCreacion DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_opportunity_detail(opportunity_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        opportunity = connection.execute(
            text(
                """
                SELECT
                    o.*,
                    e.Nombre AS EtapaNombre,
                    e.Descripcion AS EtapaDescripcion,
                    c.LegalName AS ClientLegalName,
                    c.CommercialName AS ClientCommercialName,
                    c.RFC AS ClientRFC
                FROM ERP_CRM_OPORTUNIDADES o
                LEFT JOIN ERP_CRM_ETAPA e ON o.Etapa_Id = e.Etapa_Id
                LEFT JOIN ERP_CLIENT c ON o.Client_Id = c.Client_Id
                WHERE o.Oportunidad_Id = :oportunidad_id
                """
            ),
            {"oportunidad_id": opportunity_id},
        ).mappings().first()

        if not opportunity:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Oportunidad no encontrada"},
            )
        _ensure_company_access(current_user, int(opportunity["Company_Id"]))

        activity_rows = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_CRM_ACTIVIDADES
                WHERE Oportunidad_Id = :oportunidad_id
                ORDER BY FechaProgramada DESC, FechaCreacion DESC
                """
            ),
            {"oportunidad_id": opportunity_id},
        ).mappings().all()

    activities = [_parse_activity_products(dict(row)) for row in activity_rows]
    return {
        "success": True,
        "data": {
            "oportunidad": dict(opportunity),
            "actividades": activities,
        },
    }


def update_opportunity(
    opportunity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        opportunity = _ensure_opportunity_access(connection, opportunity_id, current_user)
        if payload.get("Company_Id") is not None:
            _ensure_company_access(current_user, int(payload["Company_Id"]))

        updated = connection.execute(
            text(
                """
                UPDATE ERP_CRM_OPORTUNIDADES
                SET
                    Company_Id = ISNULL(:company_id, Company_Id),
                    Client_Id = ISNULL(:client_id, Client_Id),
                    NombreOportunidad = ISNULL(:nombre_oportunidad, NombreOportunidad),
                    MontoEstimado = ISNULL(:monto_estimado, MontoEstimado),
                    Moneda = ISNULL(:moneda, Moneda),
                    Probabilidad = ISNULL(:probabilidad, Probabilidad),
                    Origen = ISNULL(:origen, Origen),
                    FechaCierreEstimada = ISNULL(:fecha_cierre_estimada, FechaCierreEstimada),
                    Notas = ISNULL(:notas, Notas),
                    Status = ISNULL(:status, Status),
                    ModificadoPor = :modificado_por,
                    FechaModificacion = GETDATE()
                OUTPUT INSERTED.*
                WHERE Oportunidad_Id = :oportunidad_id
                """
            ),
            {
                "oportunidad_id": opportunity_id,
                "company_id": int(payload["Company_Id"]) if payload.get("Company_Id") is not None else None,
                "client_id": int(payload["Client_Id"]) if payload.get("Client_Id") is not None else None,
                "nombre_oportunidad": payload.get("NombreOportunidad"),
                "monto_estimado": payload.get("MontoEstimado"),
                "moneda": payload.get("Moneda"),
                "probabilidad": payload.get("Probabilidad"),
                "origen": payload.get("Origen"),
                "fecha_cierre_estimada": payload.get("FechaCierreEstimada"),
                "notas": payload.get("Notas"),
                "status": payload.get("Status"),
                "modificado_por": _username(current_user),
            },
        ).mappings().first()

    if not updated:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Oportunidad no encontrada"},
        )
    emit_background("crm:oportunidad:changed", {"opportunity_id": opportunity_id})
    return {"success": True, "data": dict(updated)}


def change_opportunity_stage(
    opportunity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    etapa_id = int(payload.get("Etapa_Id") or 0)
    if not etapa_id:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Etapa_Id es requerido"},
        )

    with get_transaction() as connection:
        _ensure_opportunity_access(connection, opportunity_id, current_user)
        updated = connection.execute(
            text(
                """
                UPDATE ERP_CRM_OPORTUNIDADES
                SET
                    Etapa_Id = :etapa_id,
                    FechaModificacion = GETDATE(),
                    ModificadoPor = :modificado_por
                OUTPUT INSERTED.*
                WHERE Oportunidad_Id = :oportunidad_id
                """
            ),
            {
                "oportunidad_id": opportunity_id,
                "etapa_id": etapa_id,
                "modificado_por": _username(current_user),
            },
        ).mappings().first()

    if not updated:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Oportunidad no encontrada"},
        )
    emit_background("crm:oportunidad:changed", {"opportunity_id": opportunity_id})
    return {"success": True, "data": dict(updated)}


def close_opportunity(
    opportunity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    result_status = str(payload.get("Resultado") or "").strip()
    create_sale_from_quote = bool(payload.get("CrearVentaDesdeCotizacion", True))
    if result_status not in {"Ganada", "Perdida"}:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": 'Resultado debe ser "Ganada" o "Perdida"'},
        )

    with get_transaction() as connection:
        opportunity = _ensure_opportunity_access(connection, opportunity_id, current_user)

        current_status = str(opportunity.get("Status") or "")
        if current_status in {"Ganada", "Perdida"}:
            sale_label = f" (Venta #{opportunity['Venta_Id']})" if opportunity.get("Venta_Id") else ""
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": f"Esta oportunidad ya fue cerrada como {current_status}{sale_label}",
                },
            )

        nueva_venta_id = int(opportunity["Venta_Id"]) if opportunity.get("Venta_Id") else None
        detalles_cotizacion: list[dict[str, Any]] = []

        if result_status == "Perdida":
            closed = connection.execute(
                text(
                    """
                    UPDATE ERP_CRM_OPORTUNIDADES
                    SET
                        Status = :status,
                        FechaCierreReal = GETDATE(),
                        FechaModificacion = GETDATE()
                    OUTPUT INSERTED.*
                    WHERE Oportunidad_Id = :oportunidad_id
                    """
                ),
                {"status": result_status, "oportunidad_id": opportunity_id},
            ).mappings().first()
            return {
                "success": True,
                "data": {"oportunidad": dict(closed) if closed else None, "Venta_Id": None},
            }

        if create_sale_from_quote and not nueva_venta_id:
            if not opportunity.get("Client_Id"):
                raise ApiServiceError(
                    status_code=400,
                    content={
                        "success": False,
                        "message": (
                            "Para crear una venta, la oportunidad debe tener un cliente asignado. "
                            "Por favor, asigna un cliente antes de cerrar como Ganada."
                        ),
                    },
                )

            client = connection.execute(
                text(
                    """
                    SELECT TOP 1 LegalName, CommercialName, RFC
                    FROM ERP_CLIENT
                    WHERE Client_Id = :client_id
                    """
                ),
                {"client_id": int(opportunity["Client_Id"])},
            ).mappings().first()
            if not client:
                raise ApiServiceError(
                    status_code=400,
                    content={
                        "success": False,
                        "message": "Cliente no encontrado en la base de datos. Verifica que el cliente exista.",
                    },
                )

            subtotal = 0.0
            iva = 0.0
            total = 0.0

            if opportunity.get("ID_COTIZACION"):
                quote_rows = connection.execute(
                    text(
                        """
                        SELECT *
                        FROM ERP_COTIZACION_DETALLE
                        WHERE ID_COTIZACION = :cotizacion_id
                        """
                    ),
                    {"cotizacion_id": int(opportunity["ID_COTIZACION"])},
                ).mappings().all()
                detalles_cotizacion = [dict(row) for row in quote_rows]

                for detail in detalles_cotizacion:
                    sub = float(detail.get("SUBTOTAL") or 0)
                    detail_iva = sub * 0.16
                    subtotal += sub
                    iva += detail_iva
                    total += sub + detail_iva
            else:
                monto_base = float(opportunity.get("MontoEstimado") or 0)
                subtotal = monto_base / 1.16 if monto_base else 0.0
                iva = subtotal * 0.16
                total = monto_base

            status_id = 2 if detalles_cotizacion else 1
            status_name = "Completada" if detalles_cotizacion else "Pendiente"

            inserted_sale = connection.execute(
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
                        :status_id,
                        GETDATE(),
                        :status_name,
                        :cotizacion_id,
                        :client_id
                    )
                    """
                ),
                {
                    "company_id": int(opportunity["Company_Id"]),
                    "total": total,
                    "iva": iva,
                    "subtotal": subtotal,
                    "moneda": opportunity.get("Moneda") or "MXN",
                    "status_id": status_id,
                    "status_name": status_name,
                    "cotizacion_id": (
                        int(opportunity["ID_COTIZACION"]) if opportunity.get("ID_COTIZACION") else None
                    ),
                    "client_id": int(opportunity["Client_Id"]),
                },
            ).mappings().first()
            nueva_venta_id = int(inserted_sale["Venta_Id"]) if inserted_sale else None

            for detail in detalles_cotizacion:
                sub = float(detail.get("SUBTOTAL") or 0)
                detail_iva = sub * 0.16
                total_detail = sub + detail_iva
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
                            :venta_id,
                            :producto_id,
                            :cantidad,
                            :precio_unitario,
                            :subtotal,
                            :iva,
                            :total
                        )
                        """
                    ),
                    {
                        "venta_id": nueva_venta_id,
                        "producto_id": int(detail["ID_PRODUCTO"]),
                        "cantidad": detail.get("CANTIDAD"),
                        "precio_unitario": detail.get("PRECIO_UNITARIO"),
                        "subtotal": sub,
                        "iva": detail_iva,
                        "total": total_detail,
                    },
                )

        closed = connection.execute(
            text(
                """
                UPDATE ERP_CRM_OPORTUNIDADES
                SET
                    Status = :status,
                    Venta_Id = :venta_id,
                    FechaCierreReal = GETDATE(),
                    FechaModificacion = GETDATE()
                OUTPUT INSERTED.*
                WHERE Oportunidad_Id = :oportunidad_id
                """
            ),
            {
                "status": result_status,
                "venta_id": nueva_venta_id,
                "oportunidad_id": opportunity_id,
            },
        ).mappings().first()

    message = f"Oportunidad cerrada como {result_status}"
    if result_status == "Ganada" and nueva_venta_id:
        if detalles_cotizacion:
            message = (
                f"Oportunidad cerrada como Ganada. Venta #{nueva_venta_id} creada con "
                f"{len(detalles_cotizacion)} producto(s) de la cotizacion."
            )
        else:
            message = (
                f"Oportunidad cerrada como Ganada. Venta #{nueva_venta_id} creada en estado "
                "Pendiente. Agrega los productos manualmente desde el detalle de la venta."
            )

    return {
        "success": True,
        "message": message,
        "data": {"oportunidad": dict(closed) if closed else None, "Venta_Id": nueva_venta_id},
    }


def list_activities(opportunity_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_opportunity_access(connection, opportunity_id, current_user)
        rows = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_CRM_ACTIVIDADES
                WHERE Oportunidad_Id = :oportunidad_id
                ORDER BY FechaProgramada DESC, FechaCreacion DESC
                """
            ),
            {"oportunidad_id": opportunity_id},
        ).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def create_activity(
    opportunity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if not payload.get("Tipo"):
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Tipo es requerido"},
        )
    if not payload.get("Titulo"):
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Titulo es requerido"},
        )

    with get_transaction() as connection:
        _ensure_opportunity_access(connection, opportunity_id, current_user)
        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_CRM_ACTIVIDADES (
                    Oportunidad_Id,
                    Tipo,
                    Titulo,
                    Descripcion,
                    FechaProgramada,
                    FechaReal,
                    Resultado,
                    Usuario_Id,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :oportunidad_id,
                    :tipo,
                    :titulo,
                    :descripcion,
                    :fecha_programada,
                    :fecha_real,
                    :resultado,
                    :usuario_id,
                    :creado_por
                )
                """
            ),
            {
                "oportunidad_id": opportunity_id,
                "tipo": payload.get("Tipo"),
                "titulo": payload.get("Titulo"),
                "descripcion": payload.get("Descripcion"),
                "fecha_programada": payload.get("FechaProgramada"),
                "fecha_real": payload.get("FechaReal"),
                "resultado": payload.get("Resultado"),
                "usuario_id": int(payload["Usuario_Id"]) if payload.get("Usuario_Id") else None,
                "creado_por": _username(current_user),
            },
        ).mappings().first()

    act_opp = inserted.get("Oportunidad_Id") if inserted else None
    if act_opp:
        emit_background("crm:actividad:changed", {"opportunity_id": act_opp})
    return {"success": True, "data": dict(inserted) if inserted else None}


def complete_activity(
    activity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        activity = connection.execute(
            text(
                """
                SELECT a.*, o.Company_Id
                FROM ERP_CRM_ACTIVIDADES a
                INNER JOIN ERP_CRM_OPORTUNIDADES o ON a.Oportunidad_Id = o.Oportunidad_Id
                WHERE a.Actividad_Id = :actividad_id
                """
            ),
            {"actividad_id": activity_id},
        ).mappings().first()
        if not activity:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Actividad no encontrada"},
            )
        _ensure_company_access(current_user, int(activity["Company_Id"]))

        updated = connection.execute(
            text(
                """
                UPDATE ERP_CRM_ACTIVIDADES
                SET
                    Completada = 1,
                    FechaReal = ISNULL(:fecha_real, FechaReal),
                    Resultado = ISNULL(:resultado, Resultado)
                OUTPUT INSERTED.*
                WHERE Actividad_Id = :actividad_id
                """
            ),
            {
                "actividad_id": activity_id,
                "fecha_real": payload.get("FechaReal"),
                "resultado": payload.get("Resultado"),
            },
        ).mappings().first()

    if not updated:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Actividad no encontrada"},
        )
    opp_id = updated.get("Oportunidad_Id")
    if opp_id:
        emit_background("crm:actividad:changed", {"opportunity_id": opp_id})
    return {"success": True, "data": dict(updated)}


def delete_opportunity(opportunity_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        opportunity = _ensure_opportunity_access(connection, opportunity_id, current_user)
        if opportunity.get("Venta_Id"):
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": "No se puede eliminar una oportunidad que ya genero una venta",
                },
            )

        connection.execute(
            text(
                """
                DELETE FROM ERP_CRM_ACTIVIDADES
                WHERE Oportunidad_Id = :oportunidad_id
                """
            ),
            {"oportunidad_id": opportunity_id},
        )
        connection.execute(
            text(
                """
                DELETE FROM ERP_CRM_OPORTUNIDADES
                WHERE Oportunidad_Id = :oportunidad_id
                """
            ),
            {"oportunidad_id": opportunity_id},
        )

    emit_background("crm:oportunidad:changed", {"opportunity_id": opportunity_id})
    return {"success": True, "message": "Oportunidad eliminada correctamente"}


def send_activity_to_production(
    activity_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    products = payload.get("productos") or []
    if not isinstance(products, list) or not products:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "Debe proporcionar productos para enviar a produccion",
            },
        )

    with get_transaction() as connection:
        activity = connection.execute(
            text(
                """
                SELECT a.*, o.Company_Id, o.Client_Id
                FROM ERP_CRM_ACTIVIDADES a
                INNER JOIN ERP_CRM_OPORTUNIDADES o ON a.Oportunidad_Id = o.Oportunidad_Id
                WHERE a.Actividad_Id = :actividad_id
                """
            ),
            {"actividad_id": activity_id},
        ).mappings().first()
        if not activity:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Actividad no encontrada"},
            )
        _ensure_company_access(current_user, int(activity["Company_Id"]))

        ptc_company_id = _get_ptc_company_id(connection, int(activity["Company_Id"]))
        created_orders: list[dict[str, Any]] = []

        for product in products:
            inserted = connection.execute(
                text(
                    """
                    INSERT INTO ERP_OP_PRODUCCION (
                        NumeroOP,
                        Company_Id,
                        CompanySolicitante_Id,
                        Producto_Id,
                        BOM_Id,
                        CantidadPlanificada,
                        Estado,
                        Prioridad,
                        FechaCreacion
                    )
                    OUTPUT INSERTED.*
                    SELECT
                        'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' +
                        RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
                        :ptc_company_id,
                        :solicitante_company_id,
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
                        'NORMAL',
                        GETDATE()
                    """
                ),
                {
                    "ptc_company_id": ptc_company_id,
                    "solicitante_company_id": int(activity["Company_Id"]),
                    "producto_id": int(product["Producto_Id"]),
                    "cantidad_planificada": float(product["Cantidad"]),
                },
            ).mappings().first()
            if inserted:
                created_orders.append(dict(inserted))

        result_text = "Enviado a produccion: " + ", ".join(
            order["NumeroOP"] for order in created_orders if order.get("NumeroOP")
        )
        connection.execute(
            text(
                """
                UPDATE ERP_CRM_ACTIVIDADES
                SET
                    Completada = 1,
                    FechaReal = GETDATE(),
                    Resultado = :resultado
                WHERE Actividad_Id = :actividad_id
                """
            ),
            {"actividad_id": activity_id, "resultado": result_text},
        )

    return {
        "success": True,
        "message": "Ordenes de produccion creadas desde actividad",
        "data": created_orders,
    }


def get_historial_compras_cliente(cliente_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {"cliente_id": cliente_id}
    company_filter = ""

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        company_filter = f" AND v.Company_Id IN ({clause})"
        params.update(clause_params)

    with get_connection() as conn:
        rows = conn.execute(
            text(f"""
                SELECT
                    v.Venta_Id,
                    v.FechaVenta,
                    v.Total,
                    v.Status_Id,
                    vs.Status AS StatusNombre,
                    c.NameCompany,
                    COUNT(vd.Producto_Id) AS TotalProductos
                FROM ERP_VENTAS v
                JOIN ERP_VENTA_STATUS vs ON vs.Status_Id = v.Status_Id
                JOIN ERP_COMPANY c ON c.Company_Id = v.Company_Id
                LEFT JOIN ERP_VENTA_DETALLE vd ON vd.Venta_Id = v.Venta_Id
                WHERE v.Cliente_Id = :cliente_id{company_filter}
                GROUP BY v.Venta_Id, v.FechaVenta, v.Total, v.Status_Id, vs.Status, c.NameCompany
                ORDER BY v.FechaVenta DESC
            """),
            params,
        ).mappings().all()

    return {"success": True, "data": [dict(r) for r in rows]}


def get_forecast_por_etapa(current_user: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    company_filter = ""

    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return {"success": True, "data": []}
        clause, clause_params = build_in_clause("company", companies)
        company_filter = f" AND o.Company_Id IN ({clause})"
        params.update(clause_params)

    with get_connection() as conn:
        rows = conn.execute(
            text(f"""
                SELECT
                    e.Nombre AS Etapa,
                    e.Orden,
                    COUNT(o.Oportunidad_Id) AS TotalOportunidades,
                    SUM(ISNULL(o.ValorEstimado, 0)) AS ValorTotal,
                    AVG(ISNULL(o.Probabilidad, 0)) AS ProbabilidadPromedio,
                    SUM(ISNULL(o.ValorEstimado, 0) * ISNULL(o.Probabilidad, 0) / 100.0) AS ValorPonderado
                FROM ERP_CRM_ETAPAS e
                LEFT JOIN ERP_CRM_OPORTUNIDADES o
                    ON o.Etapa_Id = e.Etapa_Id
                    AND o.Status NOT IN ('Ganada', 'Perdida'){company_filter}
                GROUP BY e.Etapa_Id, e.Nombre, e.Orden
                ORDER BY e.Orden
            """),
            params,
        ).mappings().all()

    return {"success": True, "data": [dict(r) for r in rows]}


def vincular_cotizacion(oportunidad_id: int, cotizacion_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """Asocia una cotización existente a una oportunidad CRM."""
    with get_connection() as conn:
        opp = _load_opportunity(conn, oportunidad_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    _ensure_company_access(current_user, int(opp["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_CRM_OPORTUNIDADES
                SET ID_COTIZACION = :cot_id, FechaModificacion = GETDATE()
                WHERE Oportunidad_Id = :opp_id
                """
            ),
            {"cot_id": cotizacion_id, "opp_id": oportunidad_id},
        )
    return {"success": True, "message": "Cotización vinculada a la oportunidad"}


def marcar_ganada(oportunidad_id: int, venta_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """Marca la oportunidad como Ganada y registra la Venta_Id."""
    with get_connection() as conn:
        opp = _load_opportunity(conn, oportunidad_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    _ensure_company_access(current_user, int(opp["Company_Id"]))

    with get_transaction() as conn:
        conn.execute(
            text(
                """
                UPDATE ERP_CRM_OPORTUNIDADES
                SET Status = 'Ganada',
                    Venta_Id = :venta_id,
                    FechaCierreReal = GETDATE(),
                    FechaModificacion = GETDATE()
                WHERE Oportunidad_Id = :opp_id
                """
            ),
            {"venta_id": venta_id, "opp_id": oportunidad_id},
        )
    return {"success": True, "message": "Oportunidad marcada como Ganada"}
