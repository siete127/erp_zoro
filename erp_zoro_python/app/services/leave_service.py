"""
Servicio de gestión de vacaciones / licencias (RH)
Cubre: tipos, saldos, festivos, solicitudes, aprobación, cancelación.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import text

from app.db.session import get_connection, get_transaction


# ── Helpers internos ──────────────────────────────────────────────────────────

def _check_user_in_company(user_id: int, company_id: int) -> None:
    """Lanza 403 si el user_id no pertenece a la empresa."""
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT 1 FROM ERP_USERCOMPANIES WHERE User_Id=:u AND Company_Id=:c"),
            {"u": user_id, "c": company_id},
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no pertenece a esta empresa",
        )


def _check_user_active(user_id: int) -> None:
    """Lanza 400 si el usuario está inactivo."""
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT IsActive FROM ERP_USER WHERE User_Id=:u"),
            {"u": user_id},
        ).fetchone()
    if row and not row[0]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El empleado está inactivo y no puede solicitar vacaciones",
        )


def _check_leave_type_in_company(leave_type_id: int, company_id: int) -> None:
    """Lanza 400 si el tipo de licencia no pertenece a la empresa."""
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT 1 FROM ERP_HR_LEAVE_TYPES
                WHERE LeaveType_Id=:lt AND Company_Id=:c AND IsActive=1
            """),
            {"lt": leave_type_id, "c": company_id},
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de licencia no válido para esta empresa",
        )


# ── Validaciones de fechas ────────────────────────────────────────────────────

def validate_leave_dates(start_date: date, end_date: date) -> int:
    today = date.today()
    if start_date < today:
        raise HTTPException(
            status_code=400,
            detail="No puedes solicitar vacaciones en fechas pasadas",
        )
    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="La fecha fin no puede ser menor a la fecha inicio",
        )
    days = (end_date - start_date).days + 1
    if days > 30:
        raise HTTPException(
            status_code=400,
            detail="No puedes solicitar más de 30 días consecutivos",
        )
    return days


# ── Traslapes ─────────────────────────────────────────────────────────────────

def validate_overlap(
    user_id: int,
    start_date: date,
    end_date: date,
    exclude_id: Optional[int] = None,
) -> None:
    """Verifica traslapes en ERP_HR_VACATION_REQUEST (tabla operativa)."""
    with get_connection() as conn:
        excl = "AND Vacaciones_Id <> :excl" if exclude_id else ""
        row = conn.execute(
            text(f"""
                SELECT 1 FROM ERP_HR_VACATION_REQUEST
                WHERE User_Id=:u AND Estatus IN ('Pendiente','Aprobado') AND IsActive=1
                  AND (FechaInicio <= :ef AND FechaFin >= :ei)
                  {excl}
            """),
            {"u": user_id, "ei": start_date, "ef": end_date, "excl": exclude_id},
        ).fetchone()
    if row:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una solicitud de vacaciones en ese rango de fechas",
        )


