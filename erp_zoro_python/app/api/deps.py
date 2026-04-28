from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.services.auth_service import get_authenticated_user
from app.services.licencia_service import evaluate_login_access
from app.services import apikey_service


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado (token faltante)",
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
        ) from exc

    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
        )

    user = get_authenticated_user(int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    if not bool(user.get("IsActive")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )

    all_companies = [int(company_id) for company_id in user.get("companies") or [] if int(company_id or 0)]
    license_status = evaluate_login_access(all_companies, user_id=int(user_id))
    if not license_status.get("allow_login"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(license_status.get("message") or "Acceso denegado por licencia"),
        )

    user["all_companies"] = all_companies
    user["companies"] = license_status.get("allowed_company_ids") or all_companies
    user["licensed_companies"] = user["companies"]
    user["license_mode"] = license_status.get("mode")
    user["license_warning"] = license_status.get("warning")

    # Si el token es de impersonación, respetar las restricciones del JWT:
    # companies limitadas a la empresa impersonada e is_super_admin=False
    if payload.get("_impersonating"):
        jwt_companies = [int(c) for c in (payload.get("companies") or []) if c]
        user["companies"] = jwt_companies
        user["all_companies"] = jwt_companies
        user["licensed_companies"] = jwt_companies
        user["is_super_admin"] = False

    return user


def get_auth_token(
    authorization: str | None = Header(default=None),
) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None
    return parts[1]


def require_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores pueden realizar esta accion.",
        )
    return current_user


def get_current_user_or_apikey(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict[str, Any]:
    if x_api_key:
        user = apikey_service.validate_api_key(x_api_key)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API Key inválida o expirada",
            )
        return user
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado (token faltante)",
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
        ) from exc
    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
        )
    user = get_authenticated_user(int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    if not bool(user.get("IsActive")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )
    all_companies = [int(c) for c in user.get("companies") or [] if int(c or 0)]
    license_status = evaluate_login_access(all_companies, user_id=int(user_id))
    if not license_status.get("allow_login"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(license_status.get("message") or "Acceso denegado por licencia"),
        )
    user["all_companies"] = all_companies
    user["companies"] = license_status.get("allowed_company_ids") or all_companies
    user["licensed_companies"] = user["companies"]
    user["license_mode"] = license_status.get("mode")
    user["license_warning"] = license_status.get("warning")
    return user


def require_super_admin(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if not current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo SuperAdmin puede realizar esta accion.",
        )
    return current_user
