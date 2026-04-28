from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field
from app.schemas.permission import PermissionItem


class UserCreate(BaseModel):
    Name: str | None = None
    Lastname: str | None = None
    Username: str
    Password: str
    Email: str | None = None
    PhoneNumber: str | None = None
    Area: str | None = None
    RolId: int | None = None
    IsActive: bool = True
    CreatedBy: int | None = None
    Company_Ids: list[int] = Field(default_factory=list)
    Permissions: list[PermissionItem] = Field(default_factory=list)


class UserUpdate(BaseModel):
    Name: str | None = None
    Lastname: str | None = None
    Email: str | None = None
    PhoneNumber: str | None = None
    Area: str | None = None
    RolId: int | None = None
    IsActive: bool | None = None
    Password: str | None = None
    Company_Ids: list[int] = Field(default_factory=list)


class ToggleActiveRequest(BaseModel):
    IsActive: bool


class GenericMessage(BaseModel):
    msg: str
    User_Id: int | None = None


class UserDetailResponse(BaseModel):
    data: dict[str, Any]
