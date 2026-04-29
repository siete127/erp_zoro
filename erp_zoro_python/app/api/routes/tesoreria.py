from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import tesoreria_service


router = APIRouter()


class CuentaCreate(BaseModel):
    Company_Id: int
    Banco: str
    NumCuenta: str | None = None
    Clabe: str | None = None
    Titular: str | None = None
    RFC: str | None = None
    Moneda: str = "MXN"
    SaldoInicial: float = 0


class ConciliarPayload(BaseModel):
    Pago_Id: int | None = None


class ImportarCSVPayload(BaseModel):
    csv_text: str


# ---- Cuentas ----

@router.get("/cuentas")
def list_cuentas(
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return tesoreria_service.list_cuentas(current_user, company_id)


@router.post("/cuentas")
def create_cuenta(payload: CuentaCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return tesoreria_service.create_cuenta(payload.model_dump(), current_user)


# ---- Movimientos ----

@router.get("/cuentas/{cuenta_id}/movimientos")
def list_movimientos(
    cuenta_id: int,
    conciliado: bool | None = Query(default=None),
    tipo: str | None = Query(default=None),
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return tesoreria_service.list_movimientos(cuenta_id, current_user, conciliado, tipo, fecha_desde, fecha_hasta)


@router.post("/cuentas/{cuenta_id}/importar")
def importar_csv(cuenta_id: int, payload: ImportarCSVPayload, current_user: dict = Depends(get_current_user)) -> dict:
    return tesoreria_service.importar_movimientos_csv(cuenta_id, payload.csv_text, current_user)


@router.post("/cuentas/{cuenta_id}/auto-conciliar")
def auto_conciliar(cuenta_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return tesoreria_service.auto_conciliar(cuenta_id, current_user)


@router.post("/movimientos/{movimiento_id}/conciliar")
def conciliar_movimiento(
    movimiento_id: int,
    payload: ConciliarPayload,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return tesoreria_service.conciliar_movimiento(movimiento_id, payload.Pago_Id, current_user)
