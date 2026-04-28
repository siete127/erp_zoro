from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from app.core.security import create_access_token, verify_password
from app.db.session import get_connection, get_transaction
from app.services import licencia_service


def _audit_auth_event(
    action: str,
    user_id: int | None,
    company_id: int | None,
    detail: dict[str, Any],
) -> None:
    if not user_id:
        return

    try:
        with get_transaction() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_AUDIT_LOGS (
                        usuario_id,
                        empresa_id,
                        accion,
                        modulo,
                        detalle
                    )
                    VALUES (
                        :usuario_id,
                        :empresa_id,
                        :accion,
                        'auth',
                        :detalle
                    )
                    """
                ),
                {
                    "usuario_id": int(user_id),
                    "empresa_id": int(company_id) if company_id else None,
                    "accion": action,
                    "detalle": json.dumps(detail, ensure_ascii=True),
                },
            )
    except Exception:
        pass


def _get_user_companies(user_id: int) -> list[int]:
    with get_connection() as connection:
        result = connection.execute(
            text(
                "SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = :user_id"
            ),
            {"user_id": user_id},
        )
        return [int(row.Company_Id) for row in result]


def get_authenticated_user(user_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        user_result = connection.execute(
            text(
                """
                SELECT u.*, r.Name AS RolName
                FROM ERP_USERS u
                LEFT JOIN ERP_ROL r ON u.RolId = r.Rol_Id
                WHERE u.User_Id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        user = user_result.mappings().first()
        if not user:
            return None

    companies = _get_user_companies(int(user["User_Id"]))
    user_dict = dict(user)
    user_dict["companies"] = companies
    rol_id = int(user_dict.get("RolId") or 0)
    user_dict["is_super_admin"] = rol_id == 1
    role_name = str(user_dict.get("RolName") or "").lower()
    user_dict["is_admin"] = rol_id in {1, 2} or ("admin" in role_name)
    return user_dict


def login(username: str, password: str) -> dict[str, Any]:
    with get_connection() as connection:
        result = connection.execute(
            text(
                "SELECT * FROM ERP_USERS WHERE Username = :username AND IsActive = 1"
            ),
            {"username": username},
        )
        user = result.mappings().first()

    if not user:
        raise ValueError("Usuario no existe")

    if not verify_password(password, str(user["Password"])):
        raise ValueError("Password incorrecto")

    user_companies = _get_user_companies(int(user["User_Id"]))
    license_status = licencia_service.evaluate_login_access(
        user_companies,
        user_id=int(user["User_Id"]),
    )
    if not license_status.get("allow_login"):
        raise PermissionError(
            str(license_status.get("message") or "Acceso denegado por licencia")
        )

    allowed_company_ids = license_status.get("allowed_company_ids") or user_companies
    rol_id = int(user.get("RolId") or 0)
    token = create_access_token(
        {
            "id": int(user["User_Id"]),
            "rol": rol_id,
            "companies": allowed_company_ids,
            "is_super_admin": rol_id == 1,  # Añadir flag de SuperAdmin
        }
    )

    session_id = None
    with get_transaction() as connection:
        connection.execute(
            text("UPDATE ERP_USERS SET LastLogin = GETDATE() WHERE User_Id = :user_id"),
            {"user_id": int(user["User_Id"])},
        )
        try:
            session_result = connection.execute(
                text(
                    """
                    INSERT INTO ERP_USER_SESSIONS (User_Id, LoginTime, Token)
                    OUTPUT INSERTED.Session_Id
                    VALUES (:user_id, GETDATE(), :token)
                    """
                ),
                {"user_id": int(user["User_Id"]), "token": token},
            )
            session_row = session_result.first()
            session_id = int(session_row[0]) if session_row else None
        except Exception:
            session_id = None

    refreshed_user = get_authenticated_user(int(user["User_Id"])) or dict(user)
    refreshed_user["all_companies"] = list(refreshed_user.get("companies") or user_companies)
    refreshed_user["companies"] = allowed_company_ids
    refreshed_user["licensed_companies"] = allowed_company_ids
    refreshed_user["license_mode"] = license_status.get("mode")
    refreshed_user["license_warning"] = license_status.get("warning")
    _audit_auth_event(
        "LOGIN",
        int(user["User_Id"]),
        allowed_company_ids[0] if allowed_company_ids else (user_companies[0] if user_companies else None),
        {
            "username": str(user.get("Username") or username),
            "session_id": session_id,
            "licensed_companies": allowed_company_ids,
            "license_mode": license_status.get("mode"),
        },
    )
    return {
        "token": token,
        "user": refreshed_user,
        "sessionId": session_id,
    }


def logout(session_id: int | None, token: str | None) -> dict[str, str]:
    if not session_id and not token:
        raise ValueError("sessionId o token requerido")

    with get_transaction() as connection:
        if session_id:
            session_row = connection.execute(
                text(
                    """
                    SELECT TOP 1 s.Session_Id, s.User_Id, uc.Company_Id
                    FROM ERP_USER_SESSIONS s
                    LEFT JOIN ERP_USERCOMPANIES uc ON uc.User_Id = s.User_Id
                    WHERE s.Session_Id = :session_id
                    """
                ),
                {"session_id": session_id},
            ).mappings().first()
            connection.execute(
                text(
                    """
                    UPDATE ERP_USER_SESSIONS
                    SET LogoutTime = GETDATE()
                    WHERE Session_Id = :session_id AND LogoutTime IS NULL
                    """
                ),
                {"session_id": session_id},
            )
            if session_row:
                _audit_auth_event(
                    "LOGOUT",
                    int(session_row.get("User_Id") or 0),
                    int(session_row.get("Company_Id") or 0) or None,
                    {"session_id": session_id},
                )
            return {"msg": "Logout registrado"}

        session_row = connection.execute(
            text(
                """
                SELECT TOP 1 s.Session_Id, s.User_Id, uc.Company_Id
                FROM ERP_USER_SESSIONS s
                LEFT JOIN ERP_USERCOMPANIES uc ON uc.User_Id = s.User_Id
                WHERE s.Token = :token
                """
            ),
            {"token": token},
        ).mappings().first()
        connection.execute(
            text(
                """
                UPDATE ERP_USER_SESSIONS
                SET LogoutTime = GETDATE()
                WHERE Token = :token AND LogoutTime IS NULL
                """
            ),
            {"token": token},
        )
        if session_row:
            _audit_auth_event(
                "LOGOUT",
                int(session_row.get("User_Id") or 0),
                int(session_row.get("Company_Id") or 0) or None,
                {"session_id": session_row.get("Session_Id")},
            )
        return {"msg": "Logout registrado por token"}
