from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel as _BaseModel

from app.api.deps import get_current_user, require_super_admin
from app.schemas.company import CompanyCreate, CompanyFiscalUpdate, CompanyUpdate
from app.services import company_service
from app.utils.company_access import can_access_company, user_company_ids


router = APIRouter()


@router.get("/")
def list_companies(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict]:
    if current_user.get("is_super_admin"):
        return company_service.list_companies()
    ids = user_company_ids(current_user)
    return [c for c in company_service.list_companies() if int(c.get("Company_Id", 0)) in ids]


@router.get("/debug/csds")
def debug_csds(_: dict[str, Any] = Depends(get_current_user)) -> dict:
    return company_service.listar_csds()


@router.get("/debug/csds/public")
def debug_csds_public() -> dict:
    return company_service.listar_csds()


@router.get("/csds")
def list_csds(_: dict[str, Any] = Depends(get_current_user)) -> dict:
    return company_service.listar_csds()


@router.post("/")
def create_company(
    payload: CompanyCreate,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict:
    return company_service.create_company(payload.model_dump())


@router.get("/{company_id}")
def get_company(
    company_id: int,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.get_company(company_id)


@router.get("/{company_id}/facturacion-status")
def facturacion_status(
    company_id: int,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.get_facturacion_status(company_id)


@router.post("/{company_id}/logo")
async def upload_logo(
    company_id: int,
    file: UploadFile = File(...),
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await company_service.upload_logo(company_id, file)


@router.put("/{company_id}")
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    if not current_user.get("is_super_admin") and not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="No tiene permisos para editar esta empresa")
    return company_service.update_company(company_id, payload.model_dump())


class FacturamaCredentialsBody(_BaseModel):
    FacturamaUser: str | None = None
    FacturamaPassword: str | None = None


@router.put("/{company_id}/facturama-credentials")
def update_facturama_credentials(
    company_id: int,
    body: FacturamaCredentialsBody,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.update_facturama_credentials(company_id, body.model_dump())


class CsdUploadBody(_BaseModel):
    cerBase64: str
    keyBase64: str
    passwordCsd: str


@router.post("/{company_id}/csd")
def upload_csd(
    company_id: int,
    body: CsdUploadBody,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.subir_csd(
        company_id,
        body.cerBase64,
        body.keyBase64,
        body.passwordCsd,
    )


@router.delete("/{company_id}/csd")
def delete_csd(
    company_id: int,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.eliminar_csd(company_id)


@router.put("/{company_id}/fiscal")
def update_company_fiscal(
    company_id: int,
    payload: CompanyFiscalUpdate,
    _: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return company_service.update_company_fiscal(company_id, payload.model_dump())


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict:
    return company_service.delete_company(company_id)
