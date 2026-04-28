from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.services import sat_service


router = APIRouter()


@router.get("/prodserv")
def search_prodserv(
    search: str = Query(default=""),
    page: int = Query(default=1),
    limit: int = Query(default=20),
    _: dict = Depends(get_current_user),
) -> dict:
    return sat_service.search_prodserv(search, page, limit)


@router.get("/prodserv/{clave}")
def get_prodserv(clave: str, _: dict = Depends(get_current_user)) -> dict:
    item = sat_service.get_prodserv(clave)
    if not item:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    return item


@router.get("/unidades")
def search_unidades(
    search: str = Query(default=""),
    _: dict = Depends(get_current_user),
) -> dict:
    return sat_service.search_unidades(search)


@router.get("/unidades/{clave}")
def get_unidad(clave: str, _: dict = Depends(get_current_user)) -> dict:
    item = sat_service.get_unidad(clave)
    if not item:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    return item
