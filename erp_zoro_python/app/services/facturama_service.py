from __future__ import annotations

import base64
import json
import os
import time
from typing import Any

import httpx
from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection


_TIMEOUT = httpx.Timeout(20.0, connect=20.0)


def _clean_value(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _safe_number(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return number if number == number else 0.0


def normalize_fiscal_regime(value: Any) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized:
        return None
    if normalized.isdigit() and len(normalized) == 3:
        return normalized

    lookup = {
        "general de ley personas morales": "601",
        "regimen general de ley personas morales": "601",
        "regimen general": "601",
        "personas morales con fines no lucrativos": "603",
        "sueldos y salarios e ingresos asimilados a salarios": "605",
        "arrendamiento": "606",
        "regimen de enajenacion o adquisicion de bienes": "607",
        "demas ingresos": "608",
        "consolidacion": "609",
        "residentes en el extranjero sin establecimiento permanente en mexico": "610",
        "ingresos por dividendos": "611",
        "personas fisicas con actividades empresariales y profesionales": "612",
        "ingresos por intereses": "614",
        "regimen de los ingresos por obtencion de premios": "615",
        "sin obligaciones fiscales": "616",
        "sociedades cooperativas de produccion": "620",
        "incorporacion fiscal": "621",
        "actividades agricolas, ganaderas, silvicolas y pesqueras": "622",
        "opcional para grupos de sociedades": "623",
        "coordinados": "624",
        "regimen de actividades empresariales con ingresos a traves de plataformas tecnologicas": "625",
        "regimen simplificado de confianza": "626",
    }

    key = (
        normalized.lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ü", "u")
        .replace("ñ", "n")
    )
    for text_key, code in lookup.items():
        if text_key in key:
            return code

    for token in key.replace(",", " ").split():
        if token.isdigit() and len(token) == 3:
            return token
    return None


def _base_url() -> str:
    value = _clean_value(os.getenv("FACTURAMA_BASE_URL"))
    if not value:
        raise ApiServiceError(
            status_code=500,
            content={
                "success": False,
                "message": "FACTURAMA_BASE_URL no esta configurado en el entorno Python.",
            },
        )
    return value.rstrip("/")


def _global_auth_base64() -> str:
    user = _clean_value(os.getenv("FACTURAMA_USER"))
    password = _clean_value(os.getenv("FACTURAMA_PASSWORD"))
    if not user or not password:
        raise ApiServiceError(
            status_code=500,
            content={
                "success": False,
                "message": "FACTURAMA_USER y FACTURAMA_PASSWORD son requeridos para facturar.",
            },
        )
    return base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")


def _json_headers(auth_base64: str | None = None) -> dict[str, str]:
    return {
        "Authorization": f"Basic {auth_base64 or _global_auth_base64()}",
        "Content-Type": "application/json",
    }


def _basic_headers(auth_base64: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Basic {auth_base64 or _global_auth_base64()}"}


def _response_payload(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        text_value = response.text.strip()
        return text_value or None


def _extract_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        for key in ("Message", "message", "detail"):
            value = payload.get(key)
            if value:
                return str(value)
    if isinstance(payload, str) and payload.strip():
        return payload.strip()
    return fallback


def _facturama_status_code(remote_status: int | None) -> int:
    if remote_status in {400, 401, 403, 404, 409, 422}:
        return 400
    if remote_status and remote_status >= 500:
        return 502
    return 500


def _raise_facturama_error(response: httpx.Response, fallback: str) -> None:
    payload = _response_payload(response)
    message = _extract_message(payload, fallback)
    raise ApiServiceError(
        status_code=_facturama_status_code(response.status_code),
        content={
            "success": False,
            "message": message,
            "error": payload,
        },
    )


def _normalize_receiver(receiver: dict[str, Any], fallback_email: str | None = None) -> dict[str, Any]:
    normalized = {
        "Rfc": _clean_value(receiver.get("Rfc") or receiver.get("RFC")),
        "Name": _clean_value(receiver.get("Name") or receiver.get("Nombre")),
        "CfdiUse": _clean_value(receiver.get("CfdiUse") or receiver.get("UsoCfdi")) or "G03",
        "Email": _clean_value(receiver.get("Email")) or fallback_email,
        "FiscalRegime": normalize_fiscal_regime(
            receiver.get("FiscalRegime") or receiver.get("RegimenFiscal")
        ),
        "TaxZipCode": _clean_value(receiver.get("TaxZipCode") or receiver.get("CodigoPostal")),
    }

    missing = [key for key in ("Rfc", "Name", "FiscalRegime", "TaxZipCode") if not normalized[key]]
    if missing:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": (
                    "El receptor no esta completo para facturar. "
                    f"Faltan: {', '.join(missing)}"
                ),
            },
        )

    return normalized


def get_emisor_data(company_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        columns = connection.execute(
            text(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ERP_COMPANY'
                """
            )
        ).scalars().all()

        existing = {str(column).lower() for column in columns}
        select_columns = []
        for column in (
            "RFC",
            "LegalName",
            "FiscalRegime",
            "TaxZipCode",
            "CsdCargado",
            "Email",
            "FacturamaUser",
            "FacturamaPassword",
            "CsdPassword",
        ):
            if column.lower() in existing:
                select_columns.append(column)

        select_clause = ", ".join(select_columns) if select_columns else "*"
        row = connection.execute(
            text(f"SELECT {select_clause} FROM ERP_COMPANY WHERE Company_Id = :company_id"),
            {"company_id": company_id},
        ).mappings().first()

    if not row:
        raise ApiServiceError(
            status_code=404,
            content={"success": False, "message": "Empresa no encontrada"},
        )

    return {
        "Rfc": row.get("RFC"),
        "Name": row.get("LegalName"),
        "FiscalRegime": row.get("FiscalRegime"),
        "TaxZipCode": row.get("TaxZipCode"),
        "CsdCargado": bool(row.get("CsdCargado")),
        "Email": row.get("Email"),
        "FacturamaUser": row.get("FacturamaUser"),
        "FacturamaPassword": row.get("FacturamaPassword"),
        "CsdPassword": row.get("CsdPassword"),
    }


def get_company_facturacion_status(company_id: int) -> dict[str, Any]:
    emisor = get_emisor_data(company_id)
    missing_fields = []
    warnings = []

    if not _clean_value(emisor.get("Rfc")):
        missing_fields.append("RFC")
    if not _clean_value(emisor.get("Name")):
        missing_fields.append("LegalName")
    if not normalize_fiscal_regime(emisor.get("FiscalRegime")):
        missing_fields.append("FiscalRegime")
    if not _clean_value(emisor.get("TaxZipCode")):
        missing_fields.append("TaxZipCode")
    if not emisor.get("CsdCargado"):
        warnings.append("La empresa no tiene CSD marcado como cargado en ERP_COMPANY")

    return {
        "companyId": int(company_id),
        "sandbox": "sandbox" in _base_url().lower(),
        "canInvoice": not missing_fields,
        "missingFields": missing_fields,
        "warnings": warnings,
        "emisor": emisor,
    }


def build_factura_payload(cfdi_data: dict[str, Any], company_id: int) -> dict[str, Any]:
    status = get_company_facturacion_status(company_id)
    if not status["canInvoice"]:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": (
                    "La empresa no esta lista para facturar. "
                    f"Faltan: {', '.join(status['missingFields'])}"
                ),
                "warnings": status["warnings"],
            },
        )

    emisor = status["emisor"]
    receiver = _normalize_receiver(
        cfdi_data.get("Receptor") or {},
        fallback_email=_clean_value(emisor.get("Email")),
    )
    payment_method = _clean_value(cfdi_data.get("MetodoPago") or cfdi_data.get("PaymentMethod")) or "PUE"
    incoming_payment_form = _clean_value(cfdi_data.get("FormaPago") or cfdi_data.get("PaymentForm"))
    payment_form = "99" if payment_method.upper() == "PPD" else incoming_payment_form or "01"

    items = []
    for item in cfdi_data.get("Conceptos") or cfdi_data.get("Items") or []:
        taxes = []
        traslados = ((item.get("Impuestos") or {}).get("Traslados") if isinstance(item.get("Impuestos"), dict) else None) or item.get("Taxes") or []
        if isinstance(traslados, dict):
            traslados = [traslados]
        tax_row = traslados[0] if traslados else None

        subtotal = _safe_number(item.get("Importe") or item.get("Subtotal"))
        tax_total = _safe_number(
            tax_row.get("Importe") if isinstance(tax_row, dict) else 0
        ) or _safe_number(tax_row.get("Total") if isinstance(tax_row, dict) else 0)
        tax_base = _safe_number(
            tax_row.get("Base") if isinstance(tax_row, dict) else subtotal
        ) or subtotal
        tax_rate = _safe_number(
            tax_row.get("TasaOCuota") if isinstance(tax_row, dict) else 0
        ) or _safe_number(tax_row.get("Rate") if isinstance(tax_row, dict) else 0.16) or 0.16
        if tax_total <= 0 and tax_base > 0:
            tax_total = round(tax_base * tax_rate, 2)

        if tax_base > 0:
            taxes.append(
                {
                    "Name": "IVA",
                    "IsRetention": False,
                    "Base": tax_base,
                    "Rate": tax_rate,
                    "Total": tax_total,
                    "Type": "Federal",
                }
            )

        items.append(
            {
                "ProductCode": item.get("ClaveProdServ") or item.get("ProductCode") or "01010101",
                "UnitCode": item.get("ClaveUnidad") or item.get("UnitCode") or "E48",
                "Unit": item.get("Unidad") or item.get("Unit") or "Pieza",
                "Description": item.get("Descripcion") or item.get("Description") or "Concepto",
                "Quantity": _safe_number(item.get("Cantidad") or item.get("Quantity")),
                "UnitPrice": _safe_number(item.get("ValorUnitario") or item.get("UnitPrice")),
                "Subtotal": subtotal,
                "TaxObject": "02",
                "Total": round(subtotal + tax_total, 2),
                "Taxes": taxes,
            }
        )

    return {
        "Issuer": {
            "Rfc": _clean_value(emisor.get("Rfc")),
            "Name": _clean_value(emisor.get("Name")),
            "FiscalRegime": normalize_fiscal_regime(emisor.get("FiscalRegime")),
        },
        "Folio": _clean_value(cfdi_data.get("Folio")) or str(int(time.time() * 1000))[-8:],
        "CfdiType": cfdi_data.get("CfdiType") or "I",
        "NameId": _clean_value(cfdi_data.get("NameId")) or "1",
        "ExpeditionPlace": _clean_value(cfdi_data.get("ExpeditionPlace")) or _clean_value(emisor.get("TaxZipCode")),
        "PaymentMethod": payment_method,
        "PaymentForm": payment_form,
        "Currency": _clean_value(cfdi_data.get("Moneda") or cfdi_data.get("Currency")) or "MXN",
        "Receiver": receiver,
        "Items": items,
    }


def _company_auth_base64(company_id: int) -> str | None:
    env_user = None
    env_password = None
    for key in (f"FACTURAMA_USER_COMPANY_{company_id}", f"FACTURAMA_USER_{company_id}"):
        if _clean_value(os.getenv(key)):
            env_user = _clean_value(os.getenv(key))
            break
    for key in (f"FACTURAMA_PASSWORD_COMPANY_{company_id}", f"FACTURAMA_PASSWORD_{company_id}"):
        if _clean_value(os.getenv(key)):
            env_password = _clean_value(os.getenv(key))
            break

    if env_user and env_password:
        return base64.b64encode(f"{env_user}:{env_password}".encode("utf-8")).decode("ascii")

    try:
        emisor = get_emisor_data(company_id)
    except ApiServiceError:
        return None

    company_user = _clean_value(emisor.get("FacturamaUser"))
    company_password = _clean_value(emisor.get("FacturamaPassword"))
    if company_user and company_password:
        return base64.b64encode(f"{company_user}:{company_password}".encode("utf-8")).decode("ascii")
    return None


def timbrar_multiemisor(cfdi_body: dict[str, Any], auth_base64: str | None = None) -> dict[str, Any]:
    url = f"{_base_url()}/api-lite/3/cfdis"
    with httpx.Client(timeout=_TIMEOUT) as client:
        response = client.post(url, json=cfdi_body, headers=_json_headers(auth_base64))

    if not response.is_success:
        _raise_facturama_error(response, "Error al timbrar en Facturama")
    payload = _response_payload(response)
    return payload if isinstance(payload, dict) else {"raw": payload}


def timbrar_for_company(cfdi_body: dict[str, Any], company_id: int) -> dict[str, Any]:
    return timbrar_multiemisor(cfdi_body, auth_base64=_company_auth_base64(company_id))


def crear_nota_credito(cfdi_data: dict[str, Any], company_id: int) -> dict[str, Any]:
    return timbrar_for_company(cfdi_data, company_id)


def crear_complemento_pago(cfdi_data: dict[str, Any], company_id: int) -> dict[str, Any]:
    return timbrar_for_company(cfdi_data, company_id)


def _as_pdf_bytes(raw_data: bytes) -> bytes:
    stripped = raw_data.strip()
    if stripped.startswith(b"{") or stripped.startswith(b"["):
        try:
            parsed = json.loads(stripped.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return raw_data
        if isinstance(parsed, dict) and parsed.get("Content"):
            return base64.b64decode(parsed["Content"])
        return raw_data
    return raw_data


def descargar_pdf(cfdi_id: str) -> bytes:
    endpoints = [
        f"{_base_url()}/cfdi/pdf/issuedLite/{cfdi_id}",
        f"{_base_url()}/api-lite/cfdi/pdf/issuedLite/{cfdi_id}",
    ]
    last_response: httpx.Response | None = None

    with httpx.Client(timeout=_TIMEOUT) as client:
        for url in endpoints:
            response = client.get(url, headers=_basic_headers())
            if response.is_success:
                return _as_pdf_bytes(response.content)
            last_response = response

    if last_response is not None:
        _raise_facturama_error(last_response, "Error al descargar PDF en Facturama")

    raise ApiServiceError(
        status_code=502,
        content={"success": False, "message": "No se pudo descargar el PDF en Facturama"},
    )


def descargar_xml(cfdi_id: str) -> bytes:
    endpoints = [
        f"{_base_url()}/cfdi/xml/issuedLite/{cfdi_id}",
        f"{_base_url()}/api-lite/cfdi/xml/issuedLite/{cfdi_id}",
    ]
    last_response: httpx.Response | None = None

    with httpx.Client(timeout=_TIMEOUT) as client:
        for url in endpoints:
            response = client.get(url, headers=_basic_headers())
            if response.is_success:
                # La respuesta puede venir como JSON con campo "Content" en base64 o como XML directo
                raw = response.content.strip()
                if raw.startswith(b"{"):
                    try:
                        parsed = json.loads(raw.decode("utf-8"))
                        if isinstance(parsed, dict) and parsed.get("Content"):
                            return base64.b64decode(parsed["Content"])
                    except (ValueError, UnicodeDecodeError):
                        pass
                return raw
            last_response = response

    if last_response is not None:
        _raise_facturama_error(last_response, "Error al descargar XML en Facturama")

    raise ApiServiceError(
        status_code=502,
        content={"success": False, "message": "No se pudo descargar el XML en Facturama"},
    )


def listar_csds(auth_b64: str | None = None) -> list[dict[str, Any]]:
    headers = _basic_headers() if auth_b64 is None else {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json",
    }
    endpoints = [
        f"{_base_url()}/api-lite/csds",
        f"{_base_url()}/csds",
    ]
    with httpx.Client(timeout=_TIMEOUT) as client:
        for url in endpoints:
            response = client.get(url, headers=headers)
            if response.is_success:
                payload = _response_payload(response)
                if isinstance(payload, list):
                    return payload
                if isinstance(payload, dict):
                    return payload.get("data") or payload.get("Data") or [payload]
                return []
    return []


def subir_csd(
    cer_b64: str,
    key_b64: str,
    pwd: str,
    rfc: str,
    auth_b64: str | None = None,
) -> dict[str, Any]:
    headers = _basic_headers() if auth_b64 is None else {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json",
    }
    body = {
        "Rfc": rfc,
        "Certificate": cer_b64,
        "PrivateKey": key_b64,
        "PrivateKeyPassword": pwd,
    }
    endpoints = [
        f"{_base_url()}/api-lite/csds",
        f"{_base_url()}/csds",
    ]
    last_response: httpx.Response | None = None
    with httpx.Client(timeout=_TIMEOUT) as client:
        for url in endpoints:
            response = client.post(url, headers=headers, json=body)
            if response.is_success:
                payload = _response_payload(response)
                return payload if isinstance(payload, dict) else {"raw": payload}
            last_response = response

    if last_response is not None:
        _raise_facturama_error(last_response, "Error al subir CSD en Facturama")

    raise ApiServiceError(
        status_code=502,
        content={"success": False, "message": "No se pudo subir el CSD en Facturama"},
    )


def eliminar_csd(rfc: str, auth_b64: str | None = None) -> dict[str, Any]:
    headers = _basic_headers() if auth_b64 is None else {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json",
    }
    endpoints = [
        f"{_base_url()}/api-lite/csds/{rfc}",
        f"{_base_url()}/csds/{rfc}",
    ]
    last_response: httpx.Response | None = None
    with httpx.Client(timeout=_TIMEOUT) as client:
        for url in endpoints:
            response = client.delete(url, headers=headers)
            if response.is_success:
                try:
                    payload = _response_payload(response)
                    return payload if isinstance(payload, dict) else {"success": True}
                except Exception:
                    return {"success": True}
            last_response = response

    if last_response is not None:
        _raise_facturama_error(last_response, "Error al eliminar CSD en Facturama")

    raise ApiServiceError(
        status_code=502,
        content={"success": False, "message": "No se pudo eliminar el CSD en Facturama"},
    )


def _is_transient_status(status_code: int | None) -> bool:
    return status_code == 429 or bool(status_code and 500 <= status_code < 600)


def cancelar_cfdi(
    facturama_id: str,
    motivo: str = "02",
    folio_sustitucion: str | None = None,
) -> dict[str, Any]:
    if not facturama_id or str(facturama_id).startswith("TEMP-"):
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": "La factura no tiene un identificador valido en Facturama para cancelar.",
            },
        )

    params = {"motive": motivo}
    if folio_sustitucion:
        params["uuidReplacement"] = folio_sustitucion

    get_endpoints = [
        f"{_base_url()}/api-lite/cfdis/{facturama_id}",
        f"{_base_url()}/api-lite/3/cfdis/{facturama_id}",
        f"{_base_url()}/api/Cfdi/{facturama_id}",
    ]
    delete_endpoints = list(get_endpoints)
    sandbox = "sandbox" in _base_url().lower()

    with httpx.Client(timeout=_TIMEOUT) as client:
        resource_found = sandbox
        for url in get_endpoints:
            response = client.get(url, headers=_basic_headers())
            if response.is_success:
                resource_found = True
                break
            if response.status_code == 404 and sandbox:
                resource_found = True
                break
            if _is_transient_status(response.status_code):
                time.sleep(0.5)

        if not resource_found:
            raise ApiServiceError(
                status_code=400,
                content={
                    "success": False,
                    "message": f"CFDI no encontrado en Facturama para id: {facturama_id}",
                },
            )

        last_response: httpx.Response | None = None
        for url in delete_endpoints:
            for _ in range(3):
                response = client.delete(url, headers=_basic_headers(), params=params)
                if response.is_success:
                    payload = _response_payload(response)
                    return payload if isinstance(payload, dict) else {"raw": payload}
                last_response = response
                if not _is_transient_status(response.status_code):
                    break
                time.sleep(0.75)

    if last_response is not None:
        _raise_facturama_error(last_response, "No se pudo cancelar el CFDI en Facturama")

    raise ApiServiceError(
        status_code=502,
        content={"success": False, "message": "No se pudo cancelar el CFDI en Facturama"},
    )
