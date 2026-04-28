from __future__ import annotations

import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection, get_transaction
from app.services import facturama_service, ledger_service
from app.utils.company_access import can_access_company


_CANCEL_REASON_DESCRIPTIONS = {
    "01": "Comprobante emitido con errores con relacion",
    "02": "Comprobante emitido con errores sin relacion",
    "03": "No se llevo a cabo la operacion",
    "04": "Operacion nominativa relacionada en factura global",
}


def _username(current_user: dict[str, Any]) -> str:
    return str(current_user.get("Username") or "sistema")


def _safe_number(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0


def _extract_tax_total(item: dict[str, Any]) -> float:
    total = 0.0
    taxes = item.get("Taxes")
    if isinstance(taxes, list):
        for tax in taxes:
            if isinstance(tax, dict):
                total += _safe_number(tax.get("Total") or tax.get("Importe"))

    impuestos = item.get("Impuestos")
    if isinstance(impuestos, dict):
        traslados = impuestos.get("Traslados") or []
        if isinstance(traslados, dict):
            traslados = [traslados]
        for tax in traslados:
            if isinstance(tax, dict):
                total += _safe_number(tax.get("Importe") or tax.get("Total"))

    return round(total, 2)


def calculate_concept_totals(conceptos: list[dict[str, Any]]) -> tuple[float, float, float]:
    subtotal = 0.0
    iva = 0.0
    total = 0.0

    for concept in conceptos:
        line_subtotal = _safe_number(concept.get("Importe") or concept.get("Subtotal"))
        if line_subtotal <= 0:
            quantity = _safe_number(concept.get("Cantidad") or concept.get("Quantity") or 1)
            unit_price = _safe_number(
                concept.get("ValorUnitario")
                or concept.get("UnitPrice")
                or concept.get("Price")
                or concept.get("Precio")
            )
            line_subtotal = round(quantity * unit_price, 2)

        line_iva = _extract_tax_total(concept)
        line_total = _safe_number(concept.get("Total")) or round(line_subtotal + line_iva, 2)

        subtotal += line_subtotal
        iva += line_iva
        total += line_total

    return round(subtotal, 2), round(iva, 2), round(total, 2)


def _extract_cfdi_identifiers(cfdi_result: dict[str, Any]) -> tuple[str, str]:
    complement = cfdi_result.get("Complement") or {}
    tax_stamp = complement.get("TaxStamp") if isinstance(complement, dict) else {}
    uuid = (
        str((tax_stamp or {}).get("Uuid") or cfdi_result.get("Uuid") or "")
        or f"TEMP-{time.time_ns()}"
    )
    facturama_id = str(cfdi_result.get("Id") or uuid)
    return uuid, facturama_id


def _extract_cfdi_totals(
    cfdi_result: dict[str, Any],
    *,
    default_totals: tuple[float, float, float] | None = None,
) -> tuple[float, float, float]:
    subtotal = _safe_number(
        cfdi_result.get("SubTotal")
        or cfdi_result.get("Subtotal")
        or cfdi_result.get("subTotal")
        or cfdi_result.get("subtotal")
    )
    iva = _safe_number(
        cfdi_result.get("Tax")
        or cfdi_result.get("IVA")
        or cfdi_result.get("Iva")
        or cfdi_result.get("tax")
    )
    total = _safe_number(cfdi_result.get("Total") or cfdi_result.get("total"))

    if default_totals and (subtotal <= 0 or total <= 0):
        subtotal = subtotal or default_totals[0]
        iva = iva or default_totals[1]
        total = total or default_totals[2]

    if total <= 0 and subtotal > 0:
        total = round(subtotal + iva, 2)

    return round(subtotal, 2), round(iva, 2), round(total, 2)


def persist_invoice_record(
    connection: Connection,
    *,
    sale_id: int | None,
    company_id: int,
    factura_payload: dict[str, Any],
    cfdi_result: dict[str, Any],
    metodo_pago: str,
    forma_pago: str,
    created_by: str,
    default_totals: tuple[float, float, float] | None = None,
) -> dict[str, Any]:
    uuid, facturama_id = _extract_cfdi_identifiers(cfdi_result)
    subtotal, iva, total = _extract_cfdi_totals(cfdi_result, default_totals=default_totals)

    existing = connection.execute(
        text(
            """
            SELECT TOP 1 Factura_Id
            FROM ERP_FACTURAS
            WHERE FacturamaId = :facturama_id OR UUID = :uuid
            """
        ),
        {"facturama_id": facturama_id, "uuid": uuid},
    ).mappings().first()

    factura_id = int(existing["Factura_Id"]) if existing else None
    if not factura_id and sale_id is not None:
        folio_value = cfdi_result.get("Folio")
        if folio_value is None:
            folio_db = None
        else:
            try:
                folio_db = int(str(folio_value).strip())
            except (TypeError, ValueError):
                folio_db = None

        inserted = connection.execute(
            text(
                """
                INSERT INTO ERP_FACTURAS (
                    Venta_Id,
                    Company_Id,
                    UUID,
                    FacturamaId,
                    Serie,
                    Folio,
                    EmisorRFC,
                    ReceptorRFC,
                    ReceptorNombre,
                    Subtotal,
                    IVA,
                    Total,
                    Moneda,
                    MetodoPago,
                    FormaPago,
                    Status,
                    FechaTimbrado,
                    CreadoPor,
                    FechaCreacion
                )
                OUTPUT INSERTED.Factura_Id
                VALUES (
                    :sale_id,
                    :company_id,
                    :uuid,
                    :facturama_id,
                    :serie,
                    :folio,
                    :emisor_rfc,
                    :receptor_rfc,
                    :receptor_nombre,
                    :subtotal,
                    :iva,
                    :total,
                    :moneda,
                    :metodo_pago,
                    :forma_pago,
                    'Vigente',
                    GETDATE(),
                    :created_by,
                    GETDATE()
                )
                """
            ),
            {
                "sale_id": sale_id,
                "company_id": company_id,
                "uuid": uuid,
                "facturama_id": facturama_id,
                "serie": cfdi_result.get("Serie"),
                "folio": folio_db,
                "emisor_rfc": (factura_payload.get("Issuer") or {}).get("Rfc"),
                "receptor_rfc": (factura_payload.get("Receiver") or {}).get("Rfc"),
                "receptor_nombre": (factura_payload.get("Receiver") or {}).get("Name"),
                "subtotal": subtotal,
                "iva": iva,
                "total": total,
                "moneda": factura_payload.get("Currency") or "MXN",
                "metodo_pago": metodo_pago,
                "forma_pago": forma_pago,
                "created_by": created_by,
            },
        ).first()
        factura_id = int(inserted[0]) if inserted else None

    if factura_id:
        ledger_service.post_factura_cliente(
            connection,
            factura_id=factura_id,
            company_id=company_id,
            subtotal=subtotal,
            iva=iva,
            total=total,
            sale_id=sale_id,
            facturama_id=facturama_id,
            receiver_rfc=(factura_payload.get("Receiver") or {}).get("Rfc"),
        )

    return {
        "Factura_Id": factura_id,
        "UUID": uuid,
        "FacturamaId": facturama_id,
        "Subtotal": subtotal,
        "IVA": iva,
        "Total": total,
    }


def create_invoice(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or payload.get("companyId") or 0)
    if company_id <= 0:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Debe enviar Company_Id valido"},
        )
    if not can_access_company(current_user, company_id):
        raise ApiServiceError(
            status_code=403,
            content={"success": False, "message": "No tiene permisos para facturar en esta empresa"},
        )

    conceptos = payload.get("Conceptos") or payload.get("items") or []
    if not conceptos:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Debe enviar al menos un concepto para facturar"},
        )

    cfdi_data = {
        "Receptor": payload.get("Receptor")
        or {
            "Rfc": payload.get("rfc"),
            "Nombre": payload.get("nombre"),
            "Email": payload.get("email"),
            "UsoCfdi": payload.get("UsoCFDI") or payload.get("CfdiUse") or "G03",
            "FiscalRegime": payload.get("FiscalRegime") or payload.get("RegimenFiscalReceptor"),
            "TaxZipCode": payload.get("TaxZipCode") or payload.get("CodigoPostalReceptor"),
        },
        "Conceptos": conceptos,
        "FormaPago": payload.get("FormaPago") or payload.get("PaymentForm") or "01",
        "MetodoPago": payload.get("MetodoPago") or payload.get("PaymentMethod") or "PUE",
        "Moneda": payload.get("Moneda") or payload.get("Currency") or "MXN",
    }

    factura_payload = facturama_service.build_factura_payload(cfdi_data, company_id)
    cfdi_result = facturama_service.timbrar_for_company(factura_payload, company_id)

    venta_id = payload.get("Venta_Id") or payload.get("saleId")
    try:
        with get_transaction() as connection:
            persist_invoice_record(
                connection,
                sale_id=int(venta_id) if venta_id is not None else None,
                company_id=company_id,
                factura_payload=factura_payload,
                cfdi_result=cfdi_result,
                metodo_pago=cfdi_data["MetodoPago"],
                forma_pago=cfdi_data["FormaPago"],
                created_by=_username(current_user),
                default_totals=calculate_concept_totals(list(conceptos)),
            )
    except ApiServiceError:
        raise
    except Exception:
        pass

    uuid, facturama_id = _extract_cfdi_identifiers(cfdi_result)
    return {
        "success": True,
        "uuid": uuid,
        "facturamaId": facturama_id,
        "data": cfdi_result,
    }


