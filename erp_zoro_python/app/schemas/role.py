from __future__ import annotations

from pydantic import BaseModel


class RoleModuleUpdate(BaseModel):
    isEnabled: bool
