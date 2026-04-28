from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_current_user
from app.schemas.sale import (
    ProductionEntryCreate,
    ProductionOrdersCreate,
    SaleCreate,
    SaleInvoiceRequest,
    SaleProductsAddRequest,
    SaleUpdate,
)
from app.services import sale_service


router = APIRouter()


@router.get("/resumen/por-empresa")
def resumen_por_empresa(current_user: dict = Depends(get_current_user)) -> dict:
    return sale_service.sales_summary_by_company(current_user)


@router.get("/dashboard/kpis")
def get_dashboard_kpis(current_user: dict = Depends(get_current_user)) -> dict:
    return sale_service.get_dashboard_kpis(current_user)


@router.post("/")
def create_sale(
    payload: SaleCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.create_sale(payload.model_dump(), current_user)


@router.get("/")
def list_sales(
    Company_Id: int | None = Query(default=None),
    Status_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.list_sales(current_user, Company_Id, Status_Id)


@router.get("/status")
def get_sale_status() -> dict:
    return sale_service.get_sale_statuses()


@router.post("/entrada-produccion")
def registrar_entrada_produccion(
    payload: ProductionEntryCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.register_production_entry(payload.model_dump(), current_user)


@router.get("/{sale_id}/rentabilidad")
def get_rentabilidad(sale_id: int, current_user: dict = Depends(get_current_user)):
    return sale_service.get_rentabilidad(sale_id, current_user)


@router.get("/{sale_id}")
def get_sale_detail(
    sale_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.get_sale_detail(sale_id, current_user)


@router.get("/{sale_id}/factura/pdf")
def get_invoice_pdf(
    sale_id: int,
    current_user: dict = Depends(get_current_user),
) -> Response:
    pdf_file = sale_service.get_invoice_pdf(sale_id, current_user)
    return Response(
        content=pdf_file["content"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdf_file["filename"]}"'},
    )


@router.put("/{sale_id}")
def update_sale(
    sale_id: int,
    payload: SaleUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.update_sale(sale_id, payload.model_dump(), current_user)


@router.delete("/{sale_id}")
def delete_sale(
    sale_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.delete_sale(sale_id, current_user)


@router.post("/{sale_id}/productos")
def add_sale_products(
    sale_id: int,
    payload: SaleProductsAddRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    data = payload.model_dump()
    data["Venta_Id"] = sale_id
    return sale_service.add_sale_products(data, current_user)


@router.put("/{sale_id}/confirmar")
def confirm_sale(
    sale_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.confirm_sale(sale_id, current_user)


@router.post("/{sale_id}/facturar")
def invoice_sale(
    sale_id: int,
    payload: SaleInvoiceRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.invoice_sale(sale_id, payload.model_dump(), current_user)


@router.put("/{sale_id}/cancelar")
def cancel_sale(
    sale_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.cancel_sale(sale_id, current_user)


@router.post("/{sale_id}/ordenes-produccion")
def create_production_orders(
    sale_id: int,
    payload: ProductionOrdersCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return sale_service.create_production_orders(sale_id, payload.model_dump(), current_user)
