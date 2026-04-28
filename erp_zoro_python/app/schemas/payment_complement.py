from __future__ import annotations

from pydantic import BaseModel, Field


class PaymentComplementFacturaInput(BaseModel):
    Factura_Id: int
    MontoPagado: float
    NumParcialidad: int | None = 1
    SaldoAnterior: float
    SaldoInsoluto: float


class PaymentComplementCreate(BaseModel):
    Company_Id: int
    FechaPago: str
    FormaPago: str
    Moneda: str | None = "MXN"
    Monto: float
    NumOperacion: str | None = None
    CtaOrdenante: str | None = None
    CtaBeneficiario: str | None = None
    facturas: list[PaymentComplementFacturaInput] = Field(default_factory=list)
