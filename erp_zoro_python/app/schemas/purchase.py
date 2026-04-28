from __future__ import annotations

from pydantic import BaseModel, Field


class PurchaseItemInput(BaseModel):
    Producto_Id: int | None = None
    MateriaPrima_Id: int | None = None
    Descripcion: str | None = ""
    Cantidad: float
    PrecioCompra: float
    IVA: float | None = 16.0


class PurchaseOrderCreate(BaseModel):
    Company_Id: int
    Proveedor_Id: int
    Requisicion_Id: int | None = None
    FechaRequerida: str | None = None
    Moneda: str | None = "MXN"
    RequiereDobleAutorizacion: bool | None = True
    FacturaReferencia: str | None = None
    Observaciones: str | None = None
    items: list[PurchaseItemInput] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    Proveedor_Id: int
    FechaRequerida: str | None = None
    Moneda: str | None = "MXN"
    RequiereDobleAutorizacion: bool | None = True
    FacturaReferencia: str | None = None
    Observaciones: str | None = None
    items: list[PurchaseItemInput] = Field(default_factory=list)


class PurchaseAuthorizationRequest(BaseModel):
    Nivel: int
    Aprobado: bool
    Comentarios: str | None = None


class PurchaseMarkBoughtRequest(BaseModel):
    FacturaReferencia: str | None = None


class PurchaseReceiptItemInput(BaseModel):
    OC_Detalle_Id: int
    CantidadRecibida: float


class PurchaseReceiptCreate(BaseModel):
    Almacen_Id: int
    Observaciones: str | None = None
    items: list[PurchaseReceiptItemInput] = Field(default_factory=list)


class DirectPurchaseCreate(BaseModel):
    Company_Id: int
    Proveedor_Id: int
    FacturaReferencia: str
    Moneda: str | None = "MXN"
    Observaciones: str | None = None
    items: list[PurchaseItemInput] = Field(default_factory=list)
