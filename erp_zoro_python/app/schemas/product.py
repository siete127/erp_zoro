from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ProductInventoryConfig(BaseModel):
    Company_Id: int
    Almacen_Id: int | None = None
    ClasificacionInventario: str | None = None
    Activo: bool = True


class ProductCreate(BaseModel):
    SKU: str
    Nombre: str
    Descripcion: str | None = None
    Precio: float | None = 0
    TipoMoneda: str | None = None
    ClaveProdServSAT: str
    ClaveUnidadSAT: str
    ImpuestoIVA: float | None = 16.0
    Activo: bool = True
    companies: list[int] = Field(default_factory=list)
    inventoryConfig: list[ProductInventoryConfig] | None = None
    Company_Id: int | None = None
    company_id: int | None = None
    Almacen_Id: int | None = None
    ClasificacionInventario: str | None = None
    ConfiguracionInventarioActiva: bool | None = True


class ProductUpdate(BaseModel):
    Nombre: str | None = None
    Descripcion: str | None = None
    Precio: float | None = None
    TipoMoneda: str | None = None
    ClaveProdServSAT: str | None = None
    ClaveUnidadSAT: str | None = None
    ImpuestoIVA: float | None = None
    Activo: bool | None = None
    companies: list[int] | None = None
    inventoryConfig: list[ProductInventoryConfig] | None = None
    Company_Id: int | None = None
    company_id: int | None = None
    Almacen_Id: int | None = None
    ClasificacionInventario: str | None = None
    ConfiguracionInventarioActiva: bool | None = True


class ProductImportResult(BaseModel):
    msg: str
    detail: str
