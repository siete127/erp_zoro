from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.services import tarea_service as svc

router = APIRouter()


@router.get("/")
def list_tareas(
    company_id: int = Query(...),
    estado: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
    asignado_a: int | None = Query(default=None),
    proyecto_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    return svc.list_tareas(
        {
            "company_id": company_id,
            "estado": estado,
            "prioridad": prioridad,
            "asignado_a": asignado_a,
            "proyecto_id": proyecto_id,
        },
        current_user,
    )


@router.post("/")
def create_tarea(payload: dict, current_user: dict = Depends(get_current_user)):
    return svc.create_tarea(payload, current_user)


@router.get("/{tarea_id}")
def get_tarea(tarea_id: int, current_user: dict = Depends(get_current_user)):
    return svc.get_tarea(tarea_id, current_user)


@router.put("/{tarea_id}")
def update_tarea(tarea_id: int, payload: dict, current_user: dict = Depends(get_current_user)):
    return svc.update_tarea(tarea_id, payload, current_user)


@router.delete("/{tarea_id}")
def delete_tarea(tarea_id: int, current_user: dict = Depends(get_current_user)):
    return svc.delete_tarea(tarea_id, current_user)
