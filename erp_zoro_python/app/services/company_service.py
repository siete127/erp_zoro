from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction


def list_companies() -> list[dict[str, Any]]:
    with get_connection() as connection:
        result = connection.execute(
            text(
                """
                SELECT
                    Company_Id,
                    NameCompany,
                    Status,
                    RFC,
                    LegalName,
                    FiscalRegime,
                    TaxZipCode,
                    CsdCargado,
                    Email,
                    LogoUrl,
                    EmailAprobacion1,
                    EmailAprobacion2
                FROM ERP_COMPANY
                ORDER BY NameCompany
                """
            )
        )
        return [dict(row) for row in result.mappings().all()]


def get_company(company_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        company = connection.execute(
            text(
                """
                SELECT
                    Company_Id,
                    NameCompany,
                    Status,
                    RFC,
                    LegalName,
                    FiscalRegime,
                    TaxZipCode,
                    CsdCargado,
                    Email,
                    LogoUrl,
                    EmailAprobacion1,
                    EmailAprobacion2
                FROM ERP_COMPANY
                WHERE Company_Id = :company_id
                """
            ),
            {"company_id": company_id},
        ).mappings().first()

    if not company:
        raise HTTPException(status_code=404, detail="Compania no encontrada")
    return dict(company)


def create_company(payload: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_COMPANY (
                    NameCompany,
                    Street,
                    Status,
                    EmailAprobacion1,
                    EmailAprobacion2
                )
                OUTPUT INSERTED.Company_Id
                VALUES (
                    :name_company,
                    :street,
                    :status,
                    :email_aprobacion_1,
                    :email_aprobacion_2
                )
                """
            ),
            {
                "name_company": payload.get("NameCompany"),
                "street": payload.get("Street"),
                "status": payload.get("Status"),
                "email_aprobacion_1": payload.get("EmailAprobacion1"),
                "email_aprobacion_2": payload.get("EmailAprobacion2"),
            },
        )
        row = result.first()
    return {"msg": "Compania creada", "Company_Id": int(row[0]) if row else None}


def update_company(company_id: int, payload: dict[str, Any]) -> dict[str, str]:
    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_COMPANY
                SET
                    NameCompany = COALESCE(:name_company, NameCompany),
                    Street = COALESCE(:street, Street),
                    Status = COALESCE(:status, Status),
                    RFC = COALESCE(:rfc, RFC),
                    LegalName = COALESCE(:legal_name, LegalName),
                    FiscalRegime = COALESCE(:fiscal_regime, FiscalRegime),
                    TaxZipCode = COALESCE(:tax_zip_code, TaxZipCode),
                    Email = COALESCE(:email, Email),
                    LogoUrl = COALESCE(:logo_url, LogoUrl),
                    EmailAprobacion1 = :email_aprobacion_1,
                    EmailAprobacion2 = :email_aprobacion_2
                WHERE Company_Id = :company_id
                """
            ),
            {
                "company_id": company_id,
                "name_company": payload.get("NameCompany"),
                "street": payload.get("Street"),
                "status": payload.get("Status"),
                "rfc": payload.get("RFC"),
                "legal_name": payload.get("LegalName"),
                "fiscal_regime": payload.get("FiscalRegime"),
                "tax_zip_code": payload.get("TaxZipCode"),
                "email": payload.get("Email"),
                "logo_url": payload.get("LogoUrl"),
                "email_aprobacion_1": payload.get("EmailAprobacion1"),
                "email_aprobacion_2": payload.get("EmailAprobacion2"),
            },
        )
    return {"msg": "Compania actualizada"}


