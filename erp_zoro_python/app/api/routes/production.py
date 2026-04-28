from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.production import (
    ProductionOrderCloseRequest,
    ProductionOrderConfirmRequest,
    ProductionOrderCreate,
    ProductionOrderStatusUpdate,
)
from app.services import production_service


router = APIRouter()


@router.get("/ordenes")
def list_production_orders(
    Company_Id: int | None = Query(default=None),
    Estado: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.list_production_orders(
        {"Company_Id": Company_Id, "Estado": Estado},
        current_user,
    )


@router.get("/ordenes/{order_id}/preview-cierre")
def get_production_close_preview(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.get_production_close_preview(order_id, current_user)


@router.get("/ordenes/{order_id}")
def get_production_order_detail(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.get_production_order_detail(order_id, current_user)


@router.post("/ordenes")
def create_production_order(
    payload: ProductionOrderCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.create_production_order(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.put("/ordenes/{order_id}/estado")
def update_production_order_status(
    order_id: int,
    payload: ProductionOrderStatusUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.update_production_order_status(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/ordenes/{order_id}/confirm")
def confirm_production_order(
    order_id: int,
    payload: ProductionOrderConfirmRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.confirm_production_order(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/ordenes/{order_id}/cerrar")
def close_production_order(
    order_id: int,
    payload: ProductionOrderCloseRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return production_service.close_production_order(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )
