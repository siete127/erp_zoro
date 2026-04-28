from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_admin
from app.services import licencia_service


router = APIRouter()


@router.get("/tipos")
def list_license_types(current_user: dict = Depends(require_admin)) -> dict:
    return {"items": licencia_service.list_license_types()}


@router.get("/")
def list_licenses(
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(require_admin),
) -> dict:
    return {"items": licencia_service.list_licenses(current_user, company_id)}


@router.post("/")
def create_license(
    payload: dict,
    current_user: dict = Depends(require_admin),
) -> dict:
    return licencia_service.create_license(payload, current_user)


@router.put("/{licencia_id}")
def update_license(
    licencia_id: int,
    payload: dict,
    current_user: dict = Depends(require_admin),
) -> dict:
    return licencia_service.update_license(licencia_id, payload, current_user)


@router.delete("/{licencia_id}")
def delete_license(
    licencia_id: int,
    current_user: dict = Depends(require_admin),
) -> dict:
    return licencia_service.delete_license(licencia_id, current_user)
