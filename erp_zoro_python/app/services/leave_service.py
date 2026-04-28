"""
Servicio de gestión de vacaciones / licencias (RH)
"""

from typing import Dict, Any
from sqlalchemy import text
from fastapi import HTTPException, status

from app.db.session import get_connection


# ============================================================================
# BALANCE DE VACACIONES
# ============================================================================

async def check_balance_availability(
    user_id: int,
    leave_type_id: int,
    days_requested: float,
    year: int
) -> Dict[str, Any]:
    """Verificar si el usuario tiene saldo suficiente"""

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
                "reason": "No hay saldo registrado",
                "days_remaining": 0
            }

        available = float(row[0] or 0)
        used = float(row[1] or 0)
        planned = float(row[2] or 0)
        negative_allowed = bool(row[3])

        remaining = available - used - planned

        if negative_allowed:
            can_use = True
        else:
            can_use = remaining >= days_requested

        return {
            "available": can_use,
            "days_remaining": remaining,
            "days_requested": days_requested,
            "negative_allowed": negative_allowed
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verificando saldo: {str(e)}"
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