"""
Schemas Pydantic para módulo de gestión de licencias y vacaciones
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ============================================================================
# LEAVE TYPES (Tipos de Licencia)
# ============================================================================

class LeaveTypeBase(BaseModel):
    """Base schema para tipos de licencia"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: str = Field(default="#0066CC", pattern="^#[0-9A-Fa-f]{6}$")
    default_days: int = Field(default=5, gt=0)
    requires_document: bool = False
    is_active: bool = True
    company_id: int


class LeaveTypeCreate(LeaveTypeBase):
    """Schema para crear tipo de licencia"""
    pass


class LeaveTypeUpdate(BaseModel):
    """Schema para actualizar tipo de licencia"""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    default_days: Optional[int] = None
    requires_document: Optional[bool] = None
    is_active: Optional[bool] = None


class LeaveTypeResponse(LeaveTypeBase):
    """Schema para respuesta de tipo de licencia"""
    leave_type_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# LEAVE BALANCE (Saldo de Licencias)
# ============================================================================

class LeaveBalanceBase(BaseModel):
    """Base schema para saldo de licencias"""
    user_id: int
    leave_type_id: int
    year: int = Field(..., gt=2020, lt=2100)
    available_days: float = Field(default=0, ge=0)
    used_days: float = Field(default=0, ge=0)
    planned_days: float = Field(default=0, ge=0)
    carry_over_days: float = Field(default=0, ge=0)
    negative_balance_allowed: float = Field(default=0, ge=0)


class LeaveBalanceCreate(LeaveBalanceBase):
    """Schema para crear saldo de licencias"""
    pass


class LeaveBalanceUpdate(BaseModel):
    """Schema para actualizar saldo de licencias"""
    available_days: Optional[float] = None
    used_days: Optional[float] = None
    planned_days: Optional[float] = None
    carry_over_days: Optional[float] = None
    negative_balance_allowed: Optional[float] = None
    last_accrual_date: Optional[datetime] = None
    notes: Optional[str] = None


class LeaveBalanceResponse(LeaveBalanceBase):
    """Schema para respuesta de saldo de licencias"""
    balance_id: int
    last_accrual_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaveBalanceSummary(BaseModel):
    """Schema simplificado para resumen de saldo"""
    leave_type: str
    available_days: float
    used_days: float
    planned_days: float
    remaining: float = Field(..., description="Available - Used - Planned")
    
    class Config:
        from_attributes = True


# ============================================================================
# PUBLIC HOLIDAYS (Días Festivos)
# ============================================================================

class PublicHolidayBase(BaseModel):
    """Base schema para días festivos"""
    company_id: int
    holiday_date: datetime
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_obligatory: bool = True
    is_recurring: bool = False
    recurring_month: Optional[int] = Field(None, ge=1, le=12)
    recurring_day: Optional[int] = Field(None, ge=1, le=31)


class PublicHolidayCreate(PublicHolidayBase):
    """Schema para crear día festivo"""
    pass


class PublicHolidayUpdate(BaseModel):
    """Schema para actualizar día festivo"""
    holiday_date: Optional[datetime] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_obligatory: Optional[bool] = None
    is_recurring: Optional[bool] = None
    recurring_month: Optional[int] = None
    recurring_day: Optional[int] = None


class PublicHolidayResponse(PublicHolidayBase):
    """Schema para respuesta de día festivo"""
    holiday_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# LEAVE APPROVERS (Matriz de Aprobadores)
# ============================================================================

class LeaveApproverBase(BaseModel):
    """Base schema para aprobadores de licencia"""
    company_id: int
    department_id: Optional[int] = None
    job_title_id: Optional[int] = None
    primary_approver_id: int
    secondary_approver_id: Optional[int] = None
    requires_secondary: bool = False
    max_days_auto_approve: int = Field(default=3, ge=0)


class LeaveApproverCreate(LeaveApproverBase):
    """Schema para crear aprobador"""
    pass


class LeaveApproverUpdate(BaseModel):
    """Schema para actualizar aprobador"""
    primary_approver_id: Optional[int] = None
    secondary_approver_id: Optional[int] = None
    requires_secondary: Optional[bool] = None
    max_days_auto_approve: Optional[int] = None


class LeaveApproverResponse(LeaveApproverBase):
    """Schema para respuesta de aprobador"""
    approver_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# VACATION REQUEST EXTENDED (Solicitud de Vacaciones Extendida)
# ============================================================================

class VacacionesExtended(BaseModel):
    """Schema extendido para solicitud de vacaciones con información de balance"""
    vacaciones_id: int
    user_id: int
    user_name: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    cantidad: int
    razon: Optional[str] = None
    observaciones: Optional[str] = None
    estatus: str
    aprobado_por: Optional[int] = None
    aprobado_por_nombre: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    leave_type_id: Optional[int] = None
    leave_type_name: Optional[str] = None
    duration: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================================================
# ANALYTICS SCHEMAS (Esquemas para Reportes)
# ============================================================================

class VacationAnalyticsSummary(BaseModel):
    """Resumen analítico de vacaciones"""
    total_requests: int
    approved_requests: int
    pending_requests: int
    rejected_requests: int
    total_days_used: float
    total_days_approved: float
    total_days_pending: float
    average_days_per_employee: float
    most_common_leave_type: Optional[str] = None


class EmployeeVacationHistory(BaseModel):
    """Historial de vacaciones de un empleado"""
    user_id: int
    user_name: str
    current_year_days_used: float
    previous_year_days_used: float
    pending_approvals: int
    upcoming_vacations: List[dict] = []
    balance_by_type: List[LeaveBalanceSummary] = []


class TeamCoverageSummary(BaseModel):
    """Resumen de cobertura de equipo para una fecha"""
    date: datetime
    total_team_members: int
    absent_members: int
    coverage_percentage: float
    absent_by_type: dict = {}  # {"Vacaciones": 2, "Enfermedad": 1}
