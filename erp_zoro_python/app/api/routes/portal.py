from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Path

from app.api.deps import get_current_user, require_admin
from app.services import portal_service


router = APIRouter()


# ─── Endpoints públicos — autenticados por token de cliente, sin JWT ────────

@router.get("/{token}")
def get_cliente_info(token: str = Path(...)) -> dict[str, Any]:
    return portal_service.get_cliente_info(token)


@router.get("/{token}/cotizaciones")
def get_cotizaciones(token: str = Path(...)) -> list[dict]:
    return portal_service.get_cotizaciones(token)


@router.get("/{token}/cotizaciones/{cotizacion_id}")
def get_cotizacion_detalle(
    token: str = Path(...),
    cotizacion_id: int = Path(...),
) -> dict[str, Any]:
    return portal_service.get_cotizacion_detalle(token, cotizacion_id)


@router.post("/{token}/cotizaciones/{cotizacion_id}/aprobar")
def aprobar_cotizacion(
    token: str = Path(...),
    cotizacion_id: int = Path(...),
) -> dict[str, Any]:
    return portal_service.aprobar_cotizacion(token, cotizacion_id)


@router.get("/{token}/facturas")
def get_facturas(token: str = Path(...)) -> list[dict]:
    return portal_service.get_facturas(token)


# ─── Endpoint interno — solo admin, genera/regenera token para un cliente ───

@router.post("/generar-token/{client_id}")
def generar_token(
    client_id: int,
    current_user: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    return portal_service.generar_token(client_id)
