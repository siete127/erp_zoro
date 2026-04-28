from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import guia_service


router = APIRouter()


class GuiaCreate(BaseModel):
    fecha_salida: str | None = None
    transportista: str | None = None
    numero_guia: str | None = None
    status: str = "Pendiente"


class GuiaUpdate(BaseModel):
    fecha_salida: str | None = None
    transportista: str | None = None
    numero_guia: str | None = None
    status: str | None = None


@router.get("/ventas/{venta_id}/guias")
def list_guias(venta_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return guia_service.list_guias(venta_id, current_user)


@router.post("/ventas/{venta_id}/guias")
def create_guia(venta_id: int, payload: GuiaCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return guia_service.create_guia(venta_id, payload.model_dump(), current_user)


@router.put("/guias/{guia_id}")
def update_guia(guia_id: int, payload: GuiaUpdate, current_user: dict = Depends(get_current_user)) -> dict:
    return guia_service.update_guia(guia_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/guias/{guia_id}")
def delete_guia(guia_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return guia_service.delete_guia(guia_id, current_user)
