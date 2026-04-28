from __future__ import annotations

import secrets
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company


def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _generate_key() -> str:
    return "ek_" + secrets.token_urlsafe(32)


def list_keys(current_user: dict[str, Any], company_id: int) -> list[dict[str, Any]]:
    _check_company(current_user, company_id)
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    k.Key_Id,
                    k.Company_Id,
                    k.Name,
                    LEFT(k.ApiKey, 12) + '...' AS ApiKeyMasked,
                    k.Scopes,
                    k.IsActive,
                    k.LastUsed,
                    k.CreatedAt,
                    k.ExpiresAt,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS CreadoPorNombre
                FROM ERP_API_KEYS k
                LEFT JOIN ERP_USERS u ON u.User_Id = k.CreatedBy
                WHERE k.Company_Id = :company_id
                ORDER BY k.CreatedAt DESC
                """
            ),
            {"company_id": company_id},
        ).mappings().all()
    return [dict(row) for row in rows]


def create_key(
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    name = str(payload.get("Name") or "").strip()
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not name:
        raise HTTPException(status_code=400, detail="Name es requerido")
    _check_company(current_user, company_id)

    created_by = int(current_user.get("User_Id") or current_user.get("id") or 0) or None
    api_key = _generate_key()

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_API_KEYS
                    (Company_Id, Name, ApiKey, Scopes, IsActive, CreatedBy, ExpiresAt)
                OUTPUT INSERTED.Key_Id
                VALUES
                    (:company_id, :name, :api_key, :scopes, 1, :created_by, :expires_at)
                """
            ),
            {
                "company_id": company_id,
                "name": name,
                "api_key": api_key,
                "scopes": payload.get("Scopes"),
                "created_by": created_by,
                "expires_at": payload.get("ExpiresAt"),
            },
        ).mappings().first()

    return {
        "success": True,
        "Key_Id": int(row["Key_Id"]),
        "ApiKey": api_key,
        "Name": name,
        "message": "Guarda esta clave — no se mostrará de nuevo",
    }


def toggle_key(key_id: int, active: bool, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        key = conn.execute(
            text("SELECT Company_Id FROM ERP_API_KEYS WHERE Key_Id = :kid"),
            {"kid": key_id},
        ).mappings().first()
        if not key:
            raise HTTPException(status_code=404, detail="API Key no encontrada")
        _check_company(current_user, int(key["Company_Id"]))

        conn.execute(
            text("UPDATE ERP_API_KEYS SET IsActive = :active WHERE Key_Id = :kid"),
            {"active": 1 if active else 0, "kid": key_id},
        )

    return {"success": True}


def delete_key(key_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        key = conn.execute(
            text("SELECT Company_Id FROM ERP_API_KEYS WHERE Key_Id = :kid"),
            {"kid": key_id},
        ).mappings().first()
        if not key:
            raise HTTPException(status_code=404, detail="API Key no encontrada")
        _check_company(current_user, int(key["Company_Id"]))

        conn.execute(text("DELETE FROM ERP_API_KEYS WHERE Key_Id = :kid"), {"kid": key_id})

    return {"success": True}


def validate_api_key(api_key: str) -> dict[str, Any] | None:
    """
    Valida una API Key y retorna un pseudo-usuario si es válida.
    Actualiza LastUsed en background.
    """
    with get_connection() as conn:
        row = conn.execute(
            text(
                """
                SELECT k.*, c.NameCompany
                FROM ERP_API_KEYS k
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = k.Company_Id
                WHERE k.ApiKey = :key
                  AND k.IsActive = 1
                  AND (k.ExpiresAt IS NULL OR k.ExpiresAt > GETDATE())
                """
            ),
            {"key": api_key},
        ).mappings().first()

    if not row:
        return None

    # Actualizar LastUsed de forma separada (best-effort)
    try:
        with get_transaction() as conn:
            conn.execute(
                text("UPDATE ERP_API_KEYS SET LastUsed = GETDATE() WHERE Key_Id = :kid"),
                {"kid": int(row["Key_Id"])},
            )
    except Exception:
        pass

    scopes_raw = str(row.get("Scopes") or "")
    scopes = [s.strip() for s in scopes_raw.split(",") if s.strip()] if scopes_raw else []

    return {
        "id": 0,
        "User_Id": 0,
        "Name": f"APIKey:{row['Name']}",
        "RolId": 3,
        "is_admin": False,
        "is_super_admin": False,
        "companies": [int(row["Company_Id"])],
        "api_key_id": int(row["Key_Id"]),
        "api_key_scopes": scopes,
        "company_id": int(row["Company_Id"]),
    }
