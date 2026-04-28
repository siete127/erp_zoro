from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import asistencia_service


router = APIRouter()


class CheckPayload(BaseModel):
    Company_Id: int
    Tipo: str = "normal"  # normal | home_office | permiso


class CorreccionPayload(BaseModel):
    HoraEntrada: str | None = None
    HoraSalida: str | None = None
    Tipo: str | None = None


@router.post("/check-in/{user_id}")
def check_in(user_id: int, payload: CheckPayload, current_user: dict = Depends(get_current_user)) -> dict:
    return asistencia_service.check_in(user_id, payload.model_dump(), current_user)


@router.post("/check-out/{user_id}")
def check_out(user_id: int, payload: CheckPayload, current_user: dict = Depends(get_current_user)) -> dict:
    return asistencia_service.check_out(user_id, payload.model_dump(), current_user)


@router.get("/estado-hoy/{user_id}")
def estado_hoy(
    user_id: int,
    company_id: int = Query(...),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return asistencia_service.get_estado_hoy(user_id, company_id)


@router.get("/")
def list_asistencia(
    company_id: int | None = Query(default=None),
    mes: str | None = Query(default=None, description="Formato YYYY-MM"),
    user_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return asistencia_service.list_asistencia(current_user, company_id, mes, user_id)


@router.put("/{asist_id}")
def corregir_registro(
    asist_id: int,
    payload: CorreccionPayload,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return asistencia_service.corregir_registro(asist_id, payload.model_dump(exclude_none=True), current_user)


@router.get("/reporte-mensual")
def reporte_mensual(
    mes: str = Query(..., description="Formato YYYY-MM"),
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return asistencia_service.get_reporte_mensual(current_user, company_id, mes)
