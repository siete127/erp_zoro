from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FacturaCreate(BaseModel):
    Company_Id: int | None = None
    companyId: int | None = None
    Venta_Id: int | None = None
    saleId: int | None = None
    Receptor: dict[str, Any] | None = None
    Conceptos: list[dict[str, Any]] = Field(default_factory=list)
    items: list[dict[str, Any]] = Field(default_factory=list)
    FormaPago: str | None = "01"
    PaymentForm: str | None = None
    MetodoPago: str | None = "PUE"
    PaymentMethod: str | None = None
    Moneda: str | None = "MXN"
    Currency: str | None = None
    rfc: str | None = None
    nombre: str | None = None
    email: str | None = None
    UsoCFDI: str | None = "G03"
    CfdiUse: str | None = None
    FiscalRegime: str | None = None
    RegimenFiscalReceptor: str | None = None
    TaxZipCode: str | None = None
    CodigoPostalReceptor: str | None = None


class FacturaCancelRequest(BaseModel):
    motivo: str | None = "02"
    folioSustitucion: str | None = None
    uuidReplacement: str | None = None
