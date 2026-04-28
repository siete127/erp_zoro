from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection, get_transaction
from app.services import facturama_service, ledger_service
from app.utils.company_access import can_access_company


def create_payment_complement(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload["Company_Id"])
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="No tiene permisos para esta empresa")

    invoices = payload.get("facturas") or []
    if not invoices:
        raise HTTPException(status_code=400, detail="Debe relacionar al menos una factura")

    with get_transaction() as connection:
        complement = connection.execute(
            text(
                """
                INSERT INTO ERP_COMPLEMENTOS_PAGO (
                    Company_Id,
                    FechaPago,
                    FormaPago,
                    Moneda,
                    Monto,
                    NumOperacion,
                    CtaOrdenante,
                    CtaBeneficiario,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :company_id,
                    :fecha_pago,
                    :forma_pago,
                    :moneda,
                    :monto,
                    :num_operacion,
                    :cta_ordenante,
                    :cta_beneficiario,
                    :creado_por
                )
                """
            ),
            {
                "company_id": company_id,
                "fecha_pago": payload["FechaPago"],
                "forma_pago": payload["FormaPago"],
                "moneda": payload.get("Moneda") or "MXN",
                "monto": payload["Monto"],
                "num_operacion": payload.get("NumOperacion"),
                "cta_ordenante": payload.get("CtaOrdenante"),
                "cta_beneficiario": payload.get("CtaBeneficiario"),
                "creado_por": current_user.get("Username") or "sistema",
            },
        ).mappings().first()

        complement_id = int(complement["ComplementoPago_Id"])
        for factura in invoices:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_COMPLEMENTO_FACTURA (
                        ComplementoPago_Id,
                        Factura_Id,
                        MontoPagado,
                        NumParcialidad,
                        SaldoAnterior,
                        SaldoInsoluto
                    )
                    VALUES (
                        :complement_id,
                        :factura_id,
                        :monto_pagado,
                        :num_parcialidad,
                        :saldo_anterior,
                        :saldo_insoluto
                    )
                    """
                ),
                {
                    "complement_id": complement_id,
                    "factura_id": factura["Factura_Id"],
                    "monto_pagado": factura["MontoPagado"],
                    "num_parcialidad": factura.get("NumParcialidad") or 1,
                    "saldo_anterior": factura["SaldoAnterior"],
                    "saldo_insoluto": factura["SaldoInsoluto"],
                },
            )

        try:
            ledger_service.post_cobro_cliente(
                connection,
                complemento_id=complement_id,
                company_id=company_id,
                monto=float(complement.get("Monto") or 0),
                num_operacion=str(complement.get("NumOperacion") or "").strip() or None,
            )
        except Exception:
            pass

    return {
        "success": True,
        "message": "Complemento de pago creado. Procede a timbrar.",
        "data": dict(complement),
    }


def list_payment_complements(
    factura_id: int | None,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    query = """
        SELECT DISTINCT cp.*
        FROM ERP_COMPLEMENTOS_PAGO cp
    """
    params: dict[str, Any] = {}

    if factura_id:
        query += """
            INNER JOIN ERP_COMPLEMENTO_FACTURA cf ON cp.ComplementoPago_Id = cf.ComplementoPago_Id
            WHERE cf.Factura_Id = :factura_id
        """
        params["factura_id"] = factura_id
    else:
        query += " WHERE 1 = 1"

    if not current_user.get("is_admin"):
        allowed = [int(company_id) for company_id in current_user.get("companies") or []]
        if not allowed:
            return {"success": True, "data": []}
        placeholders = ", ".join(f":company_{idx}" for idx, _ in enumerate(allowed))
        query += f" AND cp.Company_Id IN ({placeholders})"
        for idx, company_id in enumerate(allowed):
            params[f"company_{idx}"] = company_id

    query += " ORDER BY cp.FechaCreacion DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_payment_complement_detail(
    complement_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_connection() as connection:
        complement = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_COMPLEMENTOS_PAGO
                WHERE ComplementoPago_Id = :complement_id
                """
            ),
            {"complement_id": complement_id},
        ).mappings().first()
        if not complement:
            raise HTTPException(status_code=404, detail="Complemento de pago no encontrado")
        if not can_access_company(current_user, int(complement["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para este complemento")

        invoices = connection.execute(
            text(
                """
                SELECT
                    cf.*,
                    f.Serie,
                    f.Folio,
                    f.UUID,
                    f.Total AS TotalFactura,
                    f.ReceptorNombre
                FROM ERP_COMPLEMENTO_FACTURA cf
                INNER JOIN ERP_FACTURAS f ON cf.Factura_Id = f.Factura_Id
                WHERE cf.ComplementoPago_Id = :complement_id
                """
            ),
            {"complement_id": complement_id},
        ).mappings().all()

    return {
        "success": True,
        "data": {
            "complemento": dict(complement),
            "facturas": [dict(row) for row in invoices],
        },
    }


def stamp_payment_complement(
    complement_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_connection() as connection:
        complement = connection.execute(
            text(
                """
                SELECT
                    cp.*,
                    c.RFC AS EmisorRFC,
                    c.LegalName AS EmisorNombre,
                    c.FiscalRegime,
                    c.TaxZipCode
                FROM ERP_COMPLEMENTOS_PAGO cp
                INNER JOIN ERP_COMPANY c ON cp.Company_Id = c.Company_Id
                WHERE cp.ComplementoPago_Id = :complement_id
                """
            ),
            {"complement_id": complement_id},
        ).mappings().first()

        if not complement:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Complemento de pago no encontrado"},
            )
        if not can_access_company(current_user, int(complement["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"success": False, "message": "No tiene permisos para este complemento"},
            )

        invoices = connection.execute(
            text(
                """
                SELECT
                    cf.*,
                    f.UUID,
                    f.Serie,
                    f.Folio,
                    f.Moneda AS MonedaDR,
                    f.ReceptorRFC,
                    f.ReceptorNombre,
                    cl.TaxRegime AS ReceptorFiscalRegime,
                    addr.PostalCode AS ReceptorTaxZipCode
                FROM ERP_COMPLEMENTO_FACTURA cf
                INNER JOIN ERP_FACTURAS f ON cf.Factura_Id = f.Factura_Id
                LEFT JOIN ERP_CLIENT cl ON f.ReceptorRFC = cl.RFC
                LEFT JOIN ERP_CLIENTADRESSES addr ON cl.Client_Id = addr.Client_Id AND addr.IsPrimary = 1
                WHERE cf.ComplementoPago_Id = :complement_id
                """
            ),
            {"complement_id": complement_id},
        ).mappings().all()

    if not invoices:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "El complemento no tiene facturas relacionadas"},
        )

    first_receiver = invoices[0]
    cfdi_data = {
        "CfdiType": "P",
        "NameId": "1",
        "ExpeditionPlace": complement.get("TaxZipCode") or "64000",
        "Issuer": {
            "FiscalRegime": facturama_service.normalize_fiscal_regime(complement.get("FiscalRegime")) or "601",
            "Rfc": complement.get("EmisorRFC"),
            "Name": complement.get("EmisorNombre"),
        },
        "Receiver": {
            "Rfc": first_receiver.get("ReceptorRFC"),
            "Name": first_receiver.get("ReceptorNombre"),
            "CfdiUse": "CP01",
            "FiscalRegime": facturama_service.normalize_fiscal_regime(first_receiver.get("ReceptorFiscalRegime")) or "616",
            "TaxZipCode": first_receiver.get("ReceptorTaxZipCode") or "64000",
        },
        "Complemento": {
            "Payments": [
                {
                    "Date": str(complement["FechaPago"]),
                    "PaymentForm": complement.get("FormaPago"),
                    "Currency": complement.get("Moneda") or "MXN",
                    "Amount": float(complement.get("Monto") or 0),
                    "RelatedDocuments": [
                        {
                            "Uuid": row.get("UUID"),
                            "Serie": row.get("Serie"),
                            "Folio": row.get("Folio"),
                            "Currency": row.get("MonedaDR") or "MXN",
                            "PaymentMethod": "PPD",
                            "PartialityNumber": int(row.get("NumParcialidad") or 1),
                            "PreviousBalanceAmount": float(row.get("SaldoAnterior") or 0),
                            "AmountPaid": float(row.get("MontoPagado") or 0),
                            "ImpSaldoInsoluto": float(row.get("SaldoInsoluto") or 0),
                        }
                        for row in invoices
                    ],
                }
            ]
        },
    }

    cfdi_result = facturama_service.crear_complemento_pago(cfdi_data, int(complement["Company_Id"]))
    uuid = (
        (((cfdi_result.get("Complement") or {}).get("TaxStamp") or {}).get("Uuid"))
        or cfdi_result.get("Id")
    )

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_COMPLEMENTOS_PAGO
                SET
                    UUID = :uuid,
                    FacturamaId = :facturama_id,
                    Serie = :serie,
                    Folio = :folio,
                    FechaTimbrado = GETDATE(),
                    Status = 'Vigente'
                WHERE ComplementoPago_Id = :complement_id
                """
            ),
            {
                "complement_id": complement_id,
                "uuid": uuid,
                "facturama_id": cfdi_result.get("Id"),
                "serie": cfdi_result.get("Serie"),
                "folio": str(cfdi_result.get("Folio") or ""),
            },
        )

    return {
        "success": True,
        "message": "Complemento de pago timbrado exitosamente",
        "data": cfdi_result,
    }
