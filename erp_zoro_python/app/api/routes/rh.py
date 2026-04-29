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
    VacacionesCreate,
    VacacionesUpdate,
    VacacionesAprobacion,
)
from app.services import email_service
from app.services import payroll_leave_service as payroll_svc
from app.db.session import fetch_one

router = APIRouter()


def _check_access(current_user: dict, target_user_id: int):
    is_super = current_user.get("is_super_admin", False)
    is_admin = current_user.get("is_admin", False)
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
    is_super = current_user.get("is_super_admin", False)
    is_admin = current_user.get("is_admin", False)
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


# ── Vacaciones ───────────────────────────────────────────────────────────────

@router.get("/vacaciones")
def list_vacaciones(
    company_id: Optional[int] = None,
    user_id: Optional[int] = None,
    estatus: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Listar solicitudes de vacaciones con filtros."""
    is_super = current_user.get("is_super_admin", False)
    is_admin = current_user.get("is_admin", False)
    companies = current_user.get("companies", [])
    user_id_actual = current_user.get("User_Id")
    return svc.list_vacaciones(
        user_id_actual, companies, is_super, is_admin, company_id, user_id, estatus
    )


@router.get("/vacaciones/{vacaciones_id}")
def get_vacaciones(vacaciones_id: int, current_user: dict = Depends(get_current_user)):
    """Obtener detalles de una solicitud de vacaciones."""
    return svc.get_vacaciones(vacaciones_id)


@router.post("/vacaciones", status_code=201)
def create_vacaciones(
    body: VacacionesCreate,
    current_user: dict = Depends(get_current_user),
):
    """Crear nueva solicitud de vacaciones para el usuario actual."""
    user_id = current_user.get("User_Id")
    resultado = svc.create_vacaciones(user_id, body.model_dump(), user_id)

    # Notificar al empleado que su solicitud fue recibida
    try:
        user_data = fetch_one(
            "SELECT Email, Name, Lastname FROM ERP_USER WHERE User_Id = :uid",
            {"uid": user_id}
        )
        if user_data and user_data.get("Email"):
            data = body.model_dump()
            email_service.send_vacation_request_email(
                to=user_data["Email"],
                employee_name=f"{user_data.get('Name','')} {user_data.get('Lastname','')}".strip(),
                fecha_inicio=str(data.get("FechaInicio", ""))[:10],
                fecha_fin=str(data.get("FechaFin", ""))[:10],
                dias=int(data.get("Cantidad") or 0),
                razon=data.get("Razon", ""),
            )
    except Exception:
        pass

    return resultado


@router.put("/vacaciones/{vacaciones_id}")
def update_vacaciones(
    vacaciones_id: int,
    body: VacacionesUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Actualizar solicitud de vacaciones (solo si está pendiente)."""
    return svc.update_vacaciones(vacaciones_id, body.model_dump(), current_user.get("User_Id"))


@router.post("/vacaciones/{vacaciones_id}/aprobar")
def aprobar_vacaciones(
    vacaciones_id: int,
    body: VacacionesAprobacion,
    current_user: dict = Depends(get_current_user),
):
    """Aprobar o rechazar solicitud de vacaciones (solo admins/superadmins)."""
    is_admin = current_user.get("is_admin", False)
    is_super = current_user.get("is_super_admin", False)
    if not is_admin and not is_super:
        raise HTTPException(status_code=403, detail="No tiene permisos para aprobar vacaciones")

    resultado = svc.aprobar_vacaciones(vacaciones_id, body.model_dump(), current_user.get("User_Id"))
    estatus = body.model_dump().get("Estatus")

    # Notificaciones por email y acciones post-aprobacion (no bloquean si fallan)
    try:
        vac = fetch_one(
            """
            SELECT v.User_Id, v.FechaInicio, v.FechaFin, v.Cantidad, v.Razon,
                   u.Email, u.Name, u.Lastname
            FROM ERP_HR_VACATION_REQUEST v
            JOIN ERP_USER u ON u.User_Id = v.User_Id
            WHERE v.Vacaciones_Id = :vid
            """,
            {"vid": vacaciones_id}
        )
        if vac and vac.get("Email"):
            emp_name = f"{vac.get('Name', '')} {vac.get('Lastname', '')}".strip()
            fi = str(vac.get("FechaInicio", ""))[:10]
            ff = str(vac.get("FechaFin", ""))[:10]
            dias = int(vac.get("Cantidad") or 0)

            if estatus == "Aprobado":
                # Crear mapeo de nomina automaticamente
                importe = 0.0
                try:
                    mapeo = payroll_svc.create_payroll_mapping(vacaciones_id, vac["User_Id"])
                    importe = mapeo.get("importe", 0.0)
                except Exception:
                    pass
                # Enviar email de aprobacion
                try:
                    email_service.send_vacation_approved_email(
                        to=vac["Email"], employee_name=emp_name,
                        fecha_inicio=fi, fecha_fin=ff, dias=dias, importe=importe
                    )
                except Exception:
                    pass

            elif estatus == "Rechazado":
                # Cancelar mapeo si existe
                try:
                    payroll_svc.cancel_leave_mapping(vacaciones_id)
                except Exception:
                    pass
                # Enviar email de rechazo
                try:
                    email_service.send_vacation_rejected_email(
                        to=vac["Email"], employee_name=emp_name,
                        fecha_inicio=fi, fecha_fin=ff, dias=dias,
                        observaciones=body.model_dump().get("Observaciones", "")
                    )
                except Exception:
                    pass
    except Exception:
        pass  # Las notificaciones no bloquean la respuesta principal

    return resultado


@router.delete("/vacaciones/{vacaciones_id}")
def delete_vacaciones(
    vacaciones_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Eliminar solicitud de vacaciones."""
    return svc.delete_vacaciones(vacaciones_id)
