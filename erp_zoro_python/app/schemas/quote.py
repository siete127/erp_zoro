from __future__ import annotations

from pydantic import BaseModel, Field


class QuoteDetailInput(BaseModel):
    Producto_Id: int | None = None
    ID_PRODUCTO: int | None = None
    TipoProducto: str | None = None
    SKU: str | None = None
    Descripcion: str | None = None
    UnidadVenta: str | None = None
    Cantidad: float | None = None
    CANTIDAD: float | None = None
    PrecioUnitario: float | None = None
    PRECIO_UNITARIO: float | None = None
    DatosPTC: dict | None = None


class QuoteCreate(BaseModel):
    Company_Id: int
    EmpresaCodigo: str
    Client_Id: int | None = None
    Oportunidad_Id: int | None = None
    ClienteRFC: str | None = None
    ClienteNombre: str | None = None
    Moneda: str | None = "MXN"
    Vendedor: str | None = None
    CondicionesPago: str | None = None
    FechaVigencia: str | None = None
    ComentarioDescuento: str | None = None
    detalles: list[QuoteDetailInput] = Field(default_factory=list)
    OverrideMargen: bool = False


class QuoteApproveRequest(BaseModel):
    OverrideMargen: bool = False
    ComentarioDescuento: str | None = None
