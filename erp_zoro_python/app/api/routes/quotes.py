from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.quote import QuoteApproveRequest, QuoteCreate
from app.services import quote_service


router = APIRouter()


@router.post("/")
def create_quote(
    payload: QuoteCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return quote_service.create_quote(payload.model_dump(), current_user)


@router.get("/")
def list_quotes(
    Company_Id: int | None = Query(default=None),
    Client_Id: int | None = Query(default=None),
    Status: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return quote_service.list_quotes(current_user, Company_Id, Client_Id, Status)


@router.get("/{quote_id}")
def get_quote_detail(
    quote_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return quote_service.get_quote_detail(quote_id, current_user)


@router.post("/{quote_id}/aprobar")
def approve_quote(
    quote_id: int,
    payload: QuoteApproveRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return quote_service.approve_quote(quote_id, payload.model_dump(), current_user)


@router.post("/{quote_id}/confirmar-pedido")
def confirm_order_from_quote(
    quote_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return quote_service.confirm_order_from_quote(quote_id, current_user)