def force_cancel_invoice(factura_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        factura = connection.execute(
            text(
                """
                SELECT Factura_Id, Company_Id, Venta_Id, FacturamaId, UUID, Status
                FROM ERP_FACTURAS
                WHERE Factura_Id = :factura_id
                """
            ),
            {"factura_id": factura_id},
        ).mappings().first()

        if not factura:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Factura no encontrada"},
            )
        if not can_access_company(current_user, int(factura["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"success": False, "message": "No tiene permisos para cancelar esta factura"},
            )

        if str(factura.get("Status") or "").strip().lower() == "cancelada":
            return {
                "success": True,
                "message": "La factura ya estaba marcada como cancelada",
                "data": {"facturaId": factura_id},
            }

        connection.execute(
            text(
                """
                UPDATE ERP_FACTURAS
                SET Status = 'Cancelada', FechaCancelacion = GETDATE()
                WHERE Factura_Id = :factura_id
                """
            ),
            {"factura_id": factura_id},
        )

    return {
        "success": True,
        "message": "Factura marcada como cancelada (prueba)",
        "data": {"facturaId": factura_id},
    }


def cancel_invoice(
    factura_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    motivo = str(payload.get("motivo") or "02").strip()
    folio_sustitucion = (
        str(payload.get("folioSustitucion") or payload.get("uuidReplacement") or "").strip() or None
    )

    if motivo not in _CANCEL_REASON_DESCRIPTIONS:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "Motivo invalido. Use 01, 02, 03 o 04"},
        )
    if motivo == "01" and not folio_sustitucion:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "Para motivo 01 debe enviar folioSustitucion (UUID de reemplazo)",
            },
        )

    with get_transaction() as connection:
        factura = connection.execute(
            text(
                """
                SELECT Factura_Id, Company_Id, Venta_Id, FacturamaId, UUID, Status
                FROM ERP_FACTURAS
                WHERE Factura_Id = :factura_id
                """
            ),
            {"factura_id": factura_id},
        ).mappings().first()

        if not factura:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Factura no encontrada"},
            )
        if not can_access_company(current_user, int(factura["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"success": False, "message": "No tiene permisos para cancelar esta factura"},
            )

        if str(factura.get("Status") or "").strip().lower() == "cancelada":
            return {
                "success": True,
                "message": "La factura ya estaba cancelada",
                "data": {
                    "facturaId": factura_id,
                    "status": "Cancelada",
                },
            }

    candidates = [
        value
        for value in (str(payload_value).strip() for payload_value in (factura["FacturamaId"], factura["UUID"]))
        if value and not value.startswith("TEMP-")
    ]
    if not candidates:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "La factura no tiene un identificador valido en Facturama para cancelar",
            },
        )

    last_error: ApiServiceError | None = None
    cancel_result: dict[str, Any] | None = None
    for candidate in candidates:
        try:
            cancel_result = facturama_service.cancelar_cfdi(candidate, motivo, folio_sustitucion)
            break
        except ApiServiceError as exc:
            last_error = exc

    if cancel_result is None:
        if last_error is not None:
            raise last_error
        raise ApiServiceError(
            status_code=502,
            content={"success": False, "message": "No se pudo cancelar el CFDI en Facturama"},
        )

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_FACTURAS
                SET
                    Status = 'Cancelada',
                    FechaCancelacion = GETDATE(),
                    motivo_cancelacion_clave = :motivo,
                    motivo_cancelacion_descripcion = :descripcion
                WHERE Factura_Id = :factura_id
                """
            ),
            {
                "factura_id": factura_id,
                "motivo": motivo,
                "descripcion": _CANCEL_REASON_DESCRIPTIONS[motivo],
            },
        )

    return {
        "success": True,
        "message": "Factura cancelada correctamente",
        "data": {
            "facturaId": factura_id,
            "ventaId": factura["Venta_Id"],
            "status": "Cancelada",
            "facturama": cancel_result,
        },
    }
