from __future__ import annotations

from pydantic import BaseModel


class PermissionItem(BaseModel):
    ModuleKey: str
    CanAccess: bool


class PermissionUpdateRequest(BaseModel):
    permissions: list[PermissionItem]
