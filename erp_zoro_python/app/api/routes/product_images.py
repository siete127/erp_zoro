from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.services import product_image_service as svc

router = APIRouter()


@router.get("/{producto_id}/imagenes")
def list_images(producto_id: int, current_user: dict = Depends(get_current_user)):
    return svc.list_images(producto_id)


@router.post("/{producto_id}/imagenes")
async def upload_image(
    producto_id: int,
    file: UploadFile = File(...),
    es_principal: bool = Form(default=False),
    current_user: dict = Depends(get_current_user),
):
    return await svc.upload_image(producto_id, file, es_principal, current_user)


@router.patch("/{producto_id}/imagenes/{imagen_id}/principal")
def set_principal(
    producto_id: int,
    imagen_id: int,
    current_user: dict = Depends(get_current_user),
):
    return svc.set_principal(imagen_id, producto_id)


@router.delete("/{producto_id}/imagenes/{imagen_id}")
def delete_image(
    producto_id: int,
    imagen_id: int,
    current_user: dict = Depends(get_current_user),
):
    return svc.delete_image(imagen_id, producto_id)
