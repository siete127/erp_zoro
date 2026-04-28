from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.api.deps import get_current_user
from app.services import rh_service as svc
from app.schemas.rh import (
    PerfilRHUpsert,
    ContactoEmergenciaCreate,
    ContactoEmergenciaUpdate,
    CuentaBancariaCreate,
    CuentaBancariaUpdate,
)

router = APIRouter()


def _check_access(current_user: dict, target_user_id: int):
    is_super = current_user.get("isSuperAdmin", False)
    is_admin = current_user.get("isAdmin", False)
    companies = current_user.get("companies", [])
    user_id = current_user.get("User_Id")
    if not svc._can_access_user(user_id, target_user_id, companies, is_super, is_admin):
        raise HTTPException(status_code=403, detail="No tiene permisos para este usuario")


# ── Perfiles ─────────────────────────────────────────────────────────────────

@router.get("/perfiles")
def list_perfiles(
    company_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    is_super = current_user.get("isSuperAdmin", False)
    is_admin = current_user.get("isAdmin", False)
    companies = current_user.get("companies", [])
    user_id = current_user.get("User_Id")
    return svc.list_perfiles(user_id, companies, is_super, is_admin, company_id)


@router.get("/perfiles/{user_id}")
def get_perfil(user_id: int, current_user: dict = Depends(get_current_user)):
    _check_access(current_user, user_id)
    return svc.get_perfil(user_id)


@router.put("/perfiles/{user_id}")
def upsert_perfil(
    user_id: int,
    body: PerfilRHUpsert,
    current_user: dict = Depends(get_current_user),
):
    _check_access(current_user, user_id)
    return svc.upsert_perfil(user_id, body.model_dump(), current_user.get("User_Id"))


@router.post("/perfiles/{user_id}/foto")
async def upload_foto_perfil(
    user_id: int,
    fotoPerfil: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    _check_access(current_user, user_id)
    return await svc.upload_foto_perfil(user_id, fotoPerfil, current_user.get("User_Id"))


# ── Contactos de emergencia ──────────────────────────────────────────────────

@router.post("/perfiles/{user_id}/contactos-emergencia", status_code=201)
def create_contacto(
    user_id: int,
    body: ContactoEmergenciaCreate,
    current_user: dict = Depends(get_current_user),
):
    _check_access(current_user, user_id)
    data = svc.create_contacto_emergencia(user_id, body.model_dump(), current_user.get("User_Id"))
    return {"msg": "Contacto de emergencia creado", "data": data}


@router.put("/contactos-emergencia/{contacto_id}")
def update_contacto(
    contacto_id: int,
    body: ContactoEmergenciaUpdate,
    current_user: dict = Depends(get_current_user),
):
    return svc.update_contacto_emergencia(contacto_id, body.model_dump())


@router.delete("/contactos-emergencia/{contacto_id}")
def delete_contacto(contacto_id: int, current_user: dict = Depends(get_current_user)):
    return svc.delete_contacto_emergencia(contacto_id)


# ── Cuentas bancarias ────────────────────────────────────────────────────────

@router.post("/perfiles/{user_id}/cuentas-bancarias", status_code=201)
def create_cuenta(
    user_id: int,
    body: CuentaBancariaCreate,
    current_user: dict = Depends(get_current_user),
):
    _check_access(current_user, user_id)
    data = svc.create_cuenta_bancaria(user_id, body.model_dump(), current_user.get("User_Id"))
    return {"msg": "Cuenta bancaria creada", "data": data}


@router.put("/cuentas-bancarias/{cuenta_id}")
def update_cuenta(
    cuenta_id: int,
    body: CuentaBancariaUpdate,
    current_user: dict = Depends(get_current_user),
):
    return svc.update_cuenta_bancaria(cuenta_id, body.model_dump())


@router.delete("/cuentas-bancarias/{cuenta_id}")
def delete_cuenta(cuenta_id: int, current_user: dict = Depends(get_current_user)):
    return svc.delete_cuenta_bancaria(cuenta_id)


# ── Documentos ───────────────────────────────────────────────────────────────

@router.get("/perfiles/{user_id}/documentos")
def list_documentos(user_id: int, current_user: dict = Depends(get_current_user)):
    _check_access(current_user, user_id)
    return svc.list_documentos(user_id)


@router.post("/perfiles/{user_id}/documentos", status_code=201)
async def upload_documento(
    user_id: int,
    documento: UploadFile = File(...),
    TipoDocumento: Optional[str] = Form(None),
    Descripcion: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    _check_access(current_user, user_id)
    return await svc.upload_documento(
        user_id, documento, TipoDocumento, Descripcion, current_user.get("User_Id")
    )


@router.delete("/documentos/{documento_id}")
def delete_documento(documento_id: int, current_user: dict = Depends(get_current_user)):
    return svc.delete_documento(documento_id)
