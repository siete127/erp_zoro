from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text

from app.core.security import get_password_hash
from app.db.session import get_connection, get_transaction
from app.services.permission_service import ensure_modules_exist
from app.utils.phone import format_phone


PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$"
)
FIXED_ADMIN_ROLE_ID = 2


def normalize_company_ids(ids: list[int] | None) -> list[int]:
    if not ids:
        return []
    cleaned: list[int] = []
    for value in ids:
        try:
            number = int(value)
        except (TypeError, ValueError):
            continue
        if number > 0:
            cleaned.append(number)
    return cleaned


def can_access_company(current_user: dict[str, Any], company_id: int) -> bool:
    if current_user.get("is_super_admin"):
        return True
    user_companies = current_user.get("companies") or []
    return int(company_id) in [int(item) for item in user_companies]


def can_access_all_companies(current_user: dict[str, Any], company_ids: list[int]) -> bool:
    if current_user.get("is_super_admin"):
        return True
    user_companies = {int(item) for item in current_user.get("companies") or []}
    return all(int(company_id) in user_companies for company_id in company_ids)


def _in_clause(prefix: str, values: list[int]) -> tuple[str, dict[str, int]]:
    placeholders: list[str] = []
    params: dict[str, int] = {}
    for index, value in enumerate(values):
        name = f"{prefix}_{index}"
        placeholders.append(f":{name}")
        params[name] = int(value)
    return ", ".join(placeholders), params


