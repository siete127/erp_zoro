from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.bom import BomCloneRequest, BomCreate, BomUpdate
from app.services import bom_service


router = APIRouter()


@router.get("/materias-primas")
def list_bom_raw_materials(
    Company_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.list_available_raw_materials()


@router.delete("/operaciones/{operation_id}")
def delete_bom_operation(
    operation_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.delete_bom_operation(operation_id)


@router.get("/")
def list_bom(
    Producto_Id: int | None = Query(default=None),
    Vigente: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.list_bom({"Producto_Id": Producto_Id, "Vigente": Vigente})


@router.get("/{bom_id}/variacion-costos")
def get_bom_cost_variation(
    bom_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.get_bom_cost_variation(bom_id)


@router.get("/{bom_id}")
def get_bom_detail(
    bom_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.get_bom_detail(bom_id)


@router.post("/")
def create_bom(
    payload: BomCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.create_bom(payload.model_dump(exclude_none=True), current_user)


@router.put("/{bom_id}")
def update_bom(
    bom_id: int,
    payload: BomUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.update_bom(
        bom_id,
        payload.model_dump(exclude_none=True),
    )


@router.delete("/{bom_id}")
def delete_bom(
    bom_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.delete_bom(bom_id)


@router.post("/{bom_id}/clonar")
def clone_bom(
    bom_id: int,
    payload: BomCloneRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return bom_service.clone_bom(
        bom_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )
