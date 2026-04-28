from __future__ import annotations

from pydantic import BaseModel, Field


class SaleCreate(BaseModel):
    Company_Id: int
    Client_Id: int
    Moneda: str | None = "MXN"
    Status_Id: int | None = 1


class SaleProductInput(BaseModel):
    Producto_Id: int
    Cantidad: float
    PrecioUnitario: float


class SaleProductsAddRequest(BaseModel):
    Venta_Id: int
    productos: list[SaleProductInput] = Field(default_factory=list)


class SaleUpdate(BaseModel):
    Client_Id: int | None = None
    Moneda: str | None = None
    Status_Id: int | None = None


class SaleInvoiceRequest(BaseModel):
    UsoCFDI: str | None = "G03"
    FormaPago: str | None = "01"
    MetodoPago: str | None = "PUE"
    ReceptorNombre: str | None = None
    ReceptorRFC: str | None = None
    ReceptorFiscalRegime: str | None = None
    ReceptorTaxZipCode: str | None = None
    ReceptorEmail: str | None = None
    issuerCompanyId: int | None = None


class ProductionOrderInput(BaseModel):
    Producto_Id: int
    Cantidad: float


class ProductionOrdersCreate(BaseModel):
    Producto_Id: int | None = None
    Cantidad: float | None = None
    productos: list[ProductionOrderInput] = Field(default_factory=list)


class ProductionEntryCreate(BaseModel):
    OP_Id: int
    Almacen_Id: int
