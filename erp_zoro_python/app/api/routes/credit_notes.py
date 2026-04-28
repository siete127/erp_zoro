from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_current_user
from app.schemas.credit_note import CreditNoteCreate, CreditNoteStampRequest
from app.services import credit_note_service


router = APIRouter()


@router.post("/")
def create_credit_note(
    payload: CreditNoteCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return credit_note_service.create_credit_note(payload.model_dump(), current_user)


@router.post("/{note_id}/timbrar")
def stamp_credit_note(
    note_id: int,
    payload: CreditNoteStampRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return credit_note_service.stamp_credit_note(note_id, payload.model_dump(), current_user)


@router.get("/")
def list_credit_notes(
    Factura_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return credit_note_service.list_credit_notes(Factura_Id, current_user)


@router.get("/factura/{factura_id}/productos")
def get_invoice_products(
    factura_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return credit_note_service.get_invoice_products(factura_id, current_user)


@router.get("/{note_id}")
def get_credit_note_detail(
    note_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return credit_note_service.get_credit_note_detail(note_id, current_user)


@router.get("/{note_id}/pdf")
def download_credit_note_pdf(
    note_id: int,
    current_user: dict = Depends(get_current_user),
) -> Response:
    pdf_file = credit_note_service.download_credit_note_pdf(note_id, current_user)
    return Response(
        content=pdf_file["content"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdf_file["filename"]}"'},
    )
