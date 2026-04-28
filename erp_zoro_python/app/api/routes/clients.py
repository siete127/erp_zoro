from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.client import (
    ClientAddressInput,
    ClientContactInput,
    ClientCreate,
    ClientFinancialInput,
    ClientToggleActiveRequest,
    ClientUpdate,
    RecurringProductCreate,
)
from app.services import client_service


router = APIRouter()


@router.get("/meta")
def clients_meta(_: dict = Depends(get_current_user)) -> dict:
    return client_service.meta()


@router.get("/")
def list_clients(
    company_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.list_clients(current_user, company_id)


@router.post("/")
def create_client(
    payload: ClientCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.create_client(payload.model_dump(), current_user)


@router.get("/{client_id}")
def get_client(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.get_client(client_id, current_user)


@router.patch("/{client_id}/active")
def toggle_active(
    client_id: int,
    payload: ClientToggleActiveRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.toggle_active(client_id, payload.IsActive, current_user)


@router.put("/{client_id}")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.update_client(client_id, payload.model_dump(), current_user)


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.delete_client(client_id, current_user)


@router.get("/{client_id}/addresses")
def list_addresses(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.list_addresses(client_id, current_user)


@router.post("/{client_id}/addresses")
def create_address(
    client_id: int,
    payload: ClientAddressInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.create_address(client_id, payload.model_dump(), current_user)


@router.put("/{client_id}/addresses/{address_id}")
def update_address(
    client_id: int,
    address_id: int,
    payload: ClientAddressInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.update_address(
        client_id,
        address_id,
        payload.model_dump(),
        current_user,
    )


@router.delete("/{client_id}/addresses/{address_id}")
def delete_address(
    client_id: int,
    address_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.delete_address(client_id, address_id, current_user)


@router.get("/{client_id}/contacts")
def list_contacts(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.list_contacts(client_id, current_user)


@router.post("/{client_id}/contacts")
def create_contact(
    client_id: int,
    payload: ClientContactInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.create_contact(client_id, payload.model_dump(), current_user)


@router.put("/{client_id}/contacts/{contact_id}")
def update_contact(
    client_id: int,
    contact_id: int,
    payload: ClientContactInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.update_contact(
        client_id,
        contact_id,
        payload.model_dump(),
        current_user,
    )


@router.delete("/{client_id}/contacts/{contact_id}")
def delete_contact(
    client_id: int,
    contact_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.delete_contact(client_id, contact_id, current_user)


@router.get("/{client_id}/financial")
def get_financial(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.get_financial(client_id, current_user)


@router.put("/{client_id}/financial")
def upsert_financial(
    client_id: int,
    payload: ClientFinancialInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.upsert_financial(
        client_id,
        payload.model_dump(),
        current_user,
    )


@router.get("/{client_id}/recurring-products")
def get_recurring_products(
    client_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.get_recurring_products(client_id, current_user)


@router.post("/{client_id}/recurring-products")
def add_recurring_product(
    client_id: int,
    payload: RecurringProductCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.add_recurring_product(
        client_id,
        payload.Producto_Id,
        current_user,
    )


@router.delete("/{client_id}/recurring-products/{product_id}")
def remove_recurring_product(
    client_id: int,
    product_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return client_service.remove_recurring_product(client_id, product_id, current_user)
