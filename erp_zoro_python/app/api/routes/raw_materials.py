from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.raw_material import RawMaterialCreate, RawMaterialUpdate
from app.services import raw_material_service


router = APIRouter()


@router.get("/")
def list_raw_materials(
    Activo: str | None = Query(default=None),
    Tipo: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return raw_material_service.list_raw_materials({"Activo": Activo, "Tipo": Tipo})


@router.get("/{raw_material_id}")
def get_raw_material_detail(
    raw_material_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return raw_material_service.get_raw_material_detail(raw_material_id)


@router.post("/")
def create_raw_material(
    payload: RawMaterialCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return raw_material_service.create_raw_material(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.put("/{raw_material_id}")
def update_raw_material(
    raw_material_id: int,
    payload: RawMaterialUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return raw_material_service.update_raw_material(
        raw_material_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.delete("/{raw_material_id}")
def delete_raw_material(
    raw_material_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return raw_material_service.delete_raw_material(raw_material_id)
