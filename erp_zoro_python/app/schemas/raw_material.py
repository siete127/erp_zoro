from __future__ import annotations

from pydantic import BaseModel


class RawMaterialCreate(BaseModel):
    Codigo: str
    Nombre: str
    Descripcion: str | None = None
    Tipo: str
    UnidadCompra: str
    UnidadConsumo: str
    FactorConversion: float | None = 1
    Gramaje: float | None = None
    CostoUnitario: float | None = 0
    Moneda: str | None = "MXN"


class RawMaterialUpdate(BaseModel):
    Codigo: str | None = None
    Nombre: str | None = None
    Descripcion: str | None = None
    Tipo: str | None = None
    UnidadCompra: str | None = None
    UnidadConsumo: str | None = None
    FactorConversion: float | None = 1
    Gramaje: float | None = None
    CostoUnitario: float | None = 0
    Moneda: str | None = "MXN"
    Activo: bool | None = True
