from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate
from app.services import warehouse_service


class UbicacionCreate(BaseModel):
    pasillo: str
    estante: str
    posicion: str | None = None
    codigo: str | None = None


class UbicacionUpdate(BaseModel):
    pasillo: str | None = None
    estante: str | None = None
    posicion: str | None = None
    codigo: str | None = None
    activo: bool | None = None


router = APIRouter()


@router.get("/")
def list_warehouses(
    company_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return warehouse_service.list_warehouses(current_user, company_id)


@router.get("/{warehouse_id}")
def get_warehouse(
    warehouse_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return warehouse_service.get_warehouse(warehouse_id, current_user)


@router.post("/")
def create_warehouse(
    payload: WarehouseCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return warehouse_service.create_warehouse(payload.model_dump(), current_user)


@router.put("/{warehouse_id}")
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return warehouse_service.update_warehouse(
        warehouse_id,
        payload.model_dump(),
        current_user,
    )


@router.delete("/{warehouse_id}")
def delete_warehouse(
    warehouse_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return warehouse_service.delete_warehouse(warehouse_id, current_user)


@router.get("/{warehouse_id}/ubicaciones")
def list_ubicaciones(warehouse_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return warehouse_service.list_ubicaciones(warehouse_id, current_user)


@router.post("/{warehouse_id}/ubicaciones")
def create_ubicacion(warehouse_id: int, payload: UbicacionCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return warehouse_service.create_ubicacion(warehouse_id, payload.model_dump(), current_user)


@router.put("/ubicaciones/{ubicacion_id}")
def update_ubicacion(ubicacion_id: int, payload: UbicacionUpdate, current_user: dict = Depends(get_current_user)) -> dict:
    return warehouse_service.update_ubicacion(ubicacion_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/ubicaciones/{ubicacion_id}")
def delete_ubicacion(ubicacion_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return warehouse_service.delete_ubicacion(ubicacion_id, current_user)
