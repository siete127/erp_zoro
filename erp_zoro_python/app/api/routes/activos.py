from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import activo_service


router = APIRouter()


class ActivoCreate(BaseModel):
    Company_Id: int
    Nombre: str
    Categoria: str | None = None
    NumeroSerie: str | None = None
    NumeroEconomico: str | None = None
    FechaAdquisicion: str
    ValorAdquisicion: float
    VidaUtilMeses: int
    MetodoDeprec: str = "LINEA_RECTA"
    ValorResidual: float = 0
    Estatus: str = "ACTIVO"
    Responsable_Id: int | None = None
    Almacen_Id: int | None = None
    Notas: str | None = None
    CuentaDeprec: str | None = None
    CuentaActivo: str | None = None


class ActivoUpdate(BaseModel):
    Nombre: str | None = None
    Categoria: str | None = None
    NumeroSerie: str | None = None
    NumeroEconomico: str | None = None
    FechaAdquisicion: str | None = None
    ValorAdquisicion: float | None = None
    VidaUtilMeses: int | None = None
    MetodoDeprec: str | None = None
    ValorResidual: float | None = None
    Estatus: str | None = None
    Responsable_Id: int | None = None
    Almacen_Id: int | None = None
    Notas: str | None = None
    CuentaDeprec: str | None = None
    CuentaActivo: str | None = None


class DepreciacionBody(BaseModel):
    Company_Id: int
    Periodo: str | None = None


@router.get("/")
def list_activos(
    company_id: int | None = Query(default=None),
    estatus: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return activo_service.list_activos(
        current_user,
        {"company_id": company_id, "estatus": estatus, "categoria": categoria},
    )


@router.get("/calcular-depreciacion")
def calcular_depreciacion(
    company_id: int = Query(...),
    periodo: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.calcular_depreciacion_mes(
        current_user,
        company_id=company_id,
        periodo=periodo,
    )


@router.post("/aplicar-depreciacion-mes")
def aplicar_depreciacion_mes(
    payload: DepreciacionBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.aplicar_depreciaciones_mes(
        current_user,
        company_id=payload.Company_Id,
        periodo=payload.Periodo,
    )


@router.get("/{activo_id}")
def get_activo(
    activo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.get_activo(activo_id, current_user)


@router.get("/{activo_id}/depreciaciones")
def list_depreciaciones(
    activo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.get_activo(activo_id, current_user)


@router.post("/")
def create_activo(
    payload: ActivoCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.create_activo(payload.model_dump(exclude_none=True), current_user)


@router.put("/{activo_id}")
def update_activo(
    activo_id: int,
    payload: ActivoUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.update_activo(activo_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/{activo_id}")
def delete_activo(
    activo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return activo_service.delete_activo(activo_id, current_user)
