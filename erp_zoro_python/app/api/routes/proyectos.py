from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import proyecto_service


router = APIRouter()


class ProyectoCreate(BaseModel):
    Company_Id: int
    Nombre: str
    Client_Id: int | None = None
    Responsable_Id: int | None = None
    FechaInicio: str | None = None
    FechaFin: str | None = None
    PresupuestoHoras: float | None = None
    PresupuestoCosto: float | None = None
    Status: str = "ACTIVO"
    Descripcion: str | None = None


class ProyectoUpdate(BaseModel):
    Nombre: str | None = None
    Client_Id: int | None = None
    Responsable_Id: int | None = None
    FechaInicio: str | None = None
    FechaFin: str | None = None
    PresupuestoHoras: float | None = None
    PresupuestoCosto: float | None = None
    Status: str | None = None
    Descripcion: str | None = None


@router.get("/")
def list_proyectos(
    company_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    responsable_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return proyecto_service.list_proyectos(
        current_user,
        {
            "company_id": company_id,
            "status": status,
            "responsable_id": responsable_id,
        },
    )


@router.get("/{proyecto_id}")
def get_proyecto(
    proyecto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proyecto_service.get_proyecto(proyecto_id, current_user)


@router.post("/")
def create_proyecto(
    payload: ProyectoCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proyecto_service.create_proyecto(payload.model_dump(exclude_none=True), current_user)


@router.put("/{proyecto_id}")
def update_proyecto(
    proyecto_id: int,
    payload: ProyectoUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proyecto_service.update_proyecto(proyecto_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/{proyecto_id}")
def delete_proyecto(
    proyecto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return proyecto_service.delete_proyecto(proyecto_id, current_user)
