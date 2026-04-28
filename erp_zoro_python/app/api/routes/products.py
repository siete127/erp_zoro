from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.api.deps import get_current_user
from app.schemas.product import ProductCreate, ProductUpdate
from app.services import product_service


router = APIRouter()


@router.get("/")
def list_products(
    page: int | None = Query(default=None),
    limit: int | None = Query(default=None),
    search: str = Query(default=""),
    activo: str | None = Query(default=None),
    company_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return product_service.list_products(
        current_user,
        page,
        limit,
        search,
        activo,
        company_id,
    )


@router.post("/importar")
async def import_products(
    file: UploadFile = File(...),
    Company_Id: int | None = Form(default=None),
    company_id: int | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not file:
        raise HTTPException(status_code=400, detail="No se recibio archivo")
    cid = Company_Id or company_id
    if not cid:
        raise HTTPException(status_code=400, detail="Debe indicar Company_Id")
    content = await file.read()
    return product_service.import_products(content, file.filename or "import.xlsx", cid, current_user.get("User_Id"))


@router.get("/{product_id}")
def get_product(
    product_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return product_service.get_product(product_id, current_user)


@router.post("/")
def create_product(
    payload: ProductCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return product_service.create_product(payload.model_dump(), current_user)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return product_service.update_product(product_id, payload.model_dump(), current_user)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return product_service.delete_product(product_id, current_user)
