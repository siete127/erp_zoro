from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import lead_service

router = APIRouter()


class LeadCreate(BaseModel):
    Company_Id: int
    Nombre: str
    Email: str | None = None
    Telefono: str | None = None
    Empresa: str | None = None
    Cargo: str | None = None
    Origen: str | None = None
    Asignado_Id: int | None = None
    Equipo_Id: int | None = None
    Notas: str | None = None


class LeadUpdate(BaseModel):
    Nombre: str | None = None
    Email: str | None = None
    Telefono: str | None = None
    Empresa: str | None = None
    Cargo: str | None = None
    Origen: str | None = None
    Status: str | None = None
    Asignado_Id: int | None = None
    Equipo_Id: int | None = None
    Notas: str | None = None


class ConvertirLeadBody(BaseModel):
    NombreOportunidad: str | None = None
    Client_Id: int | None = None
    MontoEstimado: float | None = None
    Probabilidad: int | None = None


class EquipoCreate(BaseModel):
    Company_Id: int
    Nombre: str
    Lider_Id: int | None = None
    miembros: list[int] = []


class EquipoUpdate(BaseModel):
    Nombre: str
    Lider_Id: int | None = None
    Activo: bool = True
    miembros: list[int] | None = None


# ── Leads ──────────────────────────────────────────────────────────────────

@router.get("/leads")
def list_leads(
    Company_Id: int | None = Query(default=None),
    Status: str | None = Query(default=None),
    Asignado_Id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return lead_service.list_leads(
        current_user,
        {"Company_Id": Company_Id, "Status": Status, "Asignado_Id": Asignado_Id},
    )


@router.get("/leads/{lead_id}")
def get_lead(
    lead_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.get_lead(lead_id, current_user)


@router.post("/leads")
def create_lead(
    payload: LeadCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.create_lead(payload.model_dump(exclude_none=True), current_user)


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.update_lead(lead_id, payload.model_dump(exclude_none=True), current_user)


@router.post("/leads/{lead_id}/convertir")
def convertir_lead(
    lead_id: int,
    payload: ConvertirLeadBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.convertir_a_oportunidad(lead_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/leads/{lead_id}")
def delete_lead(
    lead_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.delete_lead(lead_id, current_user)


# ── Equipos de venta ───────────────────────────────────────────────────────

@router.get("/equipos")
def list_equipos(
    Company_Id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return lead_service.list_equipos(current_user, Company_Id)


@router.get("/equipos/{equipo_id}")
def get_equipo(
    equipo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.get_equipo(equipo_id, current_user)


@router.post("/equipos")
def create_equipo(
    payload: EquipoCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.create_equipo(payload.model_dump(), current_user)


@router.put("/equipos/{equipo_id}")
def update_equipo(
    equipo_id: int,
    payload: EquipoUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.update_equipo(equipo_id, payload.model_dump(), current_user)


@router.delete("/equipos/{equipo_id}")
def delete_equipo(
    equipo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return lead_service.delete_equipo(equipo_id, current_user)
