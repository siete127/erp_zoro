from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import mantenimiento_service


router = APIRouter()


class EquipoCreate(BaseModel):
    Company_Id: int
    Nombre: str
    Categoria: str | None = None
    NumeroSerie: str | None = None
    Ubicacion: str | None = None
    Activo_Id: int | None = None
    Responsable_Id: int | None = None
    FechaInstalacion: str | None = None
    Estatus: str = "OPERATIVO"
    Notas: str | None = None


class EquipoUpdate(BaseModel):
    Nombre: str | None = None
    Categoria: str | None = None
    NumeroSerie: str | None = None
    Ubicacion: str | None = None
    Activo_Id: int | None = None
    Responsable_Id: int | None = None
    FechaInstalacion: str | None = None
    Estatus: str | None = None
    Notas: str | None = None


class OrdenCreate(BaseModel):
    Company_Id: int
    Equipo_Id: int
    Tipo: str
    Titulo: str
    Descripcion: str | None = None
    Tecnico_Id: int | None = None
    FechaProgramada: str | None = None
    Costo: float | None = None


class OrdenUpdate(BaseModel):
    Tipo: str | None = None
    Titulo: str | None = None
    Descripcion: str | None = None
    Tecnico_Id: int | None = None
    FechaProgramada: str | None = None
    FechaInicio: str | None = None
    FechaFin: str | None = None
    Estatus: str | None = None
    Costo: float | None = None


class CompletarBody(BaseModel):
    costo: float | None = None


# ─── EQUIPOS ────────────────────────────────────────────────

@router.get("/equipos")
def list_equipos(
    company_id: int | None = Query(default=None),
    estatus: str | None = Query(default=None),
    categoria: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return mantenimiento_service.list_equipos(
        current_user,
        {"company_id": company_id, "estatus": estatus, "categoria": categoria},
    )


@router.get("/equipos/{equipo_id}")
def get_equipo(
    equipo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.get_equipo(equipo_id, current_user)


@router.post("/equipos")
def create_equipo(
    payload: EquipoCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.create_equipo(payload.model_dump(exclude_none=True), current_user)


@router.put("/equipos/{equipo_id}")
def update_equipo(
    equipo_id: int,
    payload: EquipoUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.update_equipo(equipo_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/equipos/{equipo_id}")
def delete_equipo(
    equipo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.delete_equipo(equipo_id, current_user)


# ─── ÓRDENES ────────────────────────────────────────────────

@router.get("/ordenes")
def list_ordenes(
    company_id: int | None = Query(default=None),
    equipo_id: int | None = Query(default=None),
    estatus: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    tecnico_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return mantenimiento_service.list_ordenes(
        current_user,
        {
            "company_id": company_id,
            "equipo_id": equipo_id,
            "estatus": estatus,
            "tipo": tipo,
            "tecnico_id": tecnico_id,
        },
    )


@router.get("/ordenes/{orden_id}")
def get_orden(
    orden_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.get_orden(orden_id, current_user)


@router.post("/ordenes")
def create_orden(
    payload: OrdenCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.create_orden(payload.model_dump(exclude_none=True), current_user)


@router.put("/ordenes/{orden_id}")
def update_orden(
    orden_id: int,
    payload: OrdenUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.update_orden(orden_id, payload.model_dump(exclude_none=True), current_user)


@router.post("/ordenes/{orden_id}/iniciar")
def iniciar_orden(
    orden_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.iniciar_orden(orden_id, current_user)


@router.post("/ordenes/{orden_id}/completar")
def completar_orden(
    orden_id: int,
    body: CompletarBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.completar_orden(orden_id, body.costo, current_user)


@router.delete("/ordenes/{orden_id}")
def delete_orden(
    orden_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return mantenimiento_service.delete_orden(orden_id, current_user)