def register_user(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    ensure_modules_exist()
    username = payload.get("Username")
    password = payload.get("Password")
    selected_permissions = payload.get("Permissions") or []
    allowed_modules = {
        str(permission.get("ModuleKey") or "").strip().lower()
        for permission in selected_permissions
        if permission.get("CanAccess")
    }
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username y Password son requeridos")

    if not allowed_modules:
        raise HTTPException(
            status_code=400,
            detail="Debe seleccionar al menos una vista o modulo para crear el usuario",
        )

    if not PASSWORD_REGEX.match(password):
        raise HTTPException(
            status_code=400,
            detail="Password invalida: minimo 12 caracteres, debe incluir mayuscula, minuscula, numero y simbolo",
        )

    incoming_company_ids = normalize_company_ids(payload.get("Company_Ids"))
    if not current_user.get("is_super_admin"):
        if not incoming_company_ids:
            raise HTTPException(
                status_code=400,
                detail="Debe asignar al menos una empresa al usuario",
            )
        if not can_access_all_companies(current_user, incoming_company_ids):
            raise HTTPException(
                status_code=403,
                detail="Solo puede asignar usuarios a empresas a las que usted pertenece",
            )

    with get_connection() as connection:
        exists = connection.execute(
            text("SELECT User_Id FROM ERP_USERS WHERE Username = :username"),
            {"username": username},
        ).mappings().first()
        if exists:
            raise HTTPException(status_code=409, detail="El usuario ya existe")

    formatted_phone = format_phone(payload.get("PhoneNumber"))
    creator_id = int(payload.get("CreatedBy") or current_user.get("User_Id") or 1)
    hashed = get_password_hash(password)

    with get_transaction() as connection:
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_USERS (
                    Name,
                    Lastname,
                    Username,
                    Password,
                    Email,
                    PhoneNumber,
                    Area,
                    RolId,
                    DateCreate,
                    IsActive,
                    LastLogin,
                    CreatedBy
                )
                OUTPUT INSERTED.User_Id
                VALUES (
                    :name,
                    :lastname,
                    :username,
                    :password,
                    :email,
                    :phone_number,
                    :area,
                    :rol_id,
                    GETDATE(),
                    :is_active,
                    NULL,
                    :created_by
                )
                """
            ),
            {
                "name": payload.get("Name"),
                "lastname": payload.get("Lastname"),
                "username": username,
                "password": hashed,
                "email": payload.get("Email"),
                "phone_number": formatted_phone or payload.get("PhoneNumber"),
                "area": payload.get("Area"),
                "rol_id": payload.get("RolId"),
                "is_active": 1 if payload.get("IsActive", True) else 0,
                "created_by": creator_id,
            },
        )
        new_id_row = result.first()
        new_id = int(new_id_row[0]) if new_id_row else None

        if new_id and incoming_company_ids:
            for company_id in incoming_company_ids:
                connection.execute(
                    text(
                        """
                        INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id)
                        VALUES (:user_id, :company_id)
                        """
                    ),
                    {"user_id": new_id, "company_id": company_id},
                )

        if new_id:
            modules = connection.execute(
                text("SELECT ModuleKey FROM ERP_MODULES WHERE IsActive = 1")
            ).mappings().all()
            for module in modules:
                module_key = str(module["ModuleKey"]).strip().lower()
                connection.execute(
                    text(
                        """
                        INSERT INTO ERP_USER_PERMISSIONS (User_Id, ModuleKey, CanAccess, CreatedBy)
                        VALUES (:user_id, :module_key, :can_access, :created_by)
                        """
                    ),
                    {
                        "user_id": new_id,
                        "module_key": module_key,
                        "can_access": 1 if module_key in allowed_modules else 0,
                        "created_by": creator_id,
                    },
                )

    return {"msg": "Usuario creado", "User_Id": new_id}


def list_users(current_user: dict[str, Any], company_id_raw: str | None) -> list[dict[str, Any]]:
    where_parts: list[str] = []
    params: dict[str, Any] = {}

    if not current_user.get("is_super_admin"):
        user_companies = normalize_company_ids(current_user.get("companies"))
        if not user_companies:
            return []
        clause, clause_params = _in_clause("user_company", user_companies)
        where_parts.append(f"uc.Company_Id IN ({clause})")
        params.update(clause_params)
        # Excluir superadmins (RolId=1) de la vista de administradores de empresa
        where_parts.append("u.RolId != 1")

    if company_id_raw and company_id_raw != "all":
        try:
            company_id = int(company_id_raw)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="company_id invalido") from exc
        if not can_access_company(current_user, company_id):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para consultar usuarios de esta empresa",
            )
        where_parts.append("uc.Company_Id = :company_id")
        params["company_id"] = company_id

    where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
    query = f"""
        SELECT
            u.User_Id,
            u.Name,
            u.Lastname,
            u.Username,
            u.Password,
            u.Email,
            u.PhoneNumber,
            u.Area,
            u.RolId,
            u.DateCreate,
            u.IsActive,
            u.LastLogin,
            u.CreatedBy,
            STRING_AGG(c.NameCompany, ', ') AS NameCompany
        FROM ERP_USERS u
        LEFT JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
        LEFT JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
        {where_clause}
        GROUP BY
            u.User_Id,
            u.Name,
            u.Lastname,
            u.Username,
            u.Password,
            u.Email,
            u.PhoneNumber,
            u.Area,
            u.RolId,
            u.DateCreate,
            u.IsActive,
            u.LastLogin,
            u.CreatedBy
    """

    with get_connection() as connection:
        result = connection.execute(text(query), params)
        return [dict(row) for row in result.mappings().all()]


def get_user(user_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        user = connection.execute(
            text("SELECT * FROM ERP_USERS WHERE User_Id = :user_id"),
            {"user_id": user_id},
        ).mappings().first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        companies = connection.execute(
            text(
                """
                SELECT uc.Company_Id, c.NameCompany
                FROM ERP_USERCOMPANIES uc
                JOIN ERP_COMPANY c ON uc.Company_Id = c.Company_Id
                WHERE uc.User_Id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().all()

    target_company_ids = [int(company["Company_Id"]) for company in companies]
    if not current_user.get("is_super_admin") and not can_access_all_companies(
        current_user,
        target_company_ids,
    ):
        raise HTTPException(status_code=403, detail="No tiene permisos para ver este usuario")

    response = dict(user)
    response["companies"] = [dict(company) for company in companies]
    return response