def validate_exact_duplicate(
    user_id: int,
    start_date: date,
    end_date: date,
    leave_type_id: int,
) -> None:
    """Evita solicitudes exactamente iguales (mismo usuario, fechas y tipo)."""
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT 1 FROM ERP_HR_VACATION_REQUEST
                WHERE User_Id=:u AND FechaInicio=:fi AND FechaFin=:ff
                  AND LeaveTypeId=:lt AND Estatus IN ('Pendiente','Aprobado')
                  AND IsActive=1
            """),
            {"u": user_id, "fi": start_date, "ff": end_date, "lt": leave_type_id},
        ).fetchone()
    if row:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una solicitud idéntica en estado Pendiente o Aprobado",
        )


# ── Balance ───────────────────────────────────────────────────────────────────

async def check_balance_availability(
    user_id: int,
    leave_type_id: int,
    days_requested: float,
    year: int,
) -> Dict[str, Any]:
    if days_requested <= 0:
        return {"available": False, "reason": "Los días solicitados deben ser mayores a 0"}

    max_negative_days = -5
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT AvailableDays, UsedDays, PlannedDays, NegativeBalanceAllowed
                FROM ERP_HR_LEAVE_BALANCE
                WHERE User_Id=:u AND LeaveType_Id=:lt AND Year=:yr
            """),
            {"u": user_id, "lt": leave_type_id, "yr": year},
        ).fetchone()

    if not row:
        return {
            "available": False,
            "reason": "No hay saldo registrado para este tipo de licencia",
            "days_available": 0, "days_used": 0, "days_planned": 0,
            "days_remaining": 0, "days_requested": days_requested,
            "remaining_after_request": 0, "negative_allowed": False,
        }

    avail = float(row[0] or 0)
    used  = float(row[1] or 0)
    plan  = float(row[2] or 0)
    neg   = bool(row[3])
    remaining = avail - used - plan
    after = remaining - days_requested

    if after >= 0:
        ok, reason = True, "OK"
    elif not neg:
        ok, reason = False, "Saldo insuficiente"
    elif after < max_negative_days:
        ok, reason = False, f"Saldo negativo excede el máximo de {abs(max_negative_days)} días"
    else:
        ok, reason = True, "OK con saldo negativo permitido"

    return {
        "available": ok, "reason": reason,
        "days_available": avail, "days_used": used, "days_planned": plan,
        "days_remaining": remaining, "days_requested": days_requested,
        "remaining_after_request": after, "negative_allowed": neg,
        "max_negative_days": max_negative_days,
    }


def _update_planned_days(user_id: int, leave_type_id: int, year: int, delta: float) -> None:
    """Suma delta a PlannedDays; ignora si no existe el registro."""
    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_LEAVE_BALANCE
                SET PlannedDays = PlannedDays + :delta
                WHERE User_Id=:u AND LeaveType_Id=:lt AND Year=:yr
            """),
            {"delta": delta, "u": user_id, "lt": leave_type_id, "yr": year},
        )


# ── Tipos de licencia ─────────────────────────────────────────────────────────

async def list_leave_types(company_id: int, is_active: bool = True) -> List[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT LeaveType_Id, Name, Description, Color, DefaultDays,
                       RequiresDocument, IsActive, Company_Id,
                       CreatedAt, UpdatedAt
                FROM ERP_HR_LEAVE_TYPES
                WHERE Company_Id=:c AND IsActive=:ia
                ORDER BY Name
            """),
            {"c": company_id, "ia": 1 if is_active else 0},
        ).mappings().all()
    return [dict(r) for r in rows]


async def get_leave_type(leave_type_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT LeaveType_Id, Name, Description, Color, DefaultDays,
                       RequiresDocument, IsActive, Company_Id,
                       CreatedAt, UpdatedAt
                FROM ERP_HR_LEAVE_TYPES WHERE LeaveType_Id=:id
            """),
            {"id": leave_type_id},
        ).mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tipo de licencia no encontrado")
    return dict(row)


async def create_leave_type(data) -> dict:
    d = data.model_dump()
    with get_transaction() as conn:
        conn.execute(
            text("""
                INSERT INTO ERP_HR_LEAVE_TYPES
                  (Name, Description, Color, DefaultDays, RequiresDocument, IsActive, Company_Id)
                VALUES (:name, :desc, :color, :days, :req, :active, :cid)
            """),
            {
                "name": d["name"], "desc": d.get("description"),
                "color": d.get("color", "#0066CC"), "days": d["default_days"],
                "req": int(d.get("requires_document", False)),
                "active": int(d.get("is_active", True)), "cid": d["company_id"],
            },
        )
    # Devolver el registro recién creado
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT TOP 1 LeaveType_Id, Name, Description, Color, DefaultDays,
                       RequiresDocument, IsActive, Company_Id, CreatedAt, UpdatedAt
                FROM ERP_HR_LEAVE_TYPES
                WHERE Company_Id=:c AND Name=:n
                ORDER BY LeaveType_Id DESC
            """),
            {"c": d["company_id"], "n": d["name"]},
        ).mappings().fetchone()
    return dict(row)


