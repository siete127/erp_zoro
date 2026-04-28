from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import require_super_admin
from app.services import company_admin_service

router = APIRouter()


class AdminCreate(BaseModel):
    Username: str
    Password: str
    Name: str | None = None
    Lastname: str | None = None
    Email: str | None = None
    PhoneNumber: str | None = None
    Area: str | None = None


class AdminUpdate(BaseModel):
    Name: str | None = None
    Lastname: str | None = None
    Email: str | None = None
    IsActive: bool | None = None
    Password: str | None = None


@router.get("/{company_id}/admins")
def list_company_admins(
    company_id: int,
    _: dict[str, Any] = Depends(require_super_admin),
) -> list[dict]:
    return company_admin_service.list_admins(company_id)


@router.post("/{company_id}/admins")
def create_company_admin(
    company_id: int,
    payload: AdminCreate,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict:
    creator_id = int(current_user.get("User_Id") or 1)
    return company_admin_service.create_company_admin(company_id, payload.model_dump(), creator_id)


@router.put("/{company_id}/admins/{user_id}")
def update_company_admin(
    company_id: int,
    user_id: int,
    payload: AdminUpdate,
    _: dict[str, Any] = Depends(require_super_admin),
) -> dict:
    return company_admin_service.update_company_admin(company_id, user_id, payload.model_dump())


@router.delete("/{company_id}/admins/{user_id}")
def remove_company_admin(
    company_id: int,
    user_id: int,
    _: dict[str, Any] = Depends(require_super_admin),
) -> dict:
    return company_admin_service.remove_company_admin(company_id, user_id)
