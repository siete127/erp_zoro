"""
Servicio de gestión de vacaciones / licencias (RH)
"""

from typing import Dict, Any
from sqlalchemy import text
from fastapi import HTTPException, status

from app.db.session import get_connection
# ============================================================================
# VALIDACIONES DE FECHAS
# ============================================================================
from datetime import date


def validate_leave_dates(start_date: date, end_date: date):
    today = date.today()

    if start_date < today:
        raise HTTPException(
            status_code=400,
            detail="No puedes solicitar vacaciones en fechas pasadas"
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="La fecha fin no puede ser menor a la fecha inicio"
        )

    days = (end_date - start_date).days + 1

    if days > 30:
        raise HTTPException(
            status_code=400,
            detail="No puedes solicitar más de 30 días consecutivos"
        )

    return days
# ============================================================================
# BALANCE DE VACACIONES
# ============================================================================

async def check_balance_availability(
    user_id: int,
    leave_type_id: int,
    days_requested: float,
    year: int
) -> Dict[str, Any]:
    """Verificar disponibilidad de saldo para solicitar licencia."""
    try:
        if days_requested <= 0:
            return {
                "available": False,
                "reason": "Los días solicitados deben ser mayores a 0",
                "days_requested": days_requested,
            }

        # Límite empresarial: máximo 5 días en negativo
        max_negative_days = -5

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
                "days_used": 0,
                "days_planned": 0,
                "days_remaining": 0,
                "days_requested": days_requested,
                "remaining_after_request": 0,
                "negative_allowed": False,
            }

        available_days = float(row[0] or 0)
        used_days = float(row[1] or 0)
        planned_days = float(row[2] or 0)
        negative_allowed = bool(row[3])

        remaining = available_days - used_days - planned_days
        remaining_after_request = remaining - days_requested

        if remaining_after_request >= 0:
            can_use = True
            reason = "OK"
        elif not negative_allowed:
            can_use = False
            reason = "Saldo insuficiente"
        elif remaining_after_request < max_negative_days:
            can_use = False
            reason = f"Saldo negativo excede el máximo permitido de {abs(max_negative_days)} días"
        else:
            can_use = True
            reason = "OK con saldo negativo permitido"

        return {
            "available": can_use,
            "reason": reason,
            "days_available": available_days,
            "days_used": used_days,
            "days_planned": planned_days,
            "days_remaining": remaining,
            "days_requested": days_requested,
            "remaining_after_request": remaining_after_request,
            "negative_allowed": negative_allowed,
            "max_negative_days": max_negative_days,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al verificar saldo: {str(e)}"
        )


# ============================================================================
# LISTAR TIPOS DE VACACIONES
# ============================================================================

async def list_leave_types(company_id: int):
    try:
        with get_connection() as conn:
            query = """
            SELECT LeaveType_Id, Name, DefaultDays, IsActive
            FROM ERP_HR_LEAVE_TYPES
            WHERE Company_Id = :company_id AND IsActive = 1
            ORDER BY Name
            """

            result = conn.execute(text(query), {"company_id": company_id})
            rows = result.fetchall()

        return [
            {
                "leave_type_id": row[0],
                "name": row[1],
                "default_days": row[2],
                "is_active": row[3],
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener tipos: {str(e)}"
        )


# ============================================================================
# OBTENER SALDO
# ============================================================================

async def get_leave_balance(user_id: int, year: int):
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
            INNER JOIN ERP_HR_LEAVE_TYPES LT 
                ON LB.LeaveType_Id = LT.LeaveType_Id
            WHERE LB.User_Id = :user_id AND LB.Year = :year
            """

            result = conn.execute(text(query), {
                "user_id": user_id,
                "year": year
            })

            rows = result.fetchall()

        return [
            {
                "leave_type": row[0],
                "available_days": row[1],
                "used_days": row[2],
                "planned_days": row[3],
                "remaining": row[4],
            }
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener saldo: {str(e)}"
        )