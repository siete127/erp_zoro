from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.services import client_pricing_service as svc

router = APIRouter()


class PriceChangeRequest(BaseModel):
    clientId: int
    productId: int
    newPrice: float
    approver1Email: str
    approver2Email: str
    reason: Optional[str] = None
    saleId: Optional[int] = None


class MultiPriceChangeRequest(BaseModel):
    clientId: int
    products: list
    approver1Email: str
    approver2Email: str
    reason: Optional[str] = None
    saleId: Optional[int] = None


@router.get("/client/{client_id}/prices")
@router.get("/client/{client_id}")
def get_client_prices(client_id: int, current_user: dict = Depends(get_current_user)):
    return {"success": True, "data": svc.get_client_prices(client_id)}


@router.post("/price-change-request")
def create_request(body: PriceChangeRequest, current_user: dict = Depends(get_current_user)):
    return svc.create_price_change_request(body.model_dump(), current_user.get("User_Id"))


@router.post("/multi-price-change-request")
@router.post("/price-change-request/multi")
def create_multi_request(body: MultiPriceChangeRequest, current_user: dict = Depends(get_current_user)):
    return svc.create_multi_price_change_request(body.model_dump(), current_user.get("User_Id"))


@router.get("/price-change-request/{request_id}/approve", response_class=HTMLResponse)
def approve_get(request_id: int, approverEmail: str, action: str):
    return _handle_approval(request_id, approverEmail, action)


@router.post("/price-change-request/{request_id}/approve", response_class=HTMLResponse)
async def approve_post(request_id: int, request: Request):
    body = await request.json()
    return _handle_approval(request_id, body.get("approverEmail", ""), body.get("action", ""))


def _handle_approval(request_id: int, approver_email: str, action: str) -> str:
    if not approver_email or not action:
        return "<html><body style='text-align:center;padding:40px'><h2>Parámetros faltantes</h2></body></html>"

    result = svc.approve_price_change(request_id, approver_email, action)

    if result.get("found") is False:
        return "<html><body style='text-align:center;padding:40px'><h2>Solicitud no encontrada</h2></body></html>"
    if result.get("already_processed"):
        return f"<html><body style='text-align:center;padding:40px'><h2>Esta solicitud ya fue procesada</h2><p>Estado: {result.get('estado')}</p></body></html>"
    if result.get("unauthorized"):
        return f"<html><body style='text-align:center;padding:40px'><h2>No autorizado</h2><p>El email no está autorizado para esta solicitud.</p></body></html>"
    if result.get("action") == "rejected":
        return f"<html><body style='text-align:center;padding:40px'><h1 style='color:#ef4444'>Solicitud Rechazada</h1><p>La solicitud #{request_id} ha sido rechazada.</p></body></html>"
    if result.get("action") == "completed":
        return "<html><body style='text-align:center;padding:40px'><h1 style='color:#10b981'>Precios Actualizados</h1><p>Todos los cambios de precio han sido aplicados correctamente.</p></body></html>"

    num = result.get("approverNumber", "")
    act_label = "aprobado" if action == "approve" else "rechazado"
    return f"<html><body style='text-align:center;padding:40px'><h1 style='color:#3b82f6'>Aprobación registrada</h1><p>Aprobador {num} ha {act_label} la solicitud.</p><p>Esperando la segunda aprobación...</p></body></html>"


@router.get("/price-change-request/{request_id}/status")
def get_status(request_id: int, current_user: dict = Depends(get_current_user)):
    return svc.get_price_request_status(request_id)


@router.get("/price-change-requests/pending")
@router.get("/pending-requests")
def get_pending(current_user: dict = Depends(get_current_user)):
    return {"success": True, "data": svc.get_pending_requests()}


@router.get("/sale/{sale_id}/pending-requests")
def check_sale_pending(sale_id: int, current_user: dict = Depends(get_current_user)):
    return svc.check_sale_pending_requests(sale_id)
