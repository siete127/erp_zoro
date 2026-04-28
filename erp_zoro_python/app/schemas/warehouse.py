from __future__ import annotations

from pydantic import BaseModel


class WarehouseCreate(BaseModel):
    Nombre: str
    Codigo: str
    Direccion: str | None = None
    Activo: bool = True
    Company_Id: int | None = None


class WarehouseUpdate(BaseModel):
    Nombre: str | None = None
    Codigo: str | None = None
    Direccion: str | None = None
    Activo: bool | None = None
    Company_Id: int | None = None
