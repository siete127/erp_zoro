from __future__ import annotations

from pydantic import BaseModel, Field


class CrmOpportunityCreate(BaseModel):
    Company_Id: int
    Client_Id: int | None = None
    NombreOportunidad: str
    MontoEstimado: float | None = None
    Moneda: str | None = "MXN"
    Probabilidad: int | None = None
    Origen: str | None = None
    Etapa_Id: int | None = None
    FechaCierreEstimada: str | None = None
    Notas: str | None = None


class CrmOpportunityUpdate(BaseModel):
    Company_Id: int | None = None
    Client_Id: int | None = None
    NombreOportunidad: str | None = None
    MontoEstimado: float | None = None
    Moneda: str | None = None
    Probabilidad: int | None = None
    Origen: str | None = None
    FechaCierreEstimada: str | None = None
    Notas: str | None = None
    Status: str | None = None


class CrmOpportunityStageChange(BaseModel):
    Etapa_Id: int


class CrmOpportunityCloseRequest(BaseModel):
    Resultado: str
    CrearVentaDesdeCotizacion: bool | None = True


class CrmActivityCreate(BaseModel):
    Tipo: str
    Titulo: str
    Descripcion: str | None = None
    FechaProgramada: str | None = None
    FechaReal: str | None = None
    Resultado: str | None = None
    Usuario_Id: int | None = None


class CrmActivityComplete(BaseModel):
    FechaReal: str | None = None
    Resultado: str | None = None


class CrmProductionProduct(BaseModel):
    Producto_Id: int
    Cantidad: float


class CrmSendToProduction(BaseModel):
    productos: list[CrmProductionProduct] = Field(default_factory=list)
