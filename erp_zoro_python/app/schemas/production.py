from __future__ import annotations

from pydantic import BaseModel, Field


class ProductionOrderCreate(BaseModel):
    Company_Id: int
    Venta_Id: int | None = None
    ID_COTIZACION: int | None = None
    Producto_Id: int
    CantidadPlanificada: float
    Prioridad: str | None = "NORMAL"
    FechaEntregaCompromiso: str | None = None


class ProductionOrderStatusUpdate(BaseModel):
    Estado: str


class ProductionOrderConfirmRequest(BaseModel):
    canProduce: bool
    Comentarios: str | None = None


class ProductionConsumptionInput(BaseModel):
    MateriaPrima_Id: int
    CantidadTeorica: float | None = 0
    CantidadReal: float | None = 0
    UnidadConsumo: str | None = "KG"


class ProductionOrderCloseRequest(BaseModel):
    consumos: list[ProductionConsumptionInput] = Field(default_factory=list)
    PiezasBuenas: float
    PiezasMerma: float | None = 0
    Comentarios: str | None = None
    OperadorCierre: str | None = None
    Almacen_Id: int | None = None
