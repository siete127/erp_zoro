from __future__ import annotations

from pydantic import BaseModel


class CompanyCreate(BaseModel):
    NameCompany: str | None = None
    Street: str | None = None
    Status: str | None = None
    EmailAprobacion1: str | None = None
    EmailAprobacion2: str | None = None


class CompanyUpdate(BaseModel):
    NameCompany: str | None = None
    Street: str | None = None
    Status: str | None = None
    RFC: str | None = None
    LegalName: str | None = None
    FiscalRegime: str | None = None
    TaxZipCode: str | None = None
    LogoUrl: str | None = None
    Email: str | None = None
    EmailAprobacion1: str | None = None
    EmailAprobacion2: str | None = None


class CompanyFiscalUpdate(BaseModel):
    RFC: str | None = None
    LegalName: str | None = None
    FiscalRegime: str | None = None
    TaxZipCode: str | None = None
    Email: str | None = None
