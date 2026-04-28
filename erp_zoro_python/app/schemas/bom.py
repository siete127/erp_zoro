from __future__ import annotations

from pydantic import BaseModel, Field


class BomMaterialInput(BaseModel):
    MateriaPrima_Id: int
    CantidadTeorica: float | None = 0
    TipoComponente: str | None = "Principal"
    MermaPct: float | None = 0
    Notas: str | None = None


class BomOperationInput(BaseModel):
    TipoCosto: str | None = "MANO_OBRA"
    CostoPorUnidad: float | None = 0
    MinutosPorUnidad: float | None = 0
    CostoHoraReferencia: float | None = 0
    NombreOperacion: str | None = None
    Notas: str | None = None


class BomCreate(BaseModel):
    Producto_Id: int
    CodigoBOM: str | None = None
    Version: int | None = 1
    MermaPct: float | None = 0
    Descripcion: str | None = None
    materiales: list[BomMaterialInput] = Field(default_factory=list)
    operaciones: list[BomOperationInput] = Field(default_factory=list)


class BomUpdate(BaseModel):
    Producto_Id: int | None = None
    CodigoBOM: str | None = None
    Version: int | None = 1
    MermaPct: float | None = 0
    Descripcion: str | None = None
    Vigente: bool | None = True
    materiales: list[BomMaterialInput] | None = None
    operaciones: list[BomOperationInput] | None = None


class BomCloneRequest(BaseModel):
    nuevaVersion: int | None = None
