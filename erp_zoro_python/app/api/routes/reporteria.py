from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from app.api.deps import get_current_user
from app.services import reporteria_service as svc

router = APIRouter()


@router.get("/facturas")
def get_facturas(
    fechaInicio: Optional[str] = None,
    fechaFin: Optional[str] = None,
    cliente: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    data = svc.list_facturas(fechaInicio, fechaFin, cliente, status)
    return {"success": True, "data": data}


@router.get("/facturas/{factura_id}/pdf")
def descargar_pdf(factura_id: int, current_user: dict = Depends(get_current_user)):
    try:
        pdf_bytes = svc.descargar_pdf(factura_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=factura-{factura_id}.pdf"},
    )


@router.get("/facturas/{factura_id}/xml")
def descargar_xml(factura_id: int, current_user: dict = Depends(get_current_user)):
    try:
        xml_bytes = svc.descargar_xml(factura_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(
        content=xml_bytes,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=factura-{factura_id}.xml"},
    )


@router.get("/estadisticas")
def get_estadisticas(
    fechaInicio: Optional[str] = None,
    fechaFin: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    data = svc.get_estadisticas(fechaInicio, fechaFin)
    return {"success": True, "data": data}


@router.get("/facturas/vencimientos")
def get_vencimientos(
    dias_alerta: int = 7,
    current_user: dict = Depends(get_current_user),
):
    return svc.get_vencimientos(dias_alerta, current_user)
