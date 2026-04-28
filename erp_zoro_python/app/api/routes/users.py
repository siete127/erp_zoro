from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_admin
from app.schemas.user import ToggleActiveRequest, UserCreate, UserUpdate
from app.services import user_service


router = APIRouter()


@router.post("/register")
def register_user(
    payload: UserCreate,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return user_service.register_user(payload.model_dump(), current_user)


@router.get("/")
def list_users(
    company_id: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return user_service.list_users(current_user, company_id)


@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return user_service.get_user(user_id, current_user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return user_service.update_user(user_id, payload.model_dump(), current_user)


@router.patch("/{user_id}/active")
def toggle_active(
    user_id: int,
    payload: ToggleActiveRequest,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return user_service.toggle_active(user_id, payload.IsActive, current_user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict:
    return user_service.delete_user(user_id, current_user)
