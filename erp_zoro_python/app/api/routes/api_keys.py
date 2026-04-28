from __future__ import annotations

from typing import Any

from fastapi import Depends
from pydantic import BaseModel

from app.api.router_utils import APIRouter
from app.api.deps import require_admin
from app.services import apikey_service

router = APIRouter()


class ApiKeyCreate(BaseModel):
    Company_Id: int
    Name: str
    Scopes: str | None = None
    ExpiresAt: str | None = None


class ApiKeyToggle(BaseModel):
    IsActive: bool


@router.get("/")
def list_keys(
    company_id: int,
    current_user: dict[str, Any] = Depends(require_admin),
) -> list[dict[str, Any]]:
    return apikey_service.list_keys(current_user, company_id)


@router.post("/")
def create_key(
    body: ApiKeyCreate,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return apikey_service.create_key(body.model_dump(), current_user)


@router.patch("/{key_id}/toggle")
def toggle_key(
    key_id: int,
    body: ApiKeyToggle,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return apikey_service.toggle_key(key_id, body.IsActive, current_user)


@router.delete("/{key_id}")
def delete_key(
    key_id: int,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return apikey_service.delete_key(key_id, current_user)
