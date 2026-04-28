from __future__ import annotations

from pydantic import BaseModel


class ConfigEmailUpdate(BaseModel):
    email: str


class PriceApprovalEmailUpdate(BaseModel):
    company_id: int | None = None
    email1: str | None = None
    email2: str | None = None