def update_company_fiscal(company_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_COMPANY
                SET
                    RFC = COALESCE(:rfc, RFC),
                    LegalName = COALESCE(:legal_name, LegalName),
                    FiscalRegime = COALESCE(:fiscal_regime, FiscalRegime),
                    TaxZipCode = COALESCE(:tax_zip_code, TaxZipCode),
                    Email = COALESCE(:email, Email)
                WHERE Company_Id = :company_id
                """
            ),
            {
                "company_id": company_id,
                "rfc": payload.get("RFC"),
                "legal_name": payload.get("LegalName"),
                "fiscal_regime": payload.get("FiscalRegime"),
                "tax_zip_code": payload.get("TaxZipCode"),
                "email": payload.get("Email"),
            },
        )
    return {"success": True, "msg": "Datos fiscales actualizados"}


def delete_company(company_id: int) -> dict[str, str]:
    with get_transaction() as connection:
        connection.execute(
            text("DELETE FROM ERP_COMPANY WHERE Company_Id = :company_id"),
            {"company_id": company_id},
        )
    return {"msg": "Compania eliminada"}


# ── Facturama credentials ────────────────────────────────────────────────────

def update_facturama_credentials(company_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    facturama_user = payload.get("FacturamaUser")
    facturama_password = payload.get("FacturamaPassword")
    if not facturama_user and not facturama_password:
        raise HTTPException(status_code=400, detail="Se requiere FacturamaUser o FacturamaPassword")
    with get_transaction() as connection:
        connection.execute(
            text("""
                UPDATE ERP_COMPANY
                SET FacturamaUser     = COALESCE(:fu, FacturamaUser),
                    FacturamaPassword = COALESCE(:fp, FacturamaPassword)
                WHERE Company_Id = :company_id
            """),
            {"fu": facturama_user, "fp": facturama_password, "company_id": company_id},
        )
    return {"success": True, "msg": "Credenciales Facturama actualizadas"}


def get_facturacion_status(company_id: int) -> dict[str, Any]:
    from app.services.facturama_service import FacturamaService
    svc = FacturamaService()
    return svc.get_company_facturacion_status(company_id)


# ── CSD ──────────────────────────────────────────────────────────────────────

def subir_csd(company_id: int, cer_base64: str, key_base64: str, password_csd: str) -> dict[str, Any]:
    from app.services.facturama_service import FacturamaService
    import os, base64

    with get_connection() as conn:
        row = conn.execute(
            text("SELECT RFC, FacturamaUser, FacturamaPassword FROM ERP_COMPANY WHERE Company_Id = :id"),
            {"id": company_id},
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    rfc = row.get("RFC")
    if not rfc:
        raise HTTPException(status_code=400, detail="La empresa no tiene RFC configurado")

    # Determinar credenciales: .env por empresa → BD → global
    env_user = os.getenv(f"FACTURAMA_USER_COMPANY_{company_id}") or os.getenv(f"FACTURAMA_USER_{company_id}")
    env_pass = os.getenv(f"FACTURAMA_PASSWORD_COMPANY_{company_id}") or os.getenv(f"FACTURAMA_PASSWORD_{company_id}")
    auth_b64 = None
    if env_user and env_pass:
        auth_b64 = base64.b64encode(f"{env_user}:{env_pass}".encode()).decode()
    elif row.get("FacturamaUser") and row.get("FacturamaPassword"):
        auth_b64 = base64.b64encode(f"{row['FacturamaUser']}:{row['FacturamaPassword']}".encode()).decode()

    svc = FacturamaService()
    result = svc.subir_csd(cer_base64, key_base64, password_csd, rfc, auth_b64)

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_COMPANY SET CsdCargado=1, CsdPassword=:pwd WHERE Company_Id=:id"),
            {"pwd": password_csd, "id": company_id},
        )

    # Intentar actualizar LegalName desde Facturama
    try:
        csds = svc.listar_csds(auth_b64)
        csd = next((c for c in (csds or []) if (c.get("Rfc") or c.get("rfc") or "").upper() == rfc.upper()), None)
        if csd:
            legal = next((csd.get(k) for k in ["Name", "LegalName", "RazonSocial", "name", "legalName", "razonSocial"] if csd.get(k)), None)
            if legal:
                with get_transaction() as conn:
                    conn.execute(
                        text("UPDATE ERP_COMPANY SET LegalName=:ln WHERE Company_Id=:id"),
                        {"ln": legal, "id": company_id},
                    )
    except Exception:
        pass

    return {"success": True, "msg": f"CSD subido exitosamente para {rfc}", "data": result}


def eliminar_csd(company_id: int) -> dict[str, Any]:
    from app.services.facturama_service import FacturamaService

    with get_connection() as conn:
        row = conn.execute(
            text("SELECT RFC FROM ERP_COMPANY WHERE Company_Id = :id"),
            {"id": company_id},
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    rfc = row.get("RFC")

    svc = FacturamaService()
    svc.eliminar_csd(rfc)

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_COMPANY SET CsdCargado=0, CsdPassword=NULL WHERE Company_Id=:id"),
            {"id": company_id},
        )
    return {"success": True, "msg": f"CSD eliminado para {rfc}"}


def listar_csds() -> dict[str, Any]:
    from app.services.facturama_service import FacturamaService
    svc = FacturamaService()
    csds = svc.listar_csds(None) or []

    with get_connection() as conn:
        rows = conn.execute(
            text("SELECT Company_Id, RFC, NameCompany, LegalName, CsdCargado FROM ERP_COMPANY")
        ).mappings().all()

    enriched = []
    for comp in rows:
        rfc = (comp.get("RFC") or "").upper()
        match = next((c for c in csds if (c.get("Rfc") or c.get("rfc") or "").upper() == rfc), None)
        enriched.append({
            "Company_Id": comp["Company_Id"],
            "NameCompany": comp["NameCompany"],
            "LegalName": comp["LegalName"],
            "RFC": comp["RFC"],
            "CsdCargado": comp["CsdCargado"],
            "CsdEnFacturama": bool(match),
            "CsdDetalle": match,
        })
    return {"success": True, "data": enriched, "rawCsds": csds}


# ── Logo ─────────────────────────────────────────────────────────────────────

import os as _os

async def upload_logo(company_id: int, file) -> dict[str, Any]:
    import time, random
    from fastapi import HTTPException

    allowed = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

    ext_map = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/svg+xml": "svg", "image/webp": "webp"}
    ext = ext_map[file.content_type]
    upload_dir = _os.path.join(_os.path.dirname(__file__), "..", "..", "uploads", "logos")
    _os.makedirs(upload_dir, exist_ok=True)

    # Eliminar logos anteriores de esta empresa con otra extensión
    for e in ["png", "jpg", "jpeg", "svg", "webp"]:
        old = _os.path.join(upload_dir, f"company_{company_id}.{e}")
        if _os.path.exists(old):
            try:
                _os.remove(old)
            except Exception:
                pass

    filename = f"company_{company_id}.{ext}"
    dest = _os.path.join(upload_dir, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    url = f"/api/uploads/logos/{filename}"
    try:
        with get_transaction() as conn:
            conn.execute(
                text("UPDATE ERP_COMPANY SET LogoUrl=:url WHERE Company_Id=:id"),
                {"url": url, "id": company_id},
            )
    except Exception:
        pass

    return {"success": True, "msg": "Logo subido", "LogoUrl": url}
