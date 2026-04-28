from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import timesheet_service


router = APIRouter()


class TimesheetCreate(BaseModel):
    User_Id: int | None = None
    Tarea_Id: int | None = None
    Proyecto_Id: int | None = None
    Fecha: str
    HorasRegistradas: float
    Descripcion: str | None = None
    Facturable: bool = True


class TimesheetUpdate(BaseModel):
    User_Id: int | None = None
    Tarea_Id: int | None = None
    Proyecto_Id: int | None = None
    Fecha: str | None = None
    HorasRegistradas: float | None = None
    Descripcion: str | None = None
    Facturable: bool | None = None


@router.get("/")
def list_timesheets(
    company_id: int | None = Query(default=None),
    proyecto_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return timesheet_service.list_timesheets(
        current_user,
        {
            "company_id": company_id,
            "proyecto_id": proyecto_id,
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
        },
    )


@router.get("/resumen")
def get_resumen(
    company_id: int | None = Query(default=None),
    proyecto_id: int | None = Query(default=None),
    user_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return timesheet_service.get_resumen(
        current_user,
        {
            "company_id": company_id,
            "proyecto_id": proyecto_id,
            "user_id": user_id,
            "date_from": date_from,
            "date_to": date_to,
        },
    )


@router.post("/")
def create_timesheet(
    payload: TimesheetCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return timesheet_service.create_timesheet(payload.model_dump(exclude_none=True), current_user)


@router.put("/{timesheet_id}")
def update_timesheet(
    timesheet_id: int,
    payload: TimesheetUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return timesheet_service.update_timesheet(timesheet_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/{timesheet_id}")
def delete_timesheet(
    timesheet_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return timesheet_service.delete_timesheet(timesheet_id, current_user)
