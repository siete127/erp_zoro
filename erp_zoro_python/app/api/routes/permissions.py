from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.permission import PermissionUpdateRequest
from app.services import permission_service


router = APIRouter()


@router.get("/modules")
def get_modules(_: dict[str, Any] = Depends(get_current_user)) -> dict:
    return permission_service.get_modules()


@router.get("/user/{user_id}")
def get_user_permissions(
    user_id: int,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return permission_service.get_user_permissions(user_id)


@router.put("/user/{user_id}")
def update_user_permissions(
    user_id: int,
    payload: PermissionUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    permissions = [item.model_dump() for item in payload.permissions]
    return permission_service.update_user_permissions(
        user_id,
        permissions,
        int(current_user["User_Id"]),
    )


@router.get("/check/{user_id}/{module_key}")
def check_permission(
    user_id: int,
    module_key: str,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return permission_service.check_permission(user_id, module_key)
