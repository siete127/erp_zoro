from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile

from app.api.deps import get_current_user
from app.schemas.purchase import (
    DirectPurchaseCreate,
    PurchaseAuthorizationRequest,
    PurchaseMarkBoughtRequest,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseReceiptCreate,
)
from app.services import purchase_service


router = APIRouter()


@router.get("/proveedores")
async def list_providers(
    Company_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.list_providers({"Company_Id": Company_Id}, current_user)


@router.get("/ordenes")
async def list_orders(
    Company_Id: int | None = Query(default=None),
    Estatus: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.list_purchase_orders(
        {"Company_Id": Company_Id, "Estatus": Estatus},
        current_user,
    )


@router.get("/ordenes/{order_id}")
async def get_order(order_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return purchase_service.get_purchase_order(order_id, current_user)


@router.post("/ordenes")
async def create_order(
    payload: PurchaseOrderCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.create_purchase_order(payload.model_dump(exclude_none=True), current_user)


@router.put("/ordenes/{order_id}")
async def update_order(
    order_id: int,
    payload: PurchaseOrderUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.update_purchase_order(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/ordenes/{order_id}/enviar-autorizacion")
async def send_authorization(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.send_purchase_authorization(order_id, current_user)


@router.post("/ordenes/{order_id}/autorizar")
async def authorize_order(
    order_id: int,
    payload: PurchaseAuthorizationRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.authorize_purchase_order(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/ordenes/{order_id}/comprar")
async def mark_bought(
    order_id: int,
    payload: PurchaseMarkBoughtRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.mark_purchase_order_bought(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/ordenes/{order_id}/factura")
async def upload_invoice(
    order_id: int,
    factura: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.upload_purchase_invoice(
        order_id,
        factura.filename or "",
        factura.content_type,
        await factura.read(),
        current_user,
    )


@router.post("/ordenes/{order_id}/recibir")
async def receive_goods(
    order_id: int,
    payload: PurchaseReceiptCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.receive_purchase_goods(
        order_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/ordenes/{order_id}/recepciones")
async def list_receipts(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.list_purchase_receipts(order_id, current_user)


@router.post("/ordenes/{order_id}/cancelar")
async def cancel_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.cancel_purchase_order(order_id, current_user)


@router.get("/ordenes/{order_id}/pdf")
async def get_order_pdf(
    order_id: int,
    current_user: dict = Depends(get_current_user),
) -> Response:
    pdf_file = purchase_service.get_purchase_order_pdf(order_id, current_user)
    return Response(
        content=pdf_file["content"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdf_file["filename"]}"'},
    )


@router.post("/registro-directo/analizar-hoja")
async def analyze_direct_sheet(
    hojaProveedor: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.analyze_supplier_sheet_direct(
        await hojaProveedor.read(),
        hojaProveedor.filename or "",
    )


@router.post("/registro-directo")
async def direct_purchase(
    payload: DirectPurchaseCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return purchase_service.direct_purchase_registration(
        payload.model_dump(exclude_none=True),
        current_user,
    )
