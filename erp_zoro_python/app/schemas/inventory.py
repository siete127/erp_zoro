from __future__ import annotations

from pydantic import BaseModel, Field


class MPMachineEntryCreate(BaseModel):
    FechaRegistro: str
    TipoMaquina: str
    MateriaPrima_Id: int
    Almacen_Id: int | None = None
    Cantidad: float
    Observaciones: str | None = None


class InventoryRecepcionCreate(BaseModel):
    OP_Id: int
    Cantidad: float
    Almacen_Id: int | None = None
    Observaciones: str | None = None


class InventoryRecepcionCancel(BaseModel):
    OP_Id: int
    MotivoCancelacion: str


class InventoryConsolidadoUpdate(BaseModel):
    Producto_Id: int
    Company_Id: int
    Almacen_Id: int | None = None
    CantidadEnMaquina: float | None = None
    CantidadEntregadaProduccion: float | None = None
    CantidadEnProceso: float | None = None


class StockMPUpdate(BaseModel):
    MateriaPrima_Id: int
    Almacen_Id: int
    StockMinimo: float | None = 0


class InventoryMovementCreate(BaseModel):
    Producto_Id: int
    Almacen_Id: int | None = None
    TipoMovimiento: str
    Cantidad: float
    Referencia: str | None = None
    Company_Id: int | None = None
    ClasificacionInventario: str | None = None


class InventoryTransferDetail(BaseModel):
    Producto_Id: int
    Cantidad: float


class InventoryTransferCreate(BaseModel):
    Almacen_Origen_Id: int
    Almacen_Destino_Id: int
    Usuario: str | None = None
    Referencia: str | None = None
    Detalles: list[InventoryTransferDetail] = Field(default_factory=list)
