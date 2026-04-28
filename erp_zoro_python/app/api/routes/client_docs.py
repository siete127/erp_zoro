from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.services import client_doc_service as svc

router = APIRouter()


@router.get("/{cliente_id}/documentos")
def list_documentos(cliente_id: int, current_user: dict = Depends(get_current_user)):
    return svc.list_documentos(cliente_id)


@router.post("/{cliente_id}/documentos")
async def upload_documento(
    cliente_id: int,
    tipo: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    return await svc.upload_documento(cliente_id, tipo, file, current_user)


@router.delete("/{cliente_id}/documentos/{doc_id}")
def delete_documento(
    cliente_id: int,
    doc_id: int,
    current_user: dict = Depends(get_current_user),
):
    return svc.delete_documento(doc_id, cliente_id)
