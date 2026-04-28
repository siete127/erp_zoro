from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user, require_admin
from app.services import requisicion_service

router = APIRouter()


class LineaReqIn(BaseModel):
    Producto_Id: int | None = None
    MateriaPrima_Id: int | None = None
    Descripcion: str | None = None
    CantidadSolicitada: float = 1
    UnidadMedida: str | None = None
    CostoEstimado: float | None = None


class RequisicionCreate(BaseModel):
    Company_Id: int
    Solicitante_Id: int | None = None
    FechaRequerida: str | None = None
    Notas: str | None = None
    lineas: list[LineaReqIn] = []


class RequisicionUpdate(BaseModel):
    FechaRequerida: str | None = None
    Notas: str | None = None
    lineas: list[LineaReqIn] | None = None


class AprobacionBody(BaseModel):
    aprobado: bool
    comentario: str | None = None


class ConvertirOCBody(BaseModel):
    Proveedor_Id: int
    Moneda: str = "MXN"


@router.get("/")
def list_requisiciones(
    company_id: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return requisicion_service.list_requisiciones(current_user, company_id)


@router.get("/{req_id}")
def get_requisicion(
    req_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return requisicion_service.get_requisicion(req_id, current_user)


@router.post("/")
def create_requisicion(
    payload: RequisicionCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return requisicion_service.create_requisicion(payload.model_dump(), current_user)


@router.put("/{req_id}")
def update_requisicion(
    req_id: int,
    payload: RequisicionUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return requisicion_service.update_requisicion(req_id, payload.model_dump(), current_user)


@router.post("/{req_id}/enviar")
def enviar_requisicion(
    req_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return requisicion_service.enviar_requisicion(req_id, current_user)


@router.post("/{req_id}/aprobacion")
def aprobar_requisicion(
    req_id: int,
    body: AprobacionBody,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return requisicion_service.aprobar_requisicion(req_id, body.aprobado, body.comentario, current_user)


@router.post("/{req_id}/convertir-oc")
def convertir_a_oc(
    req_id: int,
    body: ConvertirOCBody,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return requisicion_service.convertir_a_oc(req_id, body.model_dump(), current_user)


@router.delete("/{req_id}")
def delete_requisicion(
    req_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return requisicion_service.delete_requisicion(req_id, current_user)
