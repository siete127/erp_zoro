from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.price import PriceChangeApproveRequest, PriceChangeRequestCreate
from app.services import price_service


router = APIRouter()


@router.post("/solicitar")
def solicitar_cambio(
    payload: PriceChangeRequestCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return price_service.request_price_change(payload.model_dump(), current_user)


@router.post("/aprobar")
def aprobar_cambio(
    payload: PriceChangeApproveRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return price_service.approve_price_change(payload.model_dump(), current_user)


@router.get("/solicitudes")
def listar_solicitudes(current_user: dict = Depends(get_current_user)) -> list[dict]:
    return price_service.list_price_requests(current_user)


@router.delete("/solicitudes/{request_id}")
def eliminar_solicitud(
    request_id: int,
    _: dict = Depends(get_current_user),
) -> dict:
    return price_service.delete_price_request(request_id)
