from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import proveedor_precio_service

router = APIRouter()


class PrecioCreate(BaseModel):
    Proveedor_Id: int
    Company_Id: int
    Producto_Id: int | None = None
    MateriaPrima_Id: int | None = None
    Descripcion: str | None = None
    PrecioUnitario: float
    Moneda: str = "MXN"
    Vigencia: str | None = None


class PrecioUpdate(BaseModel):
    Producto_Id: int | None = None
    MateriaPrima_Id: int | None = None
    Descripcion: str | None = None
    PrecioUnitario: float
    Moneda: str = "MXN"
    Vigencia: str | None = None


class DatosProveedorUpdate(BaseModel):
    LeadTimeEntrega: int | None = None
    CalificacionProveedor: float | None = None
    TerminosPago: str | None = None
    NotasProveedor: str | None = None


@router.get("/{proveedor_id}/precios")
def list_precios(
    proveedor_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return proveedor_precio_service.list_precios(proveedor_id, current_user)


@router.get("/{proveedor_id}/precio-sugerido")
def get_precio_sugerido(
    proveedor_id: int,
    company_id: int = Query(...),
    producto_id: int | None = Query(default=None),
    materia_prima_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    precio = proveedor_precio_service.get_precio_sugerido(
        proveedor_id, company_id, producto_id, materia_prima_id
    )
    return precio or {}


@router.post("/{proveedor_id}/precios")
def create_precio(
    proveedor_id: int,
    payload: PrecioCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    data = payload.model_dump()
    data["Proveedor_Id"] = proveedor_id
    return proveedor_precio_service.create_precio(data, current_user)


@router.put("/{proveedor_id}/precios/{precio_id}")
def update_precio(
    proveedor_id: int,
    precio_id: int,
    payload: PrecioUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proveedor_precio_service.update_precio(precio_id, payload.model_dump(), current_user)


@router.delete("/{proveedor_id}/precios/{precio_id}")
def delete_precio(
    proveedor_id: int,
    precio_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proveedor_precio_service.delete_precio(precio_id, current_user)


@router.get("/{proveedor_id}/historial-oc")
def historial_oc(
    proveedor_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return proveedor_precio_service.historial_oc(proveedor_id, current_user)


@router.patch("/{proveedor_id}/datos")
def update_datos_proveedor(
    proveedor_id: int,
    payload: DatosProveedorUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proveedor_precio_service.update_datos_proveedor(
        proveedor_id, payload.model_dump(exclude_none=True), current_user
    )