def update_user(user_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, str]:
    incoming_company_ids = normalize_company_ids(payload.get("Company_Ids"))
    with get_connection() as connection:
        target_companies_rows = connection.execute(
            text("SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = :user_id"),
            {"user_id": user_id},
        ).mappings().all()
        target_role_row = connection.execute(
            text("SELECT RolId FROM ERP_USERS WHERE User_Id = :user_id"),
            {"user_id": user_id},
        ).mappings().first()

    target_company_ids = [int(row["Company_Id"]) for row in target_companies_rows]
    target_role_id = int(target_role_row["RolId"]) if target_role_row and target_role_row["RolId"] is not None else None
    if not current_user.get("is_super_admin") and not can_access_all_companies(
        current_user,
        target_company_ids,
    ):
        raise HTTPException(status_code=403, detail="No tiene permisos para editar este usuario")

    if (
        not current_user.get("is_super_admin")
        and incoming_company_ids
        and not can_access_all_companies(current_user, incoming_company_ids)
    ):
        raise HTTPException(
            status_code=403,
            detail="No puede asignar empresas fuera de su alcance",
        )

    formatted_phone = format_phone(payload.get("PhoneNumber"))
    with get_transaction() as connection:
        if payload.get("Password"):
            connection.execute(
                text("UPDATE ERP_USERS SET Password = :password WHERE User_Id = :user_id"),
                {
                    "password": get_password_hash(payload["Password"]),
                    "user_id": user_id,
                },
            )

        connection.execute(
            text(
                """
                UPDATE ERP_USERS
                SET
                    Name = :name,
                    Lastname = :lastname,
                    Email = :email,
                    PhoneNumber = :phone_number,
                    Area = :area,
                    RolId = :rol_id,
                    IsActive = :is_active
                WHERE User_Id = :user_id
                """
            ),
            {
                "name": payload.get("Name"),
                "lastname": payload.get("Lastname"),
                "email": payload.get("Email"),
                "phone_number": formatted_phone or payload.get("PhoneNumber"),
                "area": payload.get("Area"),
                "rol_id": target_role_id if target_role_id == FIXED_ADMIN_ROLE_ID else payload.get("RolId"),
                "is_active": (
                    1
                    if payload.get("IsActive") is True
                    else 0
                    if payload.get("IsActive") is False
                    else None
                ),
                "user_id": user_id,
            },
        )

        connection.execute(
            text("DELETE FROM ERP_USERCOMPANIES WHERE User_Id = :user_id"),
            {"user_id": user_id},
        )

        for company_id in incoming_company_ids:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id)
                    VALUES (:user_id, :company_id)
                    """
                ),
                {"user_id": user_id, "company_id": company_id},
            )

    return {"msg": "Usuario actualizado"}


def toggle_active(user_id: int, is_active: bool, current_user: dict[str, Any]) -> dict[str, str]:
    with get_connection() as connection:
        companies_rows = connection.execute(
            text("SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = :user_id"),
            {"user_id": user_id},
        ).mappings().all()

    target_company_ids = [int(row["Company_Id"]) for row in companies_rows]
    if not current_user.get("is_super_admin") and not can_access_all_companies(
        current_user,
        target_company_ids,
    ):
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para cambiar estado de este usuario",
        )

    with get_transaction() as connection:
        connection.execute(
            text("UPDATE ERP_USERS SET IsActive = :is_active WHERE User_Id = :user_id"),
            {"is_active": 1 if is_active else 0, "user_id": user_id},
        )
    return {"msg": "Estado actualizado"}


def delete_user(user_id: int, current_user: dict[str, Any]) -> dict[str, str]:
    with get_connection() as connection:
        companies_rows = connection.execute(
            text("SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = :user_id"),
            {"user_id": user_id},
        ).mappings().all()

    target_company_ids = [int(row["Company_Id"]) for row in companies_rows]
    if not current_user.get("is_super_admin") and not can_access_all_companies(
        current_user,
        target_company_ids,
    ):
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para eliminar este usuario",
        )

    with get_transaction() as connection:
        connection.execute(
            text("DELETE FROM ERP_USER_SESSIONS WHERE User_Id = :user_id"),
            {"user_id": user_id},
        )
        connection.execute(
            text("DELETE FROM ERP_USERS WHERE User_Id = :user_id"),
            {"user_id": user_id},
        )
    return {"msg": "Usuario eliminado permanentemente"}
