from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, require_admin
from app.schemas.factura import FacturaCancelRequest, FacturaCreate
from app.services import factura_service


router = APIRouter()


@router.post("/facturar")
def facturar(
    payload: FacturaCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return factura_service.create_invoice(payload.model_dump(), current_user)


@router.post("/facturas/{factura_id}/cancelar")
def cancelar_factura(
    factura_id: int,
    payload: FacturaCancelRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return factura_service.cancel_invoice(factura_id, payload.model_dump(), current_user)


@router.post("/facturas/{factura_id}/force-cancel")
def force_cancel_factura(
    factura_id: int,
    current_user: dict = Depends(require_admin),
) -> dict:
    return factura_service.force_cancel_invoice(factura_id, current_user)
