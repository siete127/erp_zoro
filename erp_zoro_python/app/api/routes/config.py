from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.config import ConfigEmailUpdate, PriceApprovalEmailUpdate
from app.services import config_service


router = APIRouter()


@router.get("/email-aprobacion")
def get_email_aprobacion(_: dict = Depends(get_current_user)) -> dict:
    return config_service.get_email_aprobacion()


@router.put("/email-aprobacion")
def update_email_aprobacion(
    payload: ConfigEmailUpdate,
    _: dict = Depends(get_current_user),
) -> dict:
    return config_service.update_email_aprobacion(payload.email)


@router.get("/precio-emails")
def get_price_approval_emails(
    company_id: int | None = Query(default=None),
    client_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return config_service.get_price_approval_emails(current_user, company_id, client_id)


@router.put("/precio-emails")
def update_price_approval_emails(
    payload: PriceApprovalEmailUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return config_service.update_price_approval_emails(
        current_user,
        payload.company_id,
        payload.email1,
        payload.email2,
    )
