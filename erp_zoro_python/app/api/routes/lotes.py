from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import lote_service


router = APIRouter()


class LoteCreate(BaseModel):
    Company_Id: int
    Producto_Id: int
    NumeroLote: str
    NumeroSerie: str | None = None
    Almacen_Id: int | None = None
    FechaRecepcion: str | None = None
    FechaVencimiento: str | None = None
    CantidadInicial: float = 0
    Proveedor_Id: int | None = None
    Notas: str | None = None


class ConsumoLote(BaseModel):
    Cantidad: float
    Referencia: str | None = None
    Notas: str | None = None


@router.get("")
def list_lotes(
    company_id: int | None = Query(default=None),
    producto_id: int | None = Query(default=None),
    almacen_id: int | None = Query(default=None),
    solo_vencidos: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return lote_service.list_lotes(current_user, company_id, producto_id, almacen_id, solo_vencidos)


@router.post("")
def create_lote(payload: LoteCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return lote_service.create_lote(payload.model_dump(), current_user)


@router.get("/{lote_id}")
def get_lote(lote_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return lote_service.get_lote(lote_id, current_user)


@router.patch("/{lote_id}/consumir")
def consumir_lote(lote_id: int, payload: ConsumoLote, current_user: dict = Depends(get_current_user)) -> dict:
    return lote_service.consumir_lote(lote_id, payload.model_dump(), current_user)
