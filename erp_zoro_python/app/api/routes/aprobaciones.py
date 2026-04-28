from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user, require_admin
from app.services import aprobacion_service

router = APIRouter()


class ReglaUpsertBody(BaseModel):
    Regla_Id: int | None = None
    Company_Id: int
    Modulo: str
    MontoMinimo: float | None = None
    NivelesReq: int = 1
    Aprobador1_Id: int | None = None
    Aprobador2_Id: int | None = None
    Activo: bool = True


class DecisionBody(BaseModel):
    aprobado: bool
    comentarios: str | None = None


@router.get("/reglas")
def list_reglas(
    company_id: int = Query(...),
    current_user: dict[str, Any] = Depends(require_admin),
) -> list[dict]:
    return aprobacion_service.list_reglas(company_id, current_user)


@router.post("/reglas")
def upsert_regla(
    payload: ReglaUpsertBody,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return aprobacion_service.upsert_regla(payload.model_dump(), current_user)


@router.delete("/reglas/{regla_id}")
def delete_regla(
    regla_id: int,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return aprobacion_service.delete_regla(regla_id, current_user)


@router.get("/")
def list_aprobaciones(
    Modulo: str | None = Query(default=None),
    Estatus: str | None = Query(default=None),
    Company_Id: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return aprobacion_service.list_aprobaciones(
        current_user,
        {"Modulo": Modulo, "Estatus": Estatus, "Company_Id": Company_Id},
    )


@router.post("/{aprobacion_id}/decidir")
def decidir(
    aprobacion_id: int,
    body: DecisionBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return aprobacion_service.decidir_aprobacion(
        aprobacion_id,
        body.aprobado,
        body.comentarios,
        current_user,
    )
