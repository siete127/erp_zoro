from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user
from app.services import chat_service as svc

router = APIRouter()

# Directorio de uploads del chat
_UPLOADS_CHAT = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "uploads", "chat"
)
_ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "video/mp4", "video/webm",
    "audio/mpeg", "audio/ogg", "audio/wav",
}
_MAX_SIZE = 20 * 1024 * 1024  # 20 MB


# ---------------------------------------------------------------------------
# Upload de archivos / fotos
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_archivo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Sube un archivo al servidor y devuelve la URL.
    El cliente luego manda esa URL en chat:send { archivo_url, tipo }.
    """
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido.")

    contents = await file.read()
    if len(contents) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 20 MB.")

    os.makedirs(_UPLOADS_CHAT, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".bin"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(_UPLOADS_CHAT, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    tipo = "imagen" if file.content_type.startswith("image/") else "archivo"
    url = f"/uploads/chat/{filename}"

    return {
        "url": url,
        "nombre": file.filename,
        "mime": file.content_type,
        "size": len(contents),
        "tipo": tipo,
    }


# ---------------------------------------------------------------------------
# Contactos (usuarios de la misma empresa)
# ---------------------------------------------------------------------------

@router.get("/contactos")
def get_contactos(
    company_id: int = Query(...),
    current_user: dict = Depends(get_current_user),
):
    return svc.get_contactos(company_id, current_user)


# ---------------------------------------------------------------------------
# Canales
# ---------------------------------------------------------------------------

@router.get("/canales")
def list_canales(
    company_id: int = Query(...),
    current_user: dict = Depends(get_current_user),
):
    return svc.list_canales(company_id, current_user)


@router.get("/canales/invitaciones")
def get_invitaciones(current_user: dict = Depends(get_current_user)):
    return svc.get_invitaciones_pendientes(current_user)


@router.post("/canales/directo")
def crear_directo(payload: dict, current_user: dict = Depends(get_current_user)):
    return svc.create_canal_directo(
        other_user_id=int(payload["other_user_id"]),
        company_id=int(payload["company_id"]),
        current_user=current_user,
    )


@router.post("/canales/grupo")
def crear_grupo(payload: dict, current_user: dict = Depends(get_current_user)):
    return svc.create_canal_grupo(
        nombre=str(payload.get("nombre", "")),
        invitados=[int(i) for i in (payload.get("invitados") or [])],
        company_id=int(payload["company_id"]),
        current_user=current_user,
    )


@router.post("/canales/empresa")
def canal_empresa(payload: dict, current_user: dict = Depends(get_current_user)):
    return svc.get_or_create_canal_empresa(
        company_id=int(payload["company_id"]),
        current_user=current_user,
    )


@router.get("/canales/{canal_id}")
def get_canal(canal_id: int, current_user: dict = Depends(get_current_user)):
    return svc.get_canal(canal_id, current_user)


@router.get("/canales/{canal_id}/miembros")
def get_miembros(canal_id: int, current_user: dict = Depends(get_current_user)):
    return svc.get_miembros_canal(canal_id, current_user)


@router.post("/canales/{canal_id}/aceptar")
def aceptar_invitacion(canal_id: int, current_user: dict = Depends(get_current_user)):
    return svc.aceptar_invitacion(canal_id, current_user)


# ---------------------------------------------------------------------------
# Mensajes
# ---------------------------------------------------------------------------

@router.get("/canales/{canal_id}/mensajes")
def get_mensajes(
    canal_id: int,
    limit: int = Query(default=50, le=100),
    before_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    return svc.get_mensajes(canal_id, current_user, limit=limit, before_id=before_id)


# ---------------------------------------------------------------------------
# Lecturas
# ---------------------------------------------------------------------------

@router.post("/canales/{canal_id}/leer")
def marcar_leido(canal_id: int, current_user: dict = Depends(get_current_user)):
    return svc.marcar_leido(canal_id, current_user)
