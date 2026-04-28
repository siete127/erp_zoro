from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.role import RoleModuleUpdate
from app.services import role_service


router = APIRouter()


@router.get("/")
def list_roles(_: dict[str, Any] = Depends(get_current_user)) -> list[dict]:
    return role_service.list_roles()


@router.get("/{role_id}/modules")
def get_role_modules(
    role_id: int,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return role_service.get_role_modules(role_id)


@router.put("/{role_id}/modules/{module_key}")
def update_role_module(
    role_id: int,
    module_key: str,
    payload: RoleModuleUpdate,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return role_service.update_role_module(role_id, module_key, payload.isEnabled)
