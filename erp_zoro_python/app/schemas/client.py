from __future__ import annotations

from pydantic import BaseModel, Field


class ClientAddressInput(BaseModel):
    AddressType: str | None = None
    Street: str | None = None
    City: str | None = None
    State: str | None = None
    PostalCode: str | None = None
    Country: str | None = None
    IsPrimary: bool = False


class ClientContactInput(BaseModel):
    FullName: str | None = None
    PhoneNumber: str | None = None
    MobileNumber: str | None = None
    Email: str | None = None
    SecondaryEmail: str | None = None
    IsPrimary: bool = False


class ClientFinancialInput(BaseModel):
    HasCredit: bool = False
    CreditLimit: float = 0
    CreditDays: int = 0
    Currency: str | None = None
    PaymentMethod: str | None = None
    PaymentForm: str | None = None
    CreditStatus: str | None = None


class ClientCreate(BaseModel):
    LegalName: str
    CommercialName: str | None = None
    RFC: str | None = None
    TaxRegime: str | None = None
    ClientType: str | None = None
    Status: str | None = None
    Addresses: list[ClientAddressInput] = Field(default_factory=list)
    Contacts: list[ClientContactInput] = Field(default_factory=list)
    Company_Ids: list[int] = Field(default_factory=list)


class ClientUpdate(BaseModel):
    LegalName: str
    CommercialName: str | None = None
    RFC: str | None = None
    TaxRegime: str | None = None
    ClientType: str | None = None
    Status: str | None = None
    Addresses: list[ClientAddressInput] = Field(default_factory=list)
    Contacts: list[ClientContactInput] = Field(default_factory=list)
    Company_Ids: list[int] = Field(default_factory=list)


class ClientToggleActiveRequest(BaseModel):
    IsActive: bool | None = None


class RecurringProductCreate(BaseModel):
    Producto_Id: int