# ── Solicitudes de vacaciones ─────────────────────────────────────────────────

async def create_leave_request(
    data: dict,
    requesting_user_id: int,
    is_admin: bool,
    company_id: int,
) -> dict:
    """
    Crea solicitud en ERP_HR_VACATION_REQUEST con todas las validaciones.
    Permisos: empleado solo puede pedir para sí mismo; admin puede pedir para otros.
    """
    user_id       = data["user_id"]
    leave_type_id = data["leave_type_id"]
    start_date    = data["start_date"]
    end_date      = data["end_date"]
    razon         = data.get("razon", "")

    # Permiso: empleado solo para sí mismo
    if not is_admin and user_id != requesting_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes solicitar vacaciones para ti mismo",
        )

    # Validar empresa
    _check_user_in_company(user_id, company_id)
    _check_leave_type_in_company(leave_type_id, company_id)
    _check_user_active(user_id)

    # Validar fechas
    days = validate_leave_dates(start_date, end_date)

    # Sin duplicados exactos
    validate_exact_duplicate(user_id, start_date, end_date, leave_type_id)

    # Sin traslapes
    validate_overlap(user_id, start_date, end_date)

    # Saldo disponible
    year = start_date.year if isinstance(start_date, date) else start_date[:4]
    balance = await check_balance_availability(user_id, leave_type_id, days, year)
    if not balance["available"]:
        raise HTTPException(status_code=400, detail=balance["reason"])

    # INSERT
    with get_transaction() as conn:
        conn.execute(
            text("""
                INSERT INTO ERP_HR_VACATION_REQUEST
                  (User_Id, FechaInicio, FechaFin, Cantidad, Razon, Estatus,
                   LeaveTypeId, IsActive, CreatedAt, UpdatedAt, CreatedBy)
                VALUES
                  (:uid, :fi, :ff, :cant, :razon, 'Pendiente',
                   :lt, 1, GETDATE(), GETDATE(), :cby)
            """),
            {
                "uid": user_id, "fi": start_date, "ff": end_date,
                "cant": days, "razon": razon, "lt": leave_type_id,
                "cby": requesting_user_id,
            },
        )

    # Actualizar PlannedDays en el saldo
    _update_planned_days(user_id, leave_type_id, int(year), days)

    # Devolver la solicitud recién creada
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT TOP 1 Vacaciones_Id, User_Id, FechaInicio, FechaFin, Cantidad,
                       Razon, Estatus, LeaveTypeId, CreatedAt
                FROM ERP_HR_VACATION_REQUEST
                WHERE User_Id=:u AND FechaInicio=:fi AND FechaFin=:ff
                ORDER BY Vacaciones_Id DESC
            """),
            {"u": user_id, "fi": start_date, "ff": end_date},
        ).mappings().fetchone()

    return {
        **dict(row),
        "days_requested": days,
        "balance_after": balance["remaining_after_request"],
    }


async def list_leave_requests(
    company_id: int,
    current_user_id: int,
    is_admin: bool,
    user_id_filter: Optional[int] = None,
    estatus: Optional[str] = None,
    year: Optional[int] = None,
) -> List[dict]:
    """Lista solicitudes. Empleados solo ven las propias; admin ve todas de su empresa."""
    with get_connection() as conn:
        conditions = [
            "EXISTS (SELECT 1 FROM ERP_USERCOMPANIES uc WHERE uc.User_Id=v.User_Id AND uc.Company_Id=:cid)",
            "v.IsActive=1",
        ]
        params: dict = {"cid": company_id}

        if not is_admin:
            conditions.append("v.User_Id=:uid")
            params["uid"] = current_user_id
        elif user_id_filter:
            conditions.append("v.User_Id=:uid")
            params["uid"] = user_id_filter

        if estatus:
            conditions.append("v.Estatus=:est")
            params["est"] = estatus

        if year:
            conditions.append("YEAR(v.FechaInicio)=:yr")
            params["yr"] = year

        where = "WHERE " + " AND ".join(conditions)
        rows = conn.execute(
            text(f"""
                SELECT
                    v.Vacaciones_Id, v.User_Id,
                    TRIM(u.Name + ' ' + ISNULL(u.Lastname,'')) AS NombreEmpleado,
                    v.FechaInicio, v.FechaFin, v.Cantidad, v.Razon,
                    v.Observaciones, v.Estatus, v.LeaveTypeId,
                    lt.Name AS TipoLicencia,
                    v.AprobadoPor, v.FechaAprobacion, v.CreatedAt
                FROM ERP_HR_VACATION_REQUEST v
                LEFT JOIN ERP_USER u ON u.User_Id = v.User_Id
                LEFT JOIN ERP_HR_LEAVE_TYPES lt ON lt.LeaveType_Id = v.LeaveTypeId
                {where}
                ORDER BY v.CreatedAt DESC
            """),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


async def approve_leave_request(
    vacaciones_id: int,
    estatus: str,
    observaciones: Optional[str],
    aprobado_por: int,
) -> dict:
    if estatus not in ("Aprobado", "Rechazado"):
        raise HTTPException(status_code=400, detail="Estatus debe ser 'Aprobado' o 'Rechazado'")

    with get_connection() as conn:
        row = conn.execute(
            text("SELECT Estatus, User_Id, Cantidad, LeaveTypeId, YEAR(FechaInicio) FROM ERP_HR_VACATION_REQUEST WHERE Vacaciones_Id=:id AND IsActive=1"),
            {"id": vacaciones_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    current_status, user_id, cantidad, lt_id, year = row

    if current_status not in ("Pendiente",):
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden aprobar/rechazar solicitudes Pendientes (actual: {current_status})",
        )

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_VACATION_REQUEST SET
                  Estatus=:est, AprobadoPor=:apby, FechaAprobacion=GETDATE(),
                  Observaciones=COALESCE(:obs, Observaciones), UpdatedAt=GETDATE()
                WHERE Vacaciones_Id=:id
            """),
            {"est": estatus, "apby": aprobado_por, "obs": observaciones, "id": vacaciones_id},
        )

    # Ajustar PlannedDays: quitar de planeado, sumar a usado si se aprueba
    if lt_id and year:
        if estatus == "Aprobado":
            _update_planned_days(user_id, lt_id, year, -float(cantidad or 0))
            with get_transaction() as conn:
                conn.execute(
                    text("""
                        UPDATE ERP_HR_LEAVE_BALANCE
                        SET UsedDays = UsedDays + :days
                        WHERE User_Id=:u AND LeaveType_Id=:lt AND Year=:yr
                    """),
                    {"days": float(cantidad or 0), "u": user_id, "lt": lt_id, "yr": year},
                )
        elif estatus == "Rechazado":
            _update_planned_days(user_id, lt_id, year, -float(cantidad or 0))

    return {"msg": f"Solicitud {estatus.lower()}", "vacaciones_id": vacaciones_id}


