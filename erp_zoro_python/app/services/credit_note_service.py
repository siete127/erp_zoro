from __future__ import annotations

import time
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.exceptions import ApiServiceError
from app.db.session import get_connection, get_transaction
from app.services import facturama_service
from app.utils.company_access import can_access_company


def create_credit_note(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    factura_id = int(payload["Factura_Id"])
    products = payload.get("productos") or []
    if not products:
        raise HTTPException(status_code=400, detail="Debe indicar productos para la nota de credito")

    with get_transaction() as connection:
        factura = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_FACTURAS
                WHERE Factura_Id = :factura_id
                """
            ),
            {"factura_id": factura_id},
        ).mappings().first()
        if not factura:
            raise HTTPException(status_code=404, detail="Factura no encontrada")
        if not can_access_company(current_user, int(factura["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta factura")

        subtotal = sum(float(item["Subtotal"]) for item in products)
        iva = sum(float(item["IVA"]) for item in products)
        total = sum(float(item["Total"]) for item in products)

        nota = connection.execute(
            text(
                """
                INSERT INTO ERP_NOTAS_CREDITO (
                    Factura_Id,
                    Company_Id,
                    Motivo,
                    Subtotal,
                    IVA,
                    Total,
                    Moneda,
                    CreadoPor
                )
                OUTPUT INSERTED.*
                VALUES (
                    :factura_id,
                    :company_id,
                    :motivo,
                    :subtotal,
                    :iva,
                    :total,
                    :moneda,
                    :creado_por
                )
                """
            ),
            {
                "factura_id": factura_id,
                "company_id": factura["Company_Id"],
                "motivo": payload["Motivo"],
                "subtotal": subtotal,
                "iva": iva,
                "total": total,
                "moneda": factura.get("Moneda"),
                "creado_por": current_user.get("Username") or "sistema",
            },
        ).mappings().first()

        note_id = int(nota["NotaCredito_Id"])
        for product in products:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_NOTA_CREDITO_DETALLE (
                        NotaCredito_Id,
                        Producto_Id,
                        Descripcion,
                        Cantidad,
                        PrecioUnitario,
                        Subtotal,
                        IVA,
                        Total
                    )
                    VALUES (
                        :note_id,
                        :product_id,
                        :descripcion,
                        :cantidad,
                        :precio_unitario,
                        :subtotal,
                        :iva,
                        :total
                    )
                    """
                ),
                {
                    "note_id": note_id,
                    "product_id": product.get("Producto_Id"),
                    "descripcion": product["Descripcion"],
                    "cantidad": product["Cantidad"],
                    "precio_unitario": product["PrecioUnitario"],
                    "subtotal": product["Subtotal"],
                    "iva": product["IVA"],
                    "total": product["Total"],
                },
            )

    return {
        "success": True,
        "message": "Nota de credito creada. Procede a timbrar.",
        "data": dict(nota),
    }


def list_credit_notes(factura_id: int | None, current_user: dict[str, Any]) -> dict[str, Any]:
    query = """
        SELECT
            nc.*,
            f.Serie AS FacturaSerie,
            f.Folio AS FacturaFolio,
            f.ReceptorNombre,
            f.Total AS FacturaTotal
        FROM ERP_NOTAS_CREDITO nc
        LEFT JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
        WHERE 1 = 1
    """
    params: dict[str, Any] = {}
    if factura_id:
        query += " AND nc.Factura_Id = :factura_id"
        params["factura_id"] = factura_id

    if not current_user.get("is_admin"):
        allowed = [int(company_id) for company_id in current_user.get("companies") or []]
        if not allowed:
            return {"success": True, "data": []}
        placeholders = ", ".join(f":company_{idx}" for idx, _ in enumerate(allowed))
        query += f" AND nc.Company_Id IN ({placeholders})"
        for idx, company_id in enumerate(allowed):
            params[f"company_{idx}"] = company_id

    query += " ORDER BY nc.FechaCreacion DESC"

    with get_connection() as connection:
        rows = connection.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(row) for row in rows]}


