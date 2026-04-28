from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.schemas.inventory import (
    InventoryConsolidadoUpdate,
    InventoryMovementCreate,
    InventoryRecepcionCancel,
    InventoryRecepcionCreate,
    InventoryTransferCreate,
    MPMachineEntryCreate,
    StockMPUpdate,
)
from app.services import inventory_service


router = APIRouter()


@router.get("/consolidado")
def list_consolidado(
    productoId: int | None = Query(default=None),
    company_id: int | None = Query(default=None),
    search: str = Query(default=""),
    clasificacion: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return inventory_service.list_consolidado(
        {
            "productoId": productoId,
            "company_id": company_id,
            "search": search,
            "clasificacion": clasificacion,
        },
        current_user,
    )


@router.put("/consolidado")
def update_consolidado(
    payload: InventoryConsolidadoUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.update_estado_consolidado(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/mp")
def list_stock_mp(
    company_id: int | None = Query(default=None),
    almacen_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.list_stock_mp(
        {
            "company_id": company_id,
            "almacen_id": almacen_id,
            "search": search,
        },
        current_user,
    )


@router.put("/mp")
def update_stock_mp(
    payload: StockMPUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.update_stock_mp(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/mp/maquinas")
def list_mp_machines(
    fecha: str | None = Query(default=None),
    tipo_maquina: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.list_materia_prima_por_maquina(
        {"fecha": fecha, "tipo_maquina": tipo_maquina},
        current_user,
    )


@router.post("/mp/maquinas")
def save_mp_machine(
    payload: MPMachineEntryCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.save_materia_prima_por_maquina(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/recepcion/pendientes")
def list_pending_reception(
    company_id: int | None = Query(default=None),
    productoId: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return inventory_service.list_recepcion_pendiente(
        {"company_id": company_id, "productoId": productoId},
        current_user,
    )


@router.post("/recepcion/registrar")
def register_pending_reception(
    payload: InventoryRecepcionCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.registrar_recepcion_pendiente(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/recepcion/cancelar")
def cancel_pending_reception(
    payload: InventoryRecepcionCancel,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.cancelar_recepcion_pendiente(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/")
def list_stock(
    productoId: int | None = Query(default=None),
    almacenId: int | None = Query(default=None),
    sku: str | None = Query(default=None),
    nombre: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return inventory_service.list_stock(
        {
            "productoId": productoId,
            "almacenId": almacenId,
            "sku": sku,
            "nombre": nombre,
            "company_id": company_id,
        },
        current_user,
    )


@router.get("/producto/{producto_id}")
def get_product_stock(
    producto_id: int,
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return inventory_service.get_stock_by_product(producto_id, current_user)


@router.post("/movimientos")
def register_inventory_movement(
    payload: InventoryMovementCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.registrar_movimiento(
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/kardex")
def list_kardex(
    productoId: int | None = Query(default=None),
    almacenId: int | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    return inventory_service.list_kardex(
        {
            "productoId": productoId,
            "almacenId": almacenId,
            "desde": desde,
            "hasta": hasta,
        },
        current_user,
    )


@router.post("/transferencias")
def transfer_inventory(
    payload: InventoryTransferCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return inventory_service.transferir(
        payload.model_dump(exclude_none=True),
        current_user,
    )
