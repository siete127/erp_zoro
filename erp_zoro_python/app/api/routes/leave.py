"""
Rutas para gestión de tipos de licencias, saldos, festivos y solicitudes.
Prefix registrado en router.py: /rh   →  rutas completas: /rh/leave/...
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.schemas.leave import (
    LeaveBalanceSummary,
    LeaveTypeCreate,
    LeaveTypeResponse,
    PublicHolidayCreate,
    PublicHolidayResponse,
)
import app.services.leave_service as svc

router = APIRouter(prefix="/leave", tags=["HR - Leave Management"])


# ── Helpers de permisos ───────────────────────────────────────────────────────

def _is_admin(user: dict) -> bool:
    return bool(user.get("is_admin") or user.get("is_super_admin"))


def _company(user: dict) -> int:
    companies = user.get("companies") or []
    if companies:
        return int(companies[0])
    cid = user.get("Company_Id") or user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="No se pudo determinar la empresa del usuario")
    return int(cid)


def _user_id(user: dict) -> int:
    uid = user.get("User_Id") or user.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Token sin user_id")
    return int(uid)


# ============================================================================
# LEAVE REQUESTS — Solicitudes de vacaciones/licencias
# ============================================================================

class LeaveRequestCreate(BaseModel):
    user_id: int = Field(..., gt=0)
    leave_type_id: int = Field(..., gt=0)
    start_date: date
    end_date: date
    razon: Optional[str] = None


class ApproveRequest(BaseModel):
    estatus: str = Field(..., pattern="^(Aprobado|Rechazado)$")
    observaciones: Optional[str] = None


@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    data: LeaveRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Crear solicitud de vacaciones.
    - Empleado: solo puede pedir para sí mismo.
    - Admin/RH: puede pedir para cualquier usuario de su empresa.
    Valida fechas, traslapes, duplicados exactos, saldo y que el usuario esté activo.
    """
    return await svc.create_leave_request(
        data=data.model_dump(),
        requesting_user_id=_user_id(current_user),
        is_admin=_is_admin(current_user),
        company_id=_company(current_user),
    )


@router.get("/requests")
async def list_leave_requests(
    user_id: Optional[int] = Query(None, gt=0, description="Filtrar por empleado (solo admin)"),
    estatus: Optional[str] = Query(None, description="Pendiente | Aprobado | Rechazado | Cancelado"),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    current_user: dict = Depends(get_current_user),
):
    """
    Listar solicitudes.
    - Empleado: solo ve las propias.
    - Admin: ve todas las de su empresa (puede filtrar por user_id).
    """
    return await svc.list_leave_requests(
        company_id=_company(current_user),
        current_user_id=_user_id(current_user),
        is_admin=_is_admin(current_user),
        user_id_filter=user_id,
        estatus=estatus,
        year=year,
    )


@router.patch("/requests/{vacaciones_id}/aprobar", status_code=status.HTTP_200_OK)
async def approve_leave_request(
    vacaciones_id: int,
    body: ApproveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Aprobar o rechazar una solicitud (solo admin/RH).
    Actualiza saldo: PlannedDays → UsedDays si aprueba; revierte PlannedDays si rechaza.
    """
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden aprobar solicitudes")
    return await svc.approve_leave_request(
        vacaciones_id=vacaciones_id,
        estatus=body.estatus,
        observaciones=body.observaciones,
        aprobado_por=_user_id(current_user),
    )


@router.patch("/requests/{vacaciones_id}/cancelar", status_code=status.HTTP_200_OK)
async def cancel_leave_request(
    vacaciones_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancelar solicitud.
    - Empleado: solo puede cancelar la propia si está Pendiente.
    - Admin: puede cancelar cualquiera en estado Pendiente o Aprobado.
    Revierte saldo automáticamente.
    """
    return await svc.cancel_leave_request(
        vacaciones_id=vacaciones_id,
        current_user_id=_user_id(current_user),
        is_admin=_is_admin(current_user),
    )


# ============================================================================
# LEAVE TYPES — Tipos de licencia
# ============================================================================

@router.get("/types", response_model=List[LeaveTypeResponse])
async def get_leave_types(
    company_id: int = Query(..., gt=0),
    is_active: bool = Query(True),
    current_user: dict = Depends(get_current_user),
):
    return await svc.list_leave_types(company_id, is_active)


@router.post("/types", response_model=LeaveTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_type(
    data: LeaveTypeCreate,
    current_user: dict = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear tipos de licencia")
    return await svc.create_leave_type(data)


@router.get("/types/{leave_type_id}", response_model=LeaveTypeResponse)
async def get_leave_type(
    leave_type_id: int,
    current_user: dict = Depends(get_current_user),
):
    return await svc.get_leave_type(leave_type_id)


# ============================================================================
# LEAVE BALANCE — Saldo de licencias
# ============================================================================

@router.get("/balance", response_model=List[LeaveBalanceSummary])
async def get_employee_balance(
    user_id: Optional[int] = Query(None),
    year: int = Query(..., ge=2020, le=2100),
    current_user: dict = Depends(get_current_user),
):
    """
    Saldo de licencias.
    Empleado: solo el propio. Admin: puede consultar cualquier user_id.
    """
    target = user_id or _user_id(current_user)
    if target != _user_id(current_user) and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver saldo de otros empleados")
    return await svc.get_leave_balance(target, year)


@router.get("/balance-check")
async def check_balance(
    user_id: int = Query(..., gt=0),
    leave_type_id: int = Query(..., gt=0),
    days_requested: float = Query(..., gt=0),
    year: int = Query(..., ge=2020, le=2100),
    current_user: dict = Depends(get_current_user),
):
    if user_id != _user_id(current_user) and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Sin permiso para consultar saldo ajeno")
    return await svc.check_balance_availability(user_id, leave_type_id, days_requested, year)


# ============================================================================
# PUBLIC HOLIDAYS — Días festivos
# ============================================================================

@router.get("/public-holidays", response_model=List[PublicHolidayResponse])
async def get_holidays(
    company_id: int = Query(..., gt=0),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    current_user: dict = Depends(get_current_user),
):
    return await svc.get_public_holidays(company_id, year)


@router.post("/public-holidays", response_model=PublicHolidayResponse, status_code=status.HTTP_201_CREATED)
async def create_holiday(
    data: PublicHolidayCreate,
    current_user: dict = Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear días festivos")
    return await svc.create_public_holiday(data)


# ============================================================================
# UTILITIES — Días laborales
# ============================================================================

@router.get("/is-working-day")
async def check_working_day(
    check_date: datetime = Query(..., alias="date"),
    company_id: int = Query(..., gt=0),
    current_user: dict = Depends(get_current_user),
):
    is_working = await svc.is_working_day(check_date, company_id)
    return {"is_working_day": is_working, "date": check_date.date().isoformat()}


@router.get("/working-days-count")
async def count_working_days(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    company_id: int = Query(..., gt=0),
    include_weekends: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date debe ser <= end_date")
    working_days = await svc.calculate_working_days(start_date, end_date, company_id, include_weekends)
    return {
        "start_date": start_date.date().isoformat(),
        "end_date": end_date.date().isoformat(),
        "working_days": working_days,
        "include_weekends": include_weekends,
    }
