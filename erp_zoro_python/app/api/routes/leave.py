"""
Rutas para gestión de tipos de licencias, saldos y días festivos
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime
from typing import List, Optional

from app.api.deps import get_current_user
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeResponse,
    LeaveBalanceResponse, LeaveBalanceSummary,
    PublicHolidayCreate, PublicHolidayResponse
)
import app.services.leave_service as leave_service
router = APIRouter(prefix="/leave", tags=["HR - Leave Management"])


# ============================================================================
# LEAVE TYPES ENDPOINTS
# ============================================================================

@router.get("/types", response_model=List[LeaveTypeResponse])
async def get_leave_types(
    company_id: int = Query(..., gt=0),
    is_active: bool = Query(True),
    current_user = Depends(get_current_user)
):
    """
    Obtener todos los tipos de licencia de una empresa
    
    Query Parameters:
    - company_id: ID de la empresa
    - is_active: Filtrar solo tipos activos (default: true)
    """
    return await leave_service.list_leave_types(company_id, is_active)


@router.post("/types", response_model=LeaveTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_type(
    data: LeaveTypeCreate,
    current_user = Depends(get_current_user)
):
    """
    Crear nuevo tipo de licencia (requiere admin)
    
    Body:
    - name: Nombre del tipo (ej: "Vacaciones", "Enfermedad")
    - description: Descripción opcional
    - color: Color hexadecimal (ej: "#0066CC")
    - default_days: Días por defecto asignados
    - requires_document: Si requiere documentación (ej: certificado médico)
    - company_id: ID de la empresa
    """
    # Verificar que sea admin
    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden crear tipos de licencia"
        )
    
    return await leave_service.create_leave_type(data)


@router.get("/types/{leave_type_id}", response_model=LeaveTypeResponse)
async def get_leave_type(
    leave_type_id: int,
    current_user = Depends(get_current_user)
):
    """Obtener un tipo de licencia específico"""
    return await leave_service.get_leave_type(leave_type_id)


# ============================================================================
# LEAVE BALANCE ENDPOINTS
# ============================================================================

@router.get("/balance", response_model=List[LeaveBalanceSummary])
async def get_employee_balance(
    user_id: Optional[int] = Query(None),
    year: int = Query(..., ge=2020, le=2100),
    current_user = Depends(get_current_user)
):
    """
    Obtener saldo de licencias de un empleado
    
    Query Parameters:
    - user_id: ID del empleado (si no se especifica, se usa el usuario actual)
    - year: Año para el que consultar el saldo
    """
    # Si no especifica user_id, usar el del usuario actual
    if not user_id:
        user_id = current_user.get("user_id")
    
    # Verificar permisos: empleado solo puede ver su propio saldo o ser admin
    if user_id != current_user.get("user_id"):
        if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver saldo de otros empleados"
            )
    
    return await leave_service.get_leave_balance(user_id, year)


# ============================================================================
# PUBLIC HOLIDAYS ENDPOINTS
# ============================================================================

@router.get("/public-holidays", response_model=List[PublicHolidayResponse])
async def get_holidays(
    company_id: int = Query(..., gt=0),
    year: Optional[int] = Query(None, ge=2020, le=2100),
    current_user = Depends(get_current_user)
):
    """
    Obtener días festivos de una empresa
    
    Query Parameters:
    - company_id: ID de la empresa
    - year: Año específico (opcional)
    """
    return await leave_service.get_public_holidays(company_id, year)


@router.post("/public-holidays", response_model=PublicHolidayResponse, status_code=status.HTTP_201_CREATED)
async def create_holiday(
    data: PublicHolidayCreate,
    current_user = Depends(get_current_user)
):
    """
    Crear nuevo día festivo (requiere admin)
    
    Body:
    - company_id: ID de la empresa
    - holiday_date: Fecha del festivo
    - name: Nombre del festivo
    - description: Descripción opcional
    - is_obligatory: Si es obligatorio
    - is_recurring: Si se repite cada año
    - recurring_month: Mes (si es recurrente)
    - recurring_day: Día del mes (si es recurrente)
    """
    # Verificar que sea admin
    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden crear días festivos"
        )
    
    return await leave_service.create_public_holiday(data)


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.get("/is-working-day")
async def check_working_day(
    date: datetime = Query(...),
    company_id: int = Query(..., gt=0),
    current_user = Depends(get_current_user)
):
    """
    Verificar si una fecha es día laboral
    
    Query Parameters:
    - date: Fecha a verificar (ISO format: 2026-04-28)
    - company_id: ID de la empresa
    
    Response:
    - is_working_day: Boolean
    - reason: "weekend" o "holiday"
    """
    is_working = await leave_service.is_working_day(date, company_id)
    
    return {
        "is_working_day": is_working,
        "date": date.isoformat()
    }


@router.get("/working-days-count")
async def count_working_days(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    company_id: int = Query(..., gt=0),
    include_weekends: bool = Query(False),
    current_user = Depends(get_current_user)
):
    """
    Calcular días laborales entre dos fechas
    
    Query Parameters:
    - start_date: Fecha de inicio
    - end_date: Fecha de fin
    - company_id: ID de la empresa
    - include_weekends: Incluir fines de semana (default: false)
    
    Response:
    - working_days: Número de días laborales
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de inicio debe ser menor o igual a la fecha de fin"
        )
    
    working_days = await leave_service.calculate_working_days(
        start_date, end_date, company_id, include_weekends
    )
    
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "working_days": working_days,
        "include_weekends": include_weekends
    }


@router.get("/balance-check")
async def check_balance(
    user_id: int = Query(..., gt=0),
    leave_type_id: int = Query(..., gt=0),
    days_requested: float = Query(..., gt=0),
    year: int = Query(..., ge=2020, le=2100),
    current_user = Depends(get_current_user)
):
    """
    Verificar disponibilidad de saldo para solicitar licencia
    
    Query Parameters:
    - user_id: ID del empleado
    - leave_type_id: ID del tipo de licencia
    - days_requested: Días a solicitar
    - year: Año
    
    Response:
    - available: Boolean
    - reason: Motivo si no hay disponibilidad
    - days_available: Días disponibles
    - days_remaining: Días restantes después de la solicitud
    """
    return await leave_service.check_balance_availability(
        user_id, leave_type_id, days_requested, year
    )
