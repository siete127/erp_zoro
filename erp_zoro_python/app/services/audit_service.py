from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.session import get_connection


def _is_missing_audit_table(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    return "erp_audit_logs" in message and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
    )


def _company_placeholders(company_ids: list[int], prefix: str = "cid") -> tuple[str, dict[str, int]]:
    placeholders: list[str] = []
    params: dict[str, int] = {}
    for idx, company_id in enumerate(company_ids):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = int(company_id)
    return ", ".join(placeholders), params


def _is_super_admin(current_user: dict[str, Any]) -> bool:
    return bool(current_user.get("is_super_admin")) or int(current_user.get("RolId") or 0) == 1


def _current_user_companies(current_user: dict[str, Any]) -> list[int]:
    raw = current_user.get("companies") or []
    return [int(company_id) for company_id in raw if int(company_id or 0)]


def _ensure_company_access(company_id: int, current_user: dict[str, Any]) -> None:
    if _is_super_admin(current_user):
        return
    if int(company_id or 0) not in _current_user_companies(current_user):
        raise HTTPException(status_code=403, detail="Sin acceso a la empresa seleccionada")


def _parse_detail(raw_value: Any) -> Any:
    if raw_value in (None, ""):
        return None
    try:
        return json.loads(str(raw_value))
    except Exception:
        return raw_value


def list_modules(current_user: dict[str, Any]) -> list[str]:
    where_clauses = ["1 = 1"]
    params: dict[str, Any] = {}

    if not _is_super_admin(current_user):
        user_companies = _current_user_companies(current_user)
        if not user_companies:
            return []
        placeholders, company_params = _company_placeholders(user_companies)
        where_clauses.append(f"(empresa_id IS NULL OR empresa_id IN ({placeholders}))")
        params.update(company_params)

    query = f"""
        SELECT DISTINCT modulo
        FROM ERP_AUDIT_LOGS
        WHERE {' AND '.join(where_clauses)}
          AND modulo IS NOT NULL
        ORDER BY modulo
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).all()
    except Exception as exc:
        if _is_missing_audit_table(exc):
            return []
        raise

    return [str(row[0]) for row in rows if row and row[0]]


def list_audit_logs(
    current_user: dict[str, Any],
    company_id: int | None = None,
    modulo: str | None = None,
    accion: str | None = None,
    user_id: int | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 100), 500))

    if company_id is not None:
        _ensure_company_access(int(company_id), current_user)

    where_clauses = ["1 = 1"]
    params: dict[str, Any] = {}

    if company_id is not None:
        where_clauses.append("l.empresa_id = :company_id")
        params["company_id"] = int(company_id)
    elif not _is_super_admin(current_user):
        user_companies = _current_user_companies(current_user)
        if not user_companies:
            return []
        placeholders, company_params = _company_placeholders(user_companies)
        where_clauses.append(f"(l.empresa_id IS NULL OR l.empresa_id IN ({placeholders}))")
        params.update(company_params)

    if modulo:
        where_clauses.append("l.modulo = :modulo")
        params["modulo"] = str(modulo).strip()
    if accion:
        where_clauses.append("l.accion = :accion")
        params["accion"] = str(accion).strip()
    if user_id is not None:
        where_clauses.append("l.usuario_id = :user_id")
        params["user_id"] = int(user_id)
    if fecha_desde:
        where_clauses.append("CAST(l.fecha AS DATE) >= :fecha_desde")
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where_clauses.append("CAST(l.fecha AS DATE) <= :fecha_hasta")
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT TOP {limit}
            l.id,
            l.usuario_id,
            l.empresa_id,
            l.accion,
            l.modulo,
            l.fecha,
            l.detalle,
            l.ip,
            l.user_agent,
            u.Username,
            u.Name,
            c.NameCompany
        FROM ERP_AUDIT_LOGS l
        LEFT JOIN ERP_USERS u ON u.User_Id = l.usuario_id
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = l.empresa_id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY l.fecha DESC, l.id DESC
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).mappings().all()
    except Exception as exc:
        if _is_missing_audit_table(exc):
            return []
        raise

    items: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["DetalleJson"] = _parse_detail(item.get("detalle"))
        items.append(item)
    return items
