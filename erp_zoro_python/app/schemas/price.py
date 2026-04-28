from __future__ import annotations

from pydantic import BaseModel


class PriceChangeRequestCreate(BaseModel):
    Producto_Id: int
    PrecioNuevo: float
    Motivo: str | None = None


class PriceChangeApproveRequest(BaseModel):
    Solicitud_Id: int
    CodigoAprobacion: str