async def cancel_leave_request(vacaciones_id: int, current_user_id: int, is_admin: bool) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT Estatus, User_Id, Cantidad, LeaveTypeId, YEAR(FechaInicio) FROM ERP_HR_VACATION_REQUEST WHERE Vacaciones_Id=:id AND IsActive=1"),
            {"id": vacaciones_id},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    current_status, user_id, cantidad, lt_id, year = row

    # Solo el propio empleado o admin puede cancelar
    if not is_admin and user_id != current_user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar esta solicitud")

    if current_status not in ("Pendiente", "Aprobado"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cancelar una solicitud en estado {current_status}",
        )

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_HR_VACATION_REQUEST SET Estatus='Cancelado', UpdatedAt=GETDATE() WHERE Vacaciones_Id=:id"),
            {"id": vacaciones_id},
        )

    # Revertir saldo
    if lt_id and year:
        if current_status == "Pendiente":
            _update_planned_days(user_id, lt_id, year, -float(cantidad or 0))
        elif current_status == "Aprobado":
            with get_transaction() as conn:
                conn.execute(
                    text("""
                        UPDATE ERP_HR_LEAVE_BALANCE
                        SET UsedDays = UsedDays - :days
                        WHERE User_Id=:u AND LeaveType_Id=:lt AND Year=:yr
                    """),
                    {"days": float(cantidad or 0), "u": user_id, "lt": lt_id, "yr": year},
                )

    return {"msg": "Solicitud cancelada", "vacaciones_id": vacaciones_id}


