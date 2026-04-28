from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.services import nomina_service


router = APIRouter()


class EmpleadoCreate(BaseModel):
    Company_Id: int
    Nombre: str
    RFC: str
    NSS: str | None = None
    CURP: str | None = None
    FechaIngreso: str
    Activo: bool = True
    Puesto: str | None = None
    Departamento: str | None = None
    TipoContrato: str | None = None
    TipoJornada: str | None = None
    SalarioBase: float = 0
    SalarioDiarioIntegrado: float | None = None
    Banco: str | None = None
    CuentaBancaria: str | None = None
    Clabe: str | None = None


class EmpleadoUpdate(BaseModel):
    Nombre: str | None = None
    RFC: str | None = None
    NSS: str | None = None
    CURP: str | None = None
    FechaIngreso: str | None = None
    Activo: bool | None = None
    Puesto: str | None = None
    Departamento: str | None = None
    TipoContrato: str | None = None
    TipoJornada: str | None = None
    SalarioBase: float | None = None
    SalarioDiarioIntegrado: float | None = None
    Banco: str | None = None
    CuentaBancaria: str | None = None
    Clabe: str | None = None


class ConceptoCreate(BaseModel):
    Tipo: str  # PERCEPCION | DEDUCCION
    Clave: str
    Descripcion: str
    EsGravado: bool = True
    EsExento: bool = False


class NominaCreate(BaseModel):
    Company_Id: int
    PeriodoInicio: str
    PeriodoFin: str
    Tipo: str = "QUINCENAL"
    DiasLaborados: int = 15


class LineaUpdate(BaseModel):
    Percepciones: float
    Deducciones: float = 0


# ---- Empleados ----

@router.get("/empleados")
def list_empleados(
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return nomina_service.list_empleados(current_user, company_id)


@router.get("/empleados/{empleado_id}")
def get_empleado(empleado_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.get_empleado(empleado_id, current_user)


@router.post("/empleados")
def create_empleado(payload: EmpleadoCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.create_empleado(payload.model_dump(), current_user)


@router.put("/empleados/{empleado_id}")
def update_empleado(empleado_id: int, payload: EmpleadoUpdate, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.update_empleado(empleado_id, payload.model_dump(exclude_none=True), current_user)


@router.delete("/empleados/{empleado_id}")
def delete_empleado(empleado_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.delete_empleado(empleado_id, current_user)


# ---- Conceptos ----

@router.get("/conceptos")
def list_conceptos(current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.list_conceptos()


@router.post("/conceptos")
def create_concepto(payload: ConceptoCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.create_concepto(payload.model_dump())


# ---- Nóminas ----

@router.get("/nominas")
def list_nominas(
    company_id: int | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> dict:
    return nomina_service.list_nominas(current_user, company_id)


@router.post("/nominas")
def create_nomina(payload: NominaCreate, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.create_nomina(payload.model_dump(), current_user)


@router.get("/nominas/{nomina_id}")
def get_nomina_detail(nomina_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.get_nomina_detail(nomina_id, current_user)


@router.post("/nominas/{nomina_id}/cerrar")
def cerrar_nomina(nomina_id: int, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.cerrar_nomina(nomina_id, current_user)


@router.put("/lineas/{linea_id}")
def update_linea(linea_id: int, payload: LineaUpdate, current_user: dict = Depends(get_current_user)) -> dict:
    return nomina_service.update_linea(linea_id, payload.model_dump(), current_user)
