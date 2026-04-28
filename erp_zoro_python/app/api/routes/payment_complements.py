from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.payment_complement import PaymentComplementCreate
from app.services import payment_complement_service


router = APIRouter()


@router.post("/")
def create_payment_complement(
    payload: PaymentComplementCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return payment_complement_service.create_payment_complement(payload.model_dump(), current_user)


@router.post("/{complement_id}/timbrar")
def stamp_payment_complement(
    complement_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return payment_complement_service.stamp_payment_complement(complement_id, current_user)


@router.get("/")
def list_payment_complements(
    Factura_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return payment_complement_service.list_payment_complements(Factura_Id, current_user)


@router.get("/{complement_id}")
def get_payment_complement_detail(
    complement_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return payment_complement_service.get_payment_complement_detail(complement_id, current_user)