def get_credit_note_detail(note_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        note = connection.execute(
            text(
                """
                SELECT
                    nc.*,
                    f.Serie AS FacturaSerie,
                    f.Folio AS FacturaFolio,
                    f.UUID AS FacturaUUID,
                    f.ReceptorNombre,
                    f.ReceptorRFC
                FROM ERP_NOTAS_CREDITO nc
                INNER JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
                WHERE nc.NotaCredito_Id = :note_id
                """
            ),
            {"note_id": note_id},
        ).mappings().first()

        if not note:
            raise HTTPException(status_code=404, detail="Nota de credito no encontrada")
        if not can_access_company(current_user, int(note["Company_Id"])):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta nota de credito")

        detail = connection.execute(
            text(
                "SELECT * FROM ERP_NOTA_CREDITO_DETALLE WHERE NotaCredito_Id = :note_id"
            ),
            {"note_id": note_id},
        ).mappings().all()

    return {"success": True, "data": {"nota": dict(note), "detalle": [dict(row) for row in detail]}}


def get_invoice_products(factura_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        rows = connection.execute(
            text(
                """
                SELECT
                    vd.*,
                    p.Nombre AS ProductoNombre,
                    p.SKU
                FROM ERP_FACTURAS f
                INNER JOIN ERP_VENTA_DETALLE vd ON f.Venta_Id = vd.Venta_Id
                LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
                WHERE f.Factura_Id = :factura_id
                """
            ),
            {"factura_id": factura_id},
        ).mappings().all()

        if rows:
            factura = connection.execute(
                text("SELECT Company_Id FROM ERP_FACTURAS WHERE Factura_Id = :factura_id"),
                {"factura_id": factura_id},
            ).mappings().first()
            if factura and not can_access_company(current_user, int(factura["Company_Id"])):
                raise HTTPException(status_code=403, detail="No tiene permisos para esta factura")

    return {"success": True, "data": [dict(row) for row in rows]}


def stamp_credit_note(
    note_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_connection() as connection:
        note = connection.execute(
            text(
                """
                SELECT
                    nc.*,
                    f.UUID AS FacturaUUID,
                    f.ReceptorRFC,
                    f.ReceptorNombre,
                    f.FormaPago,
                    f.MetodoPago,
                    c.RFC AS EmisorRFC,
                    c.LegalName AS EmisorNombre,
                    cl.TaxRegime AS ReceptorFiscalRegime,
                    addr.PostalCode AS ReceptorTaxZipCode,
                    cl.Client_Id AS ReceptorClientId
                FROM ERP_NOTAS_CREDITO nc
                INNER JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
                INNER JOIN ERP_COMPANY c ON nc.Company_Id = c.Company_Id
                LEFT JOIN ERP_CLIENT cl ON f.ReceptorRFC = cl.RFC
                LEFT JOIN ERP_CLIENTADRESSES addr ON cl.Client_Id = addr.Client_Id AND addr.IsPrimary = 1
                WHERE nc.NotaCredito_Id = :note_id
                """
            ),
            {"note_id": note_id},
        ).mappings().first()

        if not note:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Nota de credito no encontrada"},
            )
        if not can_access_company(current_user, int(note["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"success": False, "message": "No tiene permisos para esta nota de credito"},
            )

        detail_rows = connection.execute(
            text(
                """
                SELECT *
                FROM ERP_NOTA_CREDITO_DETALLE
                WHERE NotaCredito_Id = :note_id
                """
            ),
            {"note_id": note_id},
        ).mappings().all()

    if not detail_rows:
        raise ApiServiceError(
            status_code=400,
            content={"success": False, "message": "La nota de credito no tiene conceptos para timbrar"},
        )

    emisor = facturama_service.get_emisor_data(int(note["Company_Id"]))
    receptor_fiscal = facturama_service.normalize_fiscal_regime(note.get("ReceptorFiscalRegime"))
    receptor_rfc = str(note.get("ReceptorRFC") or "").strip()
    if not receptor_fiscal:
        raise ApiServiceError(
            status_code=400,
            content={
                "success": False,
                "message": (
                    "El receptor no tiene regimen fiscal configurado. "
                    "Actualice el campo TaxRegime en ERP_CLIENT antes de timbrar."
                ),
                "receptor": {"Rfc": receptor_rfc, "Name": note.get("ReceptorNombre")},
            },
        )

    cfdi_data = {
        "Folio": note.get("Folio") or str(time.time_ns())[-8:],
        "CfdiType": "E",
        "NameId": "1",
        "ExpeditionPlace": emisor.get("TaxZipCode") or note.get("ReceptorTaxZipCode") or "64000",
        "Issuer": {
            "FiscalRegime": facturama_service.normalize_fiscal_regime(emisor.get("FiscalRegime")) or "601",
            "Rfc": emisor.get("Rfc") or note.get("EmisorRFC"),
            "Name": emisor.get("Name") or note.get("EmisorNombre"),
        },
        "Receiver": {
            "Rfc": receptor_rfc,
            "Name": note.get("ReceptorNombre"),
            "CfdiUse": note.get("ReceptorUsoCfdi") or "G03",
            "FiscalRegime": receptor_fiscal,
            "TaxZipCode": note.get("ReceptorTaxZipCode") or "64000",
        },
        "PaymentForm": payload.get("PaymentForm") or note.get("FormaPago") or "01",
        "PaymentMethod": payload.get("PaymentMethod") or note.get("MetodoPago") or "PUE",
        "Items": [
            {
                "ProductCode": "01010101",
                "UnitCode": "E48",
                "Unit": "Pieza",
                "Description": row.get("Descripcion"),
                "Quantity": float(row.get("Cantidad") or 0),
                "UnitPrice": float(row.get("PrecioUnitario") or 0),
                "Subtotal": float(row.get("Subtotal") or 0),
                "TaxObject": "02",
                "Total": round(float(row.get("Subtotal") or 0) + float(row.get("IVA") or 0), 2),
                "Taxes": [
                    {
                        "Name": "IVA",
                        "Rate": 0.16,
                        "Base": float(row.get("Subtotal") or 0),
                        "Total": float(row.get("IVA") or 0),
                        "IsRetention": False,
                        "Type": "Federal",
                    }
                ],
            }
            for row in detail_rows
        ],
        "Relations": {"Type": "01", "Cfdis": [{"Uuid": note["FacturaUUID"]}]},
    }

    cfdi_result = facturama_service.crear_nota_credito(cfdi_data, int(note["Company_Id"]))
    uuid = (
        (((cfdi_result.get("Complement") or {}).get("TaxStamp") or {}).get("Uuid"))
        or cfdi_result.get("Id")
    )

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_NOTAS_CREDITO
                SET
                    UUID = :uuid,
                    FacturamaId = :facturama_id,
                    Serie = :serie,
                    Folio = :folio,
                    FechaTimbrado = GETDATE(),
                    Status = 'Vigente'
                WHERE NotaCredito_Id = :note_id
                """
            ),
            {
                "note_id": note_id,
                "uuid": uuid,
                "facturama_id": cfdi_result.get("Id"),
                "serie": cfdi_result.get("Serie"),
                "folio": str(cfdi_result.get("Folio") or note.get("Folio") or ""),
            },
        )

    return {
        "success": True,
        "message": "Nota de credito timbrada exitosamente",
        "data": cfdi_result,
    }


def download_credit_note_pdf(note_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        note = connection.execute(
            text(
                """
                SELECT NotaCredito_Id, UUID, FacturamaId, Company_Id
                FROM ERP_NOTAS_CREDITO
                WHERE NotaCredito_Id = :note_id
                """
            ),
            {"note_id": note_id},
        ).mappings().first()

        if not note:
            raise ApiServiceError(
                status_code=404,
                content={"success": False, "message": "Nota de credito no encontrada"},
            )
        if not can_access_company(current_user, int(note["Company_Id"])):
            raise ApiServiceError(
                status_code=403,
                content={"success": False, "message": "No tiene permisos para esta nota de credito"},
            )

        cfdi_id = str(note.get("FacturamaId") or note.get("UUID") or "").strip()
        if not cfdi_id:
            raise ApiServiceError(
                status_code=400,
                content={"success": False, "message": "La nota de credito no esta timbrada aun"},
            )

    return {
        "filename": f"nota_credito_{note_id}.pdf",
        "content": facturama_service.descargar_pdf(cfdi_id),
    }