# ── Días festivos ─────────────────────────────────────────────────────────────

async def get_public_holidays(company_id: int, year: Optional[int] = None) -> List[dict]:
    with get_connection() as conn:
        params: dict = {"c": company_id}
        year_clause = "AND YEAR(HolidayDate)=:yr" if year else ""
        if year:
            params["yr"] = year
        rows = conn.execute(
            text(f"""
                SELECT Holiday_Id, Company_Id, HolidayDate, Name, Description,
                       IsObligatory, IsRecurring, RecurringMonth, RecurringDay,
                       CreatedAt, UpdatedAt
                FROM ERP_PUBLIC_HOLIDAYS
                WHERE Company_Id=:c {year_clause}
                ORDER BY HolidayDate
            """),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


async def create_public_holiday(data) -> dict:
    d = data.model_dump()
    with get_transaction() as conn:
        conn.execute(
            text("""
                INSERT INTO ERP_PUBLIC_HOLIDAYS
                  (Company_Id, HolidayDate, Name, Description,
                   IsObligatory, IsRecurring, RecurringMonth, RecurringDay)
                VALUES (:cid, :hd, :name, :desc, :oblig, :recur, :rm, :rd)
            """),
            {
                "cid": d["company_id"], "hd": d["holiday_date"],
                "name": d["name"], "desc": d.get("description"),
                "oblig": int(d.get("is_obligatory", True)),
                "recur": int(d.get("is_recurring", False)),
                "rm": d.get("recurring_month"), "rd": d.get("recurring_day"),
            },
        )
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT TOP 1 Holiday_Id, Company_Id, HolidayDate, Name, Description,
                       IsObligatory, IsRecurring, RecurringMonth, RecurringDay,
                       CreatedAt, UpdatedAt
                FROM ERP_PUBLIC_HOLIDAYS
                WHERE Company_Id=:c AND Name=:n
                ORDER BY Holiday_Id DESC
            """),
            {"c": d["company_id"], "n": d["name"]},
        ).mappings().fetchone()
    return dict(row)


# ── Utilidades (días laborales) ───────────────────────────────────────────────

async def is_working_day(check_date: datetime, company_id: int) -> bool:
    d = check_date if isinstance(check_date, date) else check_date.date()
    if d.weekday() >= 5:  # sábado=5, domingo=6
        return False
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT 1 FROM ERP_PUBLIC_HOLIDAYS
                WHERE Company_Id=:c AND (
                  (IsRecurring=0 AND CAST(HolidayDate AS DATE) = :d)
                  OR (IsRecurring=1 AND RecurringMonth=:mo AND RecurringDay=:dy)
                )
            """),
            {"c": company_id, "d": d, "mo": d.month, "dy": d.day},
        ).fetchone()
    return row is None


async def calculate_working_days(
    start: datetime,
    end: datetime,
    company_id: int,
    include_weekends: bool = False,
) -> int:
    s = start.date() if hasattr(start, "date") else start
    e = end.date() if hasattr(end, "date") else end
    count = 0
    current = s
    while current <= e:
        if include_weekends:
            is_wd = True
        else:
            is_wd = await is_working_day(datetime.combine(current, datetime.min.time()), company_id)
        if is_wd:
            count += 1
        from datetime import timedelta
        current += timedelta(days=1)
    return count
