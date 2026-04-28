from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.services import notificacion_service as svc

router = APIRouter()


@router.get("/")
def list_notificaciones(
    limit: int = Query(default=20, ge=1, le=100),
    solo_no_leidas: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
):
    return svc.list_notificaciones(
        current_user=current_user,
        limit=limit,
        solo_no_leidas=solo_no_leidas,
    )


@router.patch("/leer-todas")
def mark_all_read(current_user: dict = Depends(get_current_user)):
    return svc.mark_all_read(current_user)


@router.patch("/{notif_id}/leer")
def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    return svc.mark_read(notif_id, current_user)
