from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_admin
from app.services import audit_service


router = APIRouter()


@router.get("/modulos")
def get_modules(
    current_user: dict = Depends(require_admin),
) -> dict:
    return {"items": audit_service.list_modules(current_user)}


@router.get("/")
def list_logs(
    company_id: int | None = Query(default=None),
    modulo: str | None = Query(default=None),
    accion: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(require_admin),
) -> dict:
    return {
        "items": audit_service.list_audit_logs(
            current_user,
            company_id=company_id,
            modulo=modulo,
            accion=accion,
            user_id=user_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            limit=limit,
        )
    }
