from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.security import get_password_hash
from app.db.session import get_connection, get_transaction


PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$"
)


def list_admins(company_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT u.User_Id, u.Name, u.Lastname, u.Username, u.Email,
                       u.PhoneNumber, u.Area, u.RolId, u.IsActive, u.DateCreate
                FROM ERP_USERS u
                JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
                WHERE uc.Company_Id = :company_id AND u.RolId = 2
                ORDER BY u.Name
                """
            ),
            {"company_id": company_id},
        ).mappings().all()
    return [dict(r) for r in rows]


def create_company_admin(company_id: int, payload: dict[str, Any], creator_id: int) -> dict[str, Any]:
    username = (payload.get("Username") or "").strip()
    password = payload.get("Password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username y Password son requeridos")

    if not PASSWORD_REGEX.match(password):
        raise HTTPException(
            status_code=400,
            detail="Password invalida: minimo 12 caracteres, debe incluir mayuscula, minuscula, numero y simbolo",
        )

    with get_connection() as conn:
        exists = conn.execute(
            text("SELECT User_Id FROM ERP_USERS WHERE Username = :username"),
            {"username": username},
        ).mappings().first()
        if exists:
            raise HTTPException(status_code=409, detail="El usuario ya existe")

        company = conn.execute(
            text("SELECT Company_Id FROM ERP_COMPANY WHERE Company_Id = :company_id"),
            {"company_id": company_id},
        ).mappings().first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")

    hashed = get_password_hash(password)

    with get_transaction() as conn:
        result = conn.execute(
            text(
                """
                INSERT INTO ERP_USERS (
                    Name, Lastname, Username, Password, Email,
                    PhoneNumber, Area, RolId, DateCreate, IsActive, LastLogin, CreatedBy
                )
                OUTPUT INSERTED.User_Id
                VALUES (
                    :name, :lastname, :username, :password, :email,
                    :phone, :area, 2, GETDATE(), 1, NULL, :created_by
                )
                """
            ),
            {
                "name": payload.get("Name") or username,
                "lastname": payload.get("Lastname") or "",
                "username": username,
                "password": hashed,
                "email": payload.get("Email") or "",
                "phone": payload.get("PhoneNumber") or "",
                "area": payload.get("Area") or "",
                "created_by": creator_id,
            },
        )
        row = result.first()
        new_id = int(row[0]) if row else None
        if not new_id:
            raise HTTPException(status_code=500, detail="Error al crear usuario")

        conn.execute(
            text("INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id) VALUES (:uid, :cid)"),
            {"uid": new_id, "cid": company_id},
        )

        modules = conn.execute(
            text("SELECT ModuleKey FROM ERP_MODULES WHERE IsActive = 1")
        ).mappings().all()
        for m in modules:
            conn.execute(
                text(
                    """
                    INSERT INTO ERP_USER_PERMISSIONS (User_Id, ModuleKey, CanAccess, CreatedBy)
                    VALUES (:uid, :mk, 1, :created_by)
                    """
                ),
                {"uid": new_id, "mk": m["ModuleKey"], "created_by": creator_id},
            )

    return {"msg": "Admin creado", "User_Id": new_id}


def update_company_admin(company_id: int, user_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        link = conn.execute(
            text(
                """
                SELECT 1 FROM ERP_USERCOMPANIES uc
                JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                WHERE uc.User_Id = :uid AND uc.Company_Id = :cid AND u.RolId = 2
                """
            ),
            {"uid": user_id, "cid": company_id},
        ).mappings().first()
        if not link:
            raise HTTPException(status_code=404, detail="Admin no encontrado en esta empresa")

    updates: list[str] = []
    params: dict[str, Any] = {"uid": user_id}

    if payload.get("Name") is not None:
        updates.append("Name = :name")
        params["name"] = payload["Name"]
    if payload.get("Lastname") is not None:
        updates.append("Lastname = :lastname")
        params["lastname"] = payload["Lastname"]
    if payload.get("Email") is not None:
        updates.append("Email = :email")
        params["email"] = payload["Email"]
    if payload.get("IsActive") is not None:
        updates.append("IsActive = :is_active")
        params["is_active"] = 1 if payload["IsActive"] else 0
    if payload.get("Password"):
        if not PASSWORD_REGEX.match(payload["Password"]):
            raise HTTPException(status_code=400, detail="Password invalida")
        updates.append("Password = :password")
        params["password"] = get_password_hash(payload["Password"])

    if updates:
        with get_transaction() as conn:
            conn.execute(
                text(f"UPDATE ERP_USERS SET {', '.join(updates)} WHERE User_Id = :uid"),
                params,
            )
    return {"msg": "Admin actualizado"}


def remove_company_admin(company_id: int, user_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        link = conn.execute(
            text(
                """
                SELECT 1 FROM ERP_USERCOMPANIES uc
                JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                WHERE uc.User_Id = :uid AND uc.Company_Id = :cid AND u.RolId = 2
                """
            ),
            {"uid": user_id, "cid": company_id},
        ).mappings().first()
        if not link:
            raise HTTPException(status_code=404, detail="Admin no encontrado en esta empresa")

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_USERS SET RolId = 3 WHERE User_Id = :uid"),
            {"uid": user_id},
        )
    return {"msg": "Rol de admin revocado"}
