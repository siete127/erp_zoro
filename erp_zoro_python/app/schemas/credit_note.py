from __future__ import annotations

from pydantic import BaseModel, Field


class CreditNoteDetailInput(BaseModel):
    Producto_Id: int | None = None
    Descripcion: str
    Cantidad: float
    PrecioUnitario: float
    Subtotal: float
    IVA: float
    Total: float


class CreditNoteCreate(BaseModel):
    Factura_Id: int
    Motivo: str
    productos: list[CreditNoteDetailInput] = Field(default_factory=list)


class CreditNoteStampRequest(BaseModel):
    PaymentForm: str | None = None
    PaymentMethod: str | None = None
