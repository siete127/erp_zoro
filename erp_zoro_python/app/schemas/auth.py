from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(alias="username")
    password: str


class LogoutRequest(BaseModel):
    sessionId: int | None = None


class LoginResponse(BaseModel):
    token: str
    user: dict[str, Any]
    sessionId: int | None = None
