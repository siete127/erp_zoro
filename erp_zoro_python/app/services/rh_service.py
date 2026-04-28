from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy import text

from app.db.session import get_connection, get_transaction

ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_DOC_MIMES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
EXT_BY_MIME = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "application/pdf": ".pdf", "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

UPLOADS_BASE = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")


def _has_company_access(user_companies: list, company_id: int, is_super_admin: bool) -> bool:
    if is_super_admin:
        return True
    return int(company_id) in [int(c) for c in user_companies]


def _get_user_companies(user_id: int) -> list[int]:
    with get_connection() as conn:
        rows = conn.execute(
            text("SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = :uid"),
            {"uid": user_id},
        ).fetchall()
    return [int(r[0]) for r in rows]


def _can_access_user(current_user_id: int, target_user_id: int, user_companies: list, is_super_admin: bool, is_admin: bool) -> bool:
    if is_super_admin:
        return True
    if int(current_user_id) == int(target_user_id):
        return True
    if is_admin:
        target_companies = _get_user_companies(target_user_id)
        if not target_companies:
            return False
        return all(_has_company_access(user_companies, c, is_super_admin) for c in target_companies)
    return False


def list_perfiles(
    current_user_id: int,
    user_companies: list,
    is_super_admin: bool,
    is_admin: bool,
    company_id_filter: Optional[int] = None,
) -> list[dict[str, Any]]:
    conditions: list[str] = []
    params: dict[str, Any] = {}

    if not is_admin and not is_super_admin:
        conditions.append("u.User_Id = :uid")
        params["uid"] = current_user_id
    elif not is_super_admin:
        if not user_companies:
            return []
        in_pl = ", ".join(f":uc{i}" for i in range(len(user_companies)))
        conditions.append(f"uc.Company_Id IN ({in_pl})")
        for i, v in enumerate(user_companies):
            params[f"uc{i}"] = v

    if company_id_filter:
        conditions.append("uc.Company_Id = :cid_filter")
        params["cid_filter"] = company_id_filter

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as conn:
        rows = conn.execute(
            text(f"""
                SELECT
                    u.User_Id, u.Name, u.Lastname, u.Email, u.PhoneNumber, u.Area,
                    hp.NumeroEmpleado, hp.Puesto, hp.Departamento, hp.FechaIngreso,
                    hp.TipoContrato, hp.EstadoCivil, hp.CURP, hp.RFC, hp.NSS,
                    hp.Ciudad, hp.Estado, hp.Pais, hp.BancoPrincipal,
                    hp.NumeroCuentaPrincipal, hp.CLABE, hp.NombreTitularCuenta, hp.FotoPerfilUrl,
                    STRING_AGG(c.NameCompany, ', ') AS NameCompany
                FROM ERP_USERS u
                LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
                LEFT JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
                LEFT JOIN ERP_HR_PROFILE hp ON u.User_Id = hp.User_Id
                {where}
                GROUP BY
                    u.User_Id, u.Name, u.Lastname, u.Email, u.PhoneNumber, u.Area,
                    hp.NumeroEmpleado, hp.Puesto, hp.Departamento, hp.FechaIngreso,
                    hp.TipoContrato, hp.EstadoCivil, hp.CURP, hp.RFC, hp.NSS,
                    hp.Ciudad, hp.Estado, hp.Pais, hp.BancoPrincipal,
                    hp.NumeroCuentaPrincipal, hp.CLABE, hp.NombreTitularCuenta, hp.FotoPerfilUrl
                ORDER BY u.Name, u.Lastname
            """),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


def get_perfil(user_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT u.User_Id, u.Name, u.Lastname, u.Username, u.Email, u.PhoneNumber, u.Area, hp.*
                FROM ERP_USERS u
                LEFT JOIN ERP_HR_PROFILE hp ON hp.User_Id = u.User_Id
                WHERE u.User_Id = :uid
            """),
            {"uid": user_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        perfil = dict(row)

        contactos = [dict(r) for r in conn.execute(
            text("SELECT * FROM ERP_HR_EMERGENCY_CONTACT WHERE User_Id = :uid AND IsActive = 1 ORDER BY ContactoEmergencia_Id DESC"),
            {"uid": user_id},
        ).mappings().all()]

        cuentas = [dict(r) for r in conn.execute(
            text("SELECT * FROM ERP_HR_BANK_ACCOUNT WHERE User_Id = :uid AND IsActive = 1 ORDER BY EsPrincipal DESC, CuentaBancaria_Id DESC"),
            {"uid": user_id},
        ).mappings().all()]

        documentos = [dict(r) for r in conn.execute(
            text("SELECT * FROM ERP_HR_DOCUMENT WHERE User_Id = :uid AND IsActive = 1 ORDER BY CreatedAt DESC, Documento_Id DESC"),
            {"uid": user_id},
        ).mappings().all()]

    return {"perfil": perfil, "contactosEmergencia": contactos, "cuentasBancarias": cuentas, "documentos": documentos}


def upsert_perfil(user_id: int, data: dict, updated_by: Optional[int] = None) -> dict:
    with get_connection() as conn:
        exists_user = conn.execute(
            text("SELECT User_Id FROM ERP_USERS WHERE User_Id = :uid"), {"uid": user_id}
        ).fetchone()
    if not exists_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    p = data
    params: dict[str, Any] = {
        "uid": user_id, "upd": updated_by,
        "fn": p.get("FechaNacimiento"), "curp": p.get("CURP"), "rfc": p.get("RFC"),
        "nss": p.get("NSS"), "ec": p.get("EstadoCivil"), "gen": p.get("Genero"),
        "dir": p.get("Direccion"), "ciu": p.get("Ciudad"), "est": p.get("Estado"),
        "cp": p.get("CodigoPostal"), "pais": p.get("Pais"),
        "nemp": p.get("NumeroEmpleado"), "fi": p.get("FechaIngreso"),
        "pue": p.get("Puesto"), "dep": p.get("Departamento"),
        "sal": p.get("SalarioMensual"), "tc": p.get("TipoContrato"),
        "banco": p.get("BancoPrincipal"), "nct": p.get("NumeroCuentaPrincipal"),
        "clabe": p.get("CLABE"), "tit": p.get("NombreTitularCuenta"),
        "cep": p.get("ContactoEmergenciaPrincipal"),
        "tep": p.get("TelefonoEmergenciaPrincipal"),
        "ale": p.get("Alergias"), "ts": p.get("TipoSangre"), "nm": p.get("NotasMedicas"),
    }

    with get_transaction() as conn:
        conn.execute(
            text("""
                IF EXISTS (SELECT 1 FROM ERP_HR_PROFILE WHERE User_Id = :uid)
                BEGIN
                  UPDATE ERP_HR_PROFILE SET
                    FechaNacimiento=:fn, CURP=:curp, RFC=:rfc, NSS=:nss, EstadoCivil=:ec, Genero=:gen,
                    Direccion=:dir, Ciudad=:ciu, Estado=:est, CodigoPostal=:cp, Pais=:pais,
                    NumeroEmpleado=:nemp, FechaIngreso=:fi, Puesto=:pue, Departamento=:dep,
                    SalarioMensual=:sal, TipoContrato=:tc, BancoPrincipal=:banco,
                    NumeroCuentaPrincipal=:nct, CLABE=:clabe, NombreTitularCuenta=:tit,
                    ContactoEmergenciaPrincipal=:cep, TelefonoEmergenciaPrincipal=:tep,
                    Alergias=:ale, TipoSangre=:ts, NotasMedicas=:nm,
                    UpdatedAt=GETDATE(), UpdatedBy=:upd
                  WHERE User_Id=:uid
                END
                ELSE
                BEGIN
                  INSERT INTO ERP_HR_PROFILE (
                    User_Id, FechaNacimiento, CURP, RFC, NSS, EstadoCivil, Genero,
                    Direccion, Ciudad, Estado, CodigoPostal, Pais, NumeroEmpleado, FechaIngreso,
                    Puesto, Departamento, SalarioMensual, TipoContrato, BancoPrincipal,
                    NumeroCuentaPrincipal, CLABE, NombreTitularCuenta, ContactoEmergenciaPrincipal,
                    TelefonoEmergenciaPrincipal, Alergias, TipoSangre, NotasMedicas,
                    CreatedAt, UpdatedAt, UpdatedBy
                  ) VALUES (
                    :uid, :fn, :curp, :rfc, :nss, :ec, :gen,
                    :dir, :ciu, :est, :cp, :pais, :nemp, :fi,
                    :pue, :dep, :sal, :tc, :banco,
                    :nct, :clabe, :tit, :cep,
                    :tep, :ale, :ts, :nm,
                    GETDATE(), GETDATE(), :upd
                  )
                END
            """),
            params,
        )
    return {"msg": "Perfil RH guardado correctamente"}


# ── Contactos de emergencia ──────────────────────────────────────────────────

def create_contacto_emergencia(user_id: int, data: dict, created_by: Optional[int] = None) -> dict:
    if not data.get("Nombre") or not data.get("Telefono"):
        raise HTTPException(status_code=400, detail="Nombre y Telefono son requeridos")
    with get_transaction() as conn:
        row = conn.execute(
            text("""
                INSERT INTO ERP_HR_EMERGENCY_CONTACT
                  (User_Id, Nombre, Parentesco, Telefono, TelefonoAlterno, Direccion,
                   EsPrincipal, Notas, IsActive, CreatedAt, UpdatedAt, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (:uid, :nom, :par, :tel, :tela, :dir, :esp, :notas, 1, GETDATE(), GETDATE(), :crby)
            """),
            {
                "uid": user_id, "nom": data["Nombre"], "par": data.get("Parentesco"),
                "tel": data["Telefono"], "tela": data.get("TelefonoAlterno"),
                "dir": data.get("Direccion"), "esp": 1 if data.get("EsPrincipal") else 0,
                "notas": data.get("Notas"), "crby": created_by,
            },
        ).mappings().first()
    return dict(row) if row else {}


def update_contacto_emergencia(contacto_id: int, data: dict) -> dict:
    with get_connection() as conn:
        exists = conn.execute(
            text("SELECT User_Id FROM ERP_HR_EMERGENCY_CONTACT WHERE ContactoEmergencia_Id = :cid"),
            {"cid": contacto_id},
        ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_EMERGENCY_CONTACT SET
                  Nombre=COALESCE(:nom, Nombre), Parentesco=COALESCE(:par, Parentesco),
                  Telefono=COALESCE(:tel, Telefono), TelefonoAlterno=:tela, Direccion=:dir,
                  EsPrincipal=:esp, Notas=:notas, UpdatedAt=GETDATE()
                WHERE ContactoEmergencia_Id=:cid
            """),
            {
                "nom": data.get("Nombre"), "par": data.get("Parentesco"), "tel": data.get("Telefono"),
                "tela": data.get("TelefonoAlterno"), "dir": data.get("Direccion"),
                "esp": 1 if data.get("EsPrincipal") else 0, "notas": data.get("Notas"),
                "cid": contacto_id,
            },
        )
    return {"msg": "Contacto de emergencia actualizado"}


def delete_contacto_emergencia(contacto_id: int) -> dict:
    with get_connection() as conn:
        exists = conn.execute(
            text("SELECT ContactoEmergencia_Id FROM ERP_HR_EMERGENCY_CONTACT WHERE ContactoEmergencia_Id = :cid"),
            {"cid": contacto_id},
        ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_HR_EMERGENCY_CONTACT SET IsActive=0, UpdatedAt=GETDATE() WHERE ContactoEmergencia_Id=:cid"),
            {"cid": contacto_id},
        )
    return {"msg": "Contacto de emergencia eliminado"}


# ── Cuentas bancarias ────────────────────────────────────────────────────────

def create_cuenta_bancaria(user_id: int, data: dict, created_by: Optional[int] = None) -> dict:
    if not data.get("Banco") or not data.get("NumeroCuenta"):
        raise HTTPException(status_code=400, detail="Banco y NumeroCuenta son requeridos")
    with get_transaction() as conn:
        row = conn.execute(
            text("""
                INSERT INTO ERP_HR_BANK_ACCOUNT
                  (User_Id, Banco, NumeroCuenta, CLABE, NumeroTarjeta, Moneda, EsPrincipal,
                   NombreTitular, IsActive, CreatedAt, UpdatedAt, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (:uid, :banco, :nct, :clabe, :ntarj, :mon, :esp, :tit, 1, GETDATE(), GETDATE(), :crby)
            """),
            {
                "uid": user_id, "banco": data["Banco"], "nct": data["NumeroCuenta"],
                "clabe": data.get("CLABE"), "ntarj": data.get("NumeroTarjeta"),
                "mon": data.get("Moneda", "MXN"), "esp": 1 if data.get("EsPrincipal") else 0,
                "tit": data.get("NombreTitular"), "crby": created_by,
            },
        ).mappings().first()
    return dict(row) if row else {}


def update_cuenta_bancaria(cuenta_id: int, data: dict) -> dict:
    with get_connection() as conn:
        exists = conn.execute(
            text("SELECT CuentaBancaria_Id FROM ERP_HR_BANK_ACCOUNT WHERE CuentaBancaria_Id = :cid"),
            {"cid": cuenta_id},
        ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_BANK_ACCOUNT SET
                  Banco=COALESCE(:banco, Banco), NumeroCuenta=COALESCE(:nct, NumeroCuenta),
                  CLABE=:clabe, NumeroTarjeta=:ntarj, Moneda=COALESCE(:mon, Moneda),
                  EsPrincipal=:esp, NombreTitular=:tit, UpdatedAt=GETDATE()
                WHERE CuentaBancaria_Id=:cid
            """),
            {
                "banco": data.get("Banco"), "nct": data.get("NumeroCuenta"), "clabe": data.get("CLABE"),
                "ntarj": data.get("NumeroTarjeta"), "mon": data.get("Moneda"),
                "esp": 1 if data.get("EsPrincipal") else 0, "tit": data.get("NombreTitular"),
                "cid": cuenta_id,
            },
        )
    return {"msg": "Cuenta bancaria actualizada"}


def delete_cuenta_bancaria(cuenta_id: int) -> dict:
    with get_connection() as conn:
        exists = conn.execute(
            text("SELECT CuentaBancaria_Id FROM ERP_HR_BANK_ACCOUNT WHERE CuentaBancaria_Id = :cid"),
            {"cid": cuenta_id},
        ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_HR_BANK_ACCOUNT SET IsActive=0, UpdatedAt=GETDATE() WHERE CuentaBancaria_Id=:cid"),
            {"cid": cuenta_id},
        )
    return {"msg": "Cuenta bancaria eliminada"}


# ── Documentos ───────────────────────────────────────────────────────────────

def list_documentos(user_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("SELECT * FROM ERP_HR_DOCUMENT WHERE User_Id = :uid AND IsActive = 1 ORDER BY CreatedAt DESC, Documento_Id DESC"),
            {"uid": user_id},
        ).mappings().all()
    return [dict(r) for r in rows]


async def upload_documento(
    user_id: int,
    file: UploadFile,
    tipo_documento: Optional[str],
    descripcion: Optional[str],
    created_by: Optional[int],
) -> dict:
    if file.content_type not in ALLOWED_DOC_MIMES:
        raise HTTPException(status_code=400, detail="Formato inválido. Use PDF, JPG, PNG, WEBP, DOC o DOCX")

    import time, random
    upload_dir = os.path.join(UPLOADS_BASE, "rh-documentos", f"user_{user_id}")
    os.makedirs(upload_dir, exist_ok=True)
    ext = EXT_BY_MIME.get(file.content_type, ".pdf")
    unique = f"{int(time.time()*1000)}_{random.randint(0, 99999)}"
    filename = f"doc_{user_id}_{unique}{ext}"
    file_path = os.path.join(upload_dir, filename)
    public_url = f"/uploads/rh-documentos/user_{user_id}/{filename}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    size_bytes = len(content)

    with get_transaction() as conn:
        row = conn.execute(
            text("""
                INSERT INTO ERP_HR_DOCUMENT
                  (User_Id, TipoDocumento, NombreArchivo, ArchivoUrl, MimeType, SizeBytes,
                   Descripcion, IsActive, CreatedAt, UpdatedAt, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (:uid, :tipo, :fname, :url, :mime, :size, :desc, 1, GETDATE(), GETDATE(), :crby)
            """),
            {
                "uid": user_id, "tipo": tipo_documento,
                "fname": file.filename or filename, "url": public_url,
                "mime": file.content_type, "size": size_bytes,
                "desc": descripcion, "crby": created_by,
            },
        ).mappings().first()
    return {"msg": "Documento cargado correctamente", "data": dict(row) if row else None}


def delete_documento(documento_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text("SELECT Documento_Id, ArchivoUrl FROM ERP_HR_DOCUMENT WHERE Documento_Id = :did"),
            {"did": documento_id},
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    archivo_url = row[1]
    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_HR_DOCUMENT SET IsActive=0, UpdatedAt=GETDATE() WHERE Documento_Id=:did"),
            {"did": documento_id},
        )

    if archivo_url:
        relative = str(archivo_url).lstrip("/").replace("uploads/", "", 1)
        abs_path = os.path.join(UPLOADS_BASE, relative)
        if os.path.exists(abs_path):
            try:
                os.remove(abs_path)
            except Exception:
                pass

    return {"msg": "Documento eliminado"}


async def upload_foto_perfil(user_id: int, file: UploadFile, updated_by: Optional[int]) -> dict:
    if file.content_type not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG, PNG o WEBP")

    import time, random
    upload_dir = os.path.join(UPLOADS_BASE, "rh-profiles")
    os.makedirs(upload_dir, exist_ok=True)
    ext = EXT_BY_MIME.get(file.content_type, ".jpg")
    unique = f"{int(time.time()*1000)}_{random.randint(0, 99999)}"
    filename = f"user_{user_id}_{unique}{ext}"
    file_path = os.path.join(upload_dir, filename)
    public_url = f"/uploads/rh-profiles/{filename}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    with get_transaction() as conn:
        conn.execute(
            text("""
                IF EXISTS (SELECT 1 FROM ERP_HR_PROFILE WHERE User_Id=:uid)
                  UPDATE ERP_HR_PROFILE SET FotoPerfilUrl=:url, UpdatedAt=GETDATE(), UpdatedBy=:upd WHERE User_Id=:uid
                ELSE
                  INSERT INTO ERP_HR_PROFILE (User_Id, FotoPerfilUrl, CreatedAt, UpdatedAt, UpdatedBy)
                  VALUES (:uid, :url, GETDATE(), GETDATE(), :upd)
            """),
            {"uid": user_id, "url": public_url, "upd": updated_by},
        )
    return {"msg": "Foto de perfil actualizada", "FotoPerfilUrl": public_url}


# ── Vacaciones ───────────────────────────────────────────────────────────────

def list_vacaciones(
    current_user_id: int,
    user_companies: list,
    is_super_admin: bool,
    is_admin: bool,
    company_id_filter: Optional[int] = None,
    user_id_filter: Optional[int] = None,
    estatus_filter: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Listar solicitudes de vacaciones con permisos."""
    conditions: list[str] = []
    params: dict[str, Any] = {}

    # Filtrar por empresa si no es super admin
    if not is_super_admin:
        if not user_companies:
            return []
        in_pl = ", ".join(f":uc{i}" for i in range(len(user_companies)))
        conditions.append(f"uc.Company_Id IN ({in_pl})")
        for i, v in enumerate(user_companies):
            params[f"uc{i}"] = v

    # Si no es admin ni super admin, solo ver sus propias solicitudes
    if not is_admin and not is_super_admin:
        conditions.append("v.User_Id = :uid")
        params["uid"] = current_user_id

    # Filtros adicionales
    if company_id_filter:
        conditions.append("uc.Company_Id = :cid")
        params["cid"] = company_id_filter

    if user_id_filter:
        conditions.append("v.User_Id = :uid_filter")
        params["uid_filter"] = user_id_filter

    if estatus_filter:
        conditions.append("v.Estatus = :est")
        params["est"] = estatus_filter

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_connection() as conn:
        rows = conn.execute(
            text(f"""
                SELECT DISTINCT
                    v.Vacaciones_Id, v.User_Id, u.Name, u.Lastname, u.Email,
                    v.FechaInicio, v.FechaFin, v.Cantidad, v.Razon, v.Observaciones,
                    v.Estatus, v.AprobadoPor, ap.Name AS NombreAprobador,
                    v.FechaAprobacion, v.CreatedAt, v.UpdatedAt,
                    STRING_AGG(c.NameCompany, ', ') AS Empresa
                FROM ERP_HR_VACATION_REQUEST v
                LEFT JOIN ERP_USERS u ON v.User_Id = u.User_Id
                LEFT JOIN ERP_USERS ap ON v.AprobadoPor = ap.User_Id
                LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
                LEFT JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
                {where}
                GROUP BY
                    v.Vacaciones_Id, v.User_Id, u.Name, u.Lastname, u.Email,
                    v.FechaInicio, v.FechaFin, v.Cantidad, v.Razon, v.Observaciones,
                    v.Estatus, v.AprobadoPor, ap.Name,
                    v.FechaAprobacion, v.CreatedAt, v.UpdatedAt
                ORDER BY v.CreatedAt DESC
            """),
            params,
        ).mappings().all()
    return [dict(r) for r in rows]


def get_vacaciones(vacaciones_id: int) -> dict[str, Any]:
    """Obtener detalles de una solicitud de vacaciones."""
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT v.*, u.Name, u.Lastname, u.Email, ap.Name AS NombreAprobador
                FROM ERP_HR_VACATION_REQUEST v
                LEFT JOIN ERP_USERS u ON v.User_Id = u.User_Id
                LEFT JOIN ERP_USERS ap ON v.AprobadoPor = ap.User_Id
                WHERE v.Vacaciones_Id = :vid
            """),
            {"vid": vacaciones_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Solicitud de vacaciones no encontrada")
    return dict(row)


def create_vacaciones(user_id: int, data: dict, created_by: Optional[int] = None) -> dict:
    """Crear nueva solicitud de vacaciones."""
    if not data.get("FechaInicio") or not data.get("FechaFin") or not data.get("Cantidad"):
        raise HTTPException(
            status_code=400,
            detail="FechaInicio, FechaFin y Cantidad son requeridos"
        )

    with get_transaction() as conn:
        row = conn.execute(
            text("""
                INSERT INTO ERP_HR_VACATION_REQUEST
                  (User_Id, FechaInicio, FechaFin, Cantidad, Razon, Observaciones,
                   Estatus, IsActive, CreatedAt, UpdatedAt, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (:uid, :fi, :ff, :cant, :raz, :obs, 'Pendiente', 1, GETDATE(), GETDATE(), :crby)
            """),
            {
                "uid": user_id,
                "fi": data["FechaInicio"],
                "ff": data["FechaFin"],
                "cant": data["Cantidad"],
                "raz": data.get("Razon"),
                "obs": data.get("Observaciones"),
                "crby": created_by,
            },
        ).mappings().first()
    return dict(row) if row else {}


def update_vacaciones(vacaciones_id: int, data: dict, updated_by: Optional[int] = None) -> dict:
    """Actualizar solicitud de vacaciones (solo si está pendiente)."""
    with get_connection() as conn:
        existe = conn.execute(
            text("SELECT Estatus FROM ERP_HR_VACATION_REQUEST WHERE Vacaciones_Id = :vid"),
            {"vid": vacaciones_id},
        ).fetchone()
    if not existe:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if existe[0] != "Pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden actualizar solicitudes pendientes")

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_VACATION_REQUEST SET
                  FechaInicio=COALESCE(:fi, FechaInicio),
                  FechaFin=COALESCE(:ff, FechaFin),
                  Cantidad=COALESCE(:cant, Cantidad),
                  Razon=:raz, Observaciones=:obs,
                  UpdatedAt=GETDATE(), UpdatedBy=:upd
                WHERE Vacaciones_Id=:vid
            """),
            {
                "vid": vacaciones_id,
                "fi": data.get("FechaInicio"),
                "ff": data.get("FechaFin"),
                "cant": data.get("Cantidad"),
                "raz": data.get("Razon"),
                "obs": data.get("Observaciones"),
                "upd": updated_by,
            },
        )
    return {"msg": "Solicitud de vacaciones actualizada"}


def aprobar_vacaciones(vacaciones_id: int, data: dict, aprobado_por: int) -> dict:
    """Aprobar o rechazar solicitud de vacaciones."""
    estatus = data.get("Estatus")
    if estatus not in ["Aprobado", "Rechazado"]:
        raise HTTPException(status_code=400, detail="Estatus debe ser 'Aprobado' o 'Rechazado'")

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_HR_VACATION_REQUEST SET
                  Estatus=:est,
                  AprobadoPor=:apby,
                  FechaAprobacion=GETDATE(),
                  Observaciones=COALESCE(:obs, Observaciones),
                  UpdatedAt=GETDATE()
                WHERE Vacaciones_Id=:vid
            """),
            {
                "vid": vacaciones_id,
                "est": estatus,
                "apby": aprobado_por,
                "obs": data.get("Observaciones"),
            },
        )
    return {"msg": f"Solicitud de vacaciones {estatus.lower()}"}


def delete_vacaciones(vacaciones_id: int) -> dict:
    """Eliminar solicitud de vacaciones (soft delete)."""
    with get_connection() as conn:
        existe = conn.execute(
            text("SELECT Vacaciones_Id FROM ERP_HR_VACATION_REQUEST WHERE Vacaciones_Id = :vid"),
            {"vid": vacaciones_id},
        ).fetchone()
    if not existe:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_HR_VACATION_REQUEST SET IsActive=0, UpdatedAt=GETDATE() WHERE Vacaciones_Id=:vid"),
            {"vid": vacaciones_id},
        )
    return {"msg": "Solicitud de vacaciones eliminada"}
