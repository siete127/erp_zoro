from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.schemas.crm import (
    CrmActivityComplete,
    CrmActivityCreate,
    CrmOpportunityCloseRequest,
    CrmOpportunityCreate,
    CrmOpportunityStageChange,
    CrmOpportunityUpdate,
    CrmSendToProduction,
)
from app.services import crm_service


router = APIRouter()


@router.get("/etapas")
def get_etapas(current_user: dict = Depends(get_current_user)) -> dict:
    return crm_service.get_etapas()


@router.post("/oportunidades")
def create_oportunidad(
    payload: CrmOpportunityCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.create_opportunity(payload.model_dump(exclude_none=True), current_user)


@router.get("/oportunidades")
def list_oportunidades(
    Company_Id: int | None = Query(default=None),
    Etapa_Id: int | None = Query(default=None),
    Status: str | None = Query(default=None),
    Client_Id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.list_opportunities(
        {
            "Company_Id": Company_Id,
            "Etapa_Id": Etapa_Id,
            "Status": Status,
            "Client_Id": Client_Id,
        },
        current_user,
    )


@router.get("/oportunidades/{opportunity_id}")
def get_oportunidad_detalle(
    opportunity_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.get_opportunity_detail(opportunity_id, current_user)


@router.put("/oportunidades/{opportunity_id}")
def update_oportunidad(
    opportunity_id: int,
    payload: CrmOpportunityUpdate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.update_opportunity(
        opportunity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.put("/oportunidades/{opportunity_id}/etapa")
def change_oportunidad_stage(
    opportunity_id: int,
    payload: CrmOpportunityStageChange,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.change_opportunity_stage(
        opportunity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.put("/oportunidades/{opportunity_id}/cerrar")
def close_oportunidad(
    opportunity_id: int,
    payload: CrmOpportunityCloseRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.close_opportunity(
        opportunity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.delete("/oportunidades/{opportunity_id}")
def delete_oportunidad(
    opportunity_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.delete_opportunity(opportunity_id, current_user)


@router.get("/oportunidades/{opportunity_id}/actividades")
def list_actividades(
    opportunity_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.list_activities(opportunity_id, current_user)


@router.post("/oportunidades/{opportunity_id}/actividades")
def create_actividad(
    opportunity_id: int,
    payload: CrmActivityCreate,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.create_activity(
        opportunity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.put("/actividades/{activity_id}/completar")
def complete_actividad(
    activity_id: int,
    payload: CrmActivityComplete,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.complete_activity(
        activity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.post("/actividades/{activity_id}/enviar-produccion")
def send_actividad_to_production(
    activity_id: int,
    payload: CrmSendToProduction,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.send_activity_to_production(
        activity_id,
        payload.model_dump(exclude_none=True),
        current_user,
    )


@router.get("/clientes/{cliente_id}/historial-compras")
def get_historial_compras(
    cliente_id: int,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.get_historial_compras_cliente(cliente_id, current_user)


@router.get("/forecast")
def get_forecast(current_user: dict = Depends(get_current_user)) -> dict:
    return crm_service.get_forecast_por_etapa(current_user)


class VincularCotizacionBody(BaseModel):
    cotizacion_id: int


class MarcarGanadaBody(BaseModel):
    venta_id: int


@router.post("/oportunidades/{oportunidad_id}/vincular-cotizacion")
def vincular_cotizacion(
    oportunidad_id: int,
    body: VincularCotizacionBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.vincular_cotizacion(oportunidad_id, body.cotizacion_id, current_user)


@router.post("/oportunidades/{oportunidad_id}/marcar-ganada")
def marcar_ganada(
    oportunidad_id: int,
    body: MarcarGanadaBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return crm_service.marcar_ganada(oportunidad_id, body.venta_id, current_user)
