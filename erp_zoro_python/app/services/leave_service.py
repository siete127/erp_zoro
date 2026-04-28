"""
Servicio de gestión de tipos de licencias, saldos y días festivos
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from fastapi import HTTPException, status

from app.db.session import get_connection, get_transaction
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeResponse,
    LeaveBalanceCreate, LeaveBalanceResponse,
    PublicHolidayCreate, PublicHolidayResponse,
    LeaveBalanceSummary
)


# ============================================================================
# LEAVE TYPES FUNCTIONS
# ============================================================================

async def list_leave_types(company_id: int, is_active: bool = True) -> List[LeaveTypeResponse]:
    """Obtener todos los tipos de licencia de una empresa"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                LeaveType_Id,
                Company_Id,
                Name,
                Description,
                Color,
                DefaultDays,
                Requires_Document,
                IsActive,
                CreatedAt,
                UpdatedAt
            FROM ERP_HR_LEAVE_TYPES
            WHERE Company_Id = :company_id
            """

            if is_active:
                query += " AND IsActive = 1"

            query += " ORDER BY Name"

            result = conn.execute(text(query), {"company_id": company_id})
            rows = result.fetchall()

        return [
            LeaveTypeResponse(
                leave_type_id=row[0],
                company_id=row[1],
                name=row[2],
                description=row[3],
                color=row[4],
                default_days=row[5],
                requires_document=row[6],
                is_active=row[7],
                created_at=row[8],
                updated_at=row[9]
            )
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener tipos de licencia: {str(e)}"
        )


async def create_leave_type(data: LeaveTypeCreate) -> LeaveTypeResponse:
    """Crear nuevo tipo de licencia"""
    try:
        with get_transaction() as conn:
            query = """
            INSERT INTO ERP_HR_LEAVE_TYPES 
            (Company_Id, Name, Description, Color, DefaultDays, Requires_Document, IsActive, CreatedAt, UpdatedAt)
            VALUES (:company_id, :name, :description, :color, :default_days, :requires_document, :is_active, GETDATE(), GETDATE());
            SELECT CAST(SCOPE_IDENTITY() as int)
            """

            result = conn.execute(text(query), {
                "company_id": data.company_id,
                "name": data.name,
                "description": data.description,
                "color": data.color,
                "default_days": data.default_days,
                "requires_document": data.requires_document,
                "is_active": data.is_active
            })

            leave_type_id = result.scalar()
            conn.commit()

        return await get_leave_type(leave_type_id)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear tipo de licencia: {str(e)}"
        )


async def get_leave_type(leave_type_id: int) -> LeaveTypeResponse:
    """Obtener un tipo de licencia por ID"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                LeaveType_Id, Company_Id, Name, Description, Color, 
                DefaultDays, Requires_Document, IsActive, CreatedAt, UpdatedAt
            FROM ERP_HR_LEAVE_TYPES
            WHERE LeaveType_Id = :leave_type_id
            """

            result = conn.execute(text(query), {"leave_type_id": leave_type_id})
            row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tipo de licencia no encontrado"
            )

        return LeaveTypeResponse(
            leave_type_id=row[0],
            company_id=row[1],
            name=row[2],
            description=row[3],
            color=row[4],
            default_days=row[5],
            requires_document=row[6],
            is_active=row[7],
            created_at=row[8],
            updated_at=row[9]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener tipo de licencia: {str(e)}"
        )


# ============================================================================
# LEAVE BALANCE FUNCTIONS
# ============================================================================

async def get_leave_balance(user_id: int, year: int) -> List[LeaveBalanceSummary]:
    """Obtener saldo de licencias para un empleado en un año"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                LT.Name,
                LB.AvailableDays,
                LB.UsedDays,
                LB.PlannedDays,
                (LB.AvailableDays - LB.UsedDays - LB.PlannedDays) as Remaining
            FROM ERP_HR_LEAVE_BALANCE LB
            INNER JOIN ERP_HR_LEAVE_TYPES LT ON LB.LeaveType_Id = LT.LeaveType_Id
            WHERE LB.User_Id = :user_id AND LB.Year = :year
            ORDER BY LT.Name
            """

            result = conn.execute(text(query), {"user_id": user_id, "year": year})
            rows = result.fetchall()

        return [
            LeaveBalanceSummary(
                leave_type=row[0],
                available_days=row[1],
                used_days=row[2],
                planned_days=row[3],
                remaining=row[4]
            )
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener saldo de licencias: {str(e)}"
        )


async def create_leave_balance(data: LeaveBalanceCreate) -> LeaveBalanceResponse:
    """Crear nuevo registro de saldo de licencias"""
    try:
        with get_transaction() as conn:
            query = """
            INSERT INTO ERP_HR_LEAVE_BALANCE 
            (User_Id, LeaveType_Id, Year, AvailableDays, UsedDays, PlannedDays, 
             CarryOverDays, NegativeBalanceAllowed, CreatedAt, UpdatedAt)
            VALUES (:user_id, :leave_type_id, :year, :available_days, :used_days, 
                    :planned_days, :carry_over_days, :negative_balance_allowed, GETDATE(), GETDATE());
            SELECT CAST(SCOPE_IDENTITY() as int)
            """

            result = conn.execute(text(query), {
                "user_id": data.user_id,
                "leave_type_id": data.leave_type_id,
                "year": data.year,
                "available_days": data.available_days,
                "used_days": data.used_days,
                "planned_days": data.planned_days,
                "carry_over_days": data.carry_over_days,
                "negative_balance_allowed": data.negative_balance_allowed
            })

            balance_id = result.scalar()
            conn.commit()

        return await get_leave_balance_by_id(balance_id)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear saldo de licencias: {str(e)}"
        )


async def get_leave_balance_by_id(balance_id: int) -> LeaveBalanceResponse:
    """Obtener saldo de licencias por ID"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                Balance_Id, User_Id, LeaveType_Id, Year, AvailableDays, UsedDays, 
                PlannedDays, CarryOverDays, NegativeBalanceAllowed, LastAccrualDate, 
                Notes, CreatedAt, UpdatedAt
            FROM ERP_HR_LEAVE_BALANCE
            WHERE Balance_Id = :balance_id
            """

            result = conn.execute(text(query), {"balance_id": balance_id})
            row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Saldo de licencias no encontrado"
            )

        return LeaveBalanceResponse(
            balance_id=row[0],
            user_id=row[1],
            leave_type_id=row[2],
            year=row[3],
            available_days=row[4],
            used_days=row[5],
            planned_days=row[6],
            carry_over_days=row[7],
            negative_balance_allowed=row[8],
            last_accrual_date=row[9],
            notes=row[10],
            created_at=row[11],
            updated_at=row[12]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener saldo: {str(e)}"
        )


# ============================================================================
# PUBLIC HOLIDAYS FUNCTIONS
# ============================================================================

async def get_public_holidays(company_id: int, year: Optional[int] = None) -> List[PublicHolidayResponse]:
    """Obtener días festivos de una empresa"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                Holiday_Id, Company_Id, HolidayDate, Name, Description, IsObligatory, 
                IsRecurring, RecurringMonth, RecurringDay, CreatedAt, UpdatedAt
            FROM ERP_COMPANY_PUBLIC_HOLIDAYS
            WHERE Company_Id = :company_id
            """

            params = {"company_id": company_id}

            if year:
                query += " AND YEAR(HolidayDate) = :year"
                params["year"] = year

            query += " ORDER BY HolidayDate"

            result = conn.execute(text(query), params)
            rows = result.fetchall()

        return [
            PublicHolidayResponse(
                holiday_id=row[0],
                company_id=row[1],
                holiday_date=row[2],
                name=row[3],
                description=row[4],
                is_obligatory=row[5],
                is_recurring=row[6],
                recurring_month=row[7],
                recurring_day=row[8],
                created_at=row[9],
                updated_at=row[10]
            )
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener días festivos: {str(e)}"
        )


async def create_public_holiday(data: PublicHolidayCreate) -> PublicHolidayResponse:
    """Crear nuevo día festivo"""
    try:
        with get_transaction() as conn:
            query = """
            INSERT INTO ERP_COMPANY_PUBLIC_HOLIDAYS 
            (Company_Id, HolidayDate, Name, Description, IsObligatory, IsRecurring, 
             RecurringMonth, RecurringDay, CreatedAt, UpdatedAt)
            VALUES (:company_id, :holiday_date, :name, :description, :is_obligatory, 
                    :is_recurring, :recurring_month, :recurring_day, GETDATE(), GETDATE());
            SELECT CAST(SCOPE_IDENTITY() as int)
            """

            result = conn.execute(text(query), {
                "company_id": data.company_id,
                "holiday_date": data.holiday_date,
                "name": data.name,
                "description": data.description,
                "is_obligatory": data.is_obligatory,
                "is_recurring": data.is_recurring,
                "recurring_month": data.recurring_month,
                "recurring_day": data.recurring_day
            })

            holiday_id = result.scalar()
            conn.commit()

        return await get_public_holiday(holiday_id)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear día festivo: {str(e)}"
        )


async def get_public_holiday(holiday_id: int) -> PublicHolidayResponse:
    """Obtener un día festivo por ID"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                Holiday_Id, Company_Id, HolidayDate, Name, Description, IsObligatory, 
                IsRecurring, RecurringMonth, RecurringDay, CreatedAt, UpdatedAt
            FROM ERP_COMPANY_PUBLIC_HOLIDAYS
            WHERE Holiday_Id = :holiday_id
            """

            result = conn.execute(text(query), {"holiday_id": holiday_id})
            row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Día festivo no encontrado"
            )

        return PublicHolidayResponse(
            holiday_id=row[0],
            company_id=row[1],
            holiday_date=row[2],
            name=row[3],
            description=row[4],
            is_obligatory=row[5],
            is_recurring=row[6],
            recurring_month=row[7],
            recurring_day=row[8],
            created_at=row[9],
            updated_at=row[10]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener día festivo: {str(e)}"
        )


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

async def is_working_day(date: datetime, company_id: int) -> bool:
    """Verificar si una fecha es día laboral"""
    if date.weekday() >= 5:
        return False

    holidays = await get_public_holidays(company_id, date.year)

    for holiday in holidays:
        if holiday.holiday_date.date() == date.date():
            return False

    return True


async def calculate_working_days(
    start_date: datetime,
    end_date: datetime,
    company_id: int,
    include_weekends: bool = False
) -> int:
    """Calcular días laborales entre dos fechas"""
    try:
        current = start_date
        working_days = 0

        holidays = await get_public_holidays(company_id, start_date.year)
        holiday_dates = {h.holiday_date.date() for h in holidays}

        while current <= end_date:
            is_weekend = current.weekday() >= 5
            is_holiday = current.date() in holiday_dates

            if include_weekends:
                if not is_holiday:
                    working_days += 1
            else:
                if not is_weekend and not is_holiday:
                    working_days += 1

            current += timedelta(days=1)

        return working_days

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al calcular días laborales: {str(e)}"
        )


async def check_balance_availability(
    user_id: int,
    leave_type_id: int,
    days_requested: float,
    year: int
) -> Dict[str, Any]:
    """Verificar disponibilidad de saldo para solicitar licencia"""
    try:
        with get_connection() as conn:
            query = """
            SELECT 
                AvailableDays,
                UsedDays,
                PlannedDays,
                NegativeBalanceAllowed
            FROM ERP_HR_LEAVE_BALANCE
            WHERE User_Id = :user_id 
                AND LeaveType_Id = :leave_type_id 
                AND Year = :year
            """

            result = conn.execute(text(query), {
                "user_id": user_id,
                "leave_type_id": leave_type_id,
                "year": year
            })

            row = result.fetchone()

        if not row:
            return {
                "available": False,
                "reason": "No hay saldo registrado para este tipo de licencia",
                "days_available": 0,
                "days_requested": days_requested,
                "days_remaining": 0
            }

        available_days = float(row[0] or 0)
        used_days = float(row[1] or 0)
        planned_days = float(row[2] or 0)
        negative_allowed = bool(row[3])

        remaining = available_days - used_days - planned_days

        if negative_allowed:
            can_use = True
        else:
            can_use = remaining >= days_requested

        return {
            "available": can_use,
            "reason": "OK" if can_use else "Saldo insuficiente",
            "days_available": available_days,
            "days_used": used_days,
            "days_planned": planned_days,
            "days_remaining": remaining,
            "days_requested": days_requested,
            "negative_allowed": negative_allowed
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al verificar saldo: {str(e)}"
        )