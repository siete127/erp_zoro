from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.session import get_connection, get_transaction


LICENSE_TYPES = [
    "Administrativa",
    "Direccion",
    "Ventas",
    "Compras",
    "Produccion",
    "RH",
    "Timbrado",
    "CRM",
]


def _is_missing_license_table(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    return "erp_licencias" in message and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
    )


def _is_missing_sessions_table(exc: Exception) -> bool:
    if not isinstance(exc, DBAPIError):
        return False
    message = str(exc).lower()
    return "erp_user_sessions" in message and (
        "invalid object name" in message
        or "nombre de objeto no valido" in message
    )


def _to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.fromisoformat(str(value)).date()
    except Exception:
        return None


def _safe_int(value: Any, default: int | None = None) -> int | None:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except Exception:
        return default


def _company_placeholders(company_ids: list[int], prefix: str = "cid") -> tuple[str, dict[str, int]]:
    placeholders: list[str] = []
    params: dict[str, int] = {}
    for idx, company_id in enumerate(company_ids):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = int(company_id)
    return ", ".join(placeholders), params


def _current_user_id(current_user: dict[str, Any]) -> int:
    return int(current_user.get("User_Id") or current_user.get("id") or 0)


def _current_user_companies(current_user: dict[str, Any]) -> list[int]:
    raw = current_user.get("companies") or []
    return [int(company_id) for company_id in raw if int(company_id or 0)]


def _is_super_admin(current_user: dict[str, Any]) -> bool:
    return bool(current_user.get("is_super_admin")) or int(current_user.get("RolId") or 0) == 1


def _ensure_company_access(company_id: int, current_user: dict[str, Any]) -> None:
    if _is_super_admin(current_user):
        return
    if int(company_id or 0) not in _current_user_companies(current_user):
        raise HTTPException(status_code=403, detail="Sin acceso a la empresa seleccionada")


def _format_license_row(row: dict[str, Any]) -> dict[str, Any]:
    data = dict(row)
    today = date.today()
    fecha_inicio = _to_date(data.get("FechaInicio"))
    fecha_vencimiento = _to_date(data.get("FechaVencimiento"))
    activa = bool(data.get("Activa"))
    vigente = activa and (fecha_inicio is None or fecha_inicio <= today) and (
        fecha_vencimiento is None or fecha_vencimiento >= today
    )

    dias_restantes = None
    if fecha_vencimiento:
        dias_restantes = (fecha_vencimiento - today).days

    data["Activa"] = activa
    data["Vigente"] = vigente
    data["DiasRestantes"] = dias_restantes
    return data


def _get_active_sessions_by_company(
    company_ids: list[int],
    current_user_id: int | None = None,
) -> tuple[dict[int, int], set[int]]:
    normalized_company_ids = [int(company_id) for company_id in company_ids if int(company_id or 0)]
    if not normalized_company_ids:
        return {}, set()

    placeholders, params = _company_placeholders(normalized_company_ids, prefix="scid")
    params["current_user_id"] = int(current_user_id or 0)

    query = f"""
        SELECT
            uc.Company_Id,
            COUNT(DISTINCT s.User_Id) AS UsuariosActivos,
            MAX(CASE WHEN s.User_Id = :current_user_id THEN 1 ELSE 0 END) AS UsuarioActualActivo
        FROM ERP_USERCOMPANIES uc
        LEFT JOIN ERP_USER_SESSIONS s
            ON s.User_Id = uc.User_Id
           AND s.LogoutTime IS NULL
        WHERE uc.Company_Id IN ({placeholders})
        GROUP BY uc.Company_Id
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).mappings().all()
    except Exception as exc:
        if _is_missing_sessions_table(exc):
            return {}, set()
        raise

    active_sessions: dict[int, int] = {}
    current_user_active_companies: set[int] = set()
    for row in rows:
        company_id = int(row.get("Company_Id") or 0)
        active_sessions[company_id] = int(row.get("UsuariosActivos") or 0)
        if int(row.get("UsuarioActualActivo") or 0) == 1:
            current_user_active_companies.add(company_id)

    return active_sessions, current_user_active_companies


def _apply_usage_metrics(row: dict[str, Any], active_sessions: dict[int, int]) -> dict[str, Any]:
    data = _format_license_row(row)
    company_id = int(data.get("Company_Id") or 0)
    usuarios_activos = int(active_sessions.get(company_id) or 0)
    max_usuarios = _safe_int(data.get("MaxUsuarios"))
    cupo_disponible = None
    cupo_lleno = False

    if max_usuarios is not None and max_usuarios > 0:
        cupo_disponible = max(max_usuarios - usuarios_activos, 0)
        cupo_lleno = usuarios_activos >= max_usuarios

    data["UsuariosActivos"] = usuarios_activos
    data["CupoDisponible"] = cupo_disponible
    data["CupoLleno"] = cupo_lleno
    return data


def _audit(action: str, current_user: dict[str, Any], company_id: int | None, detail: dict[str, Any]) -> None:
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
                        'licencias',
                        :detalle
                    )
                    """
                ),
                {
                    "usuario_id": _current_user_id(current_user),
                    "empresa_id": _safe_int(company_id),
                    "accion": action,
                    "detalle": json.dumps(detail, ensure_ascii=True),
                },
            )
    except Exception:
        pass


def list_license_types() -> list[str]:
    return LICENSE_TYPES[:]


def list_licenses(current_user: dict[str, Any], company_id: int | None = None) -> list[dict[str, Any]]:
    user_companies = _current_user_companies(current_user)
    is_super_admin = _is_super_admin(current_user)

    if company_id is not None:
        _ensure_company_access(int(company_id), current_user)

    if not is_super_admin and not user_companies:
        return []

    where_clauses = ["1 = 1"]
    params: dict[str, Any] = {}

    if company_id is not None:
        where_clauses.append("l.Company_Id = :company_id")
        params["company_id"] = int(company_id)
    elif not is_super_admin:
        placeholders, company_params = _company_placeholders(user_companies)
        where_clauses.append(f"l.Company_Id IN ({placeholders})")
        params.update(company_params)

    query = f"""
        SELECT
            l.Licencia_Id,
            l.Company_Id,
            c.NameCompany AS CompanyName,
            l.Tipo,
            l.FechaInicio,
            l.FechaVencimiento,
            CAST(ISNULL(l.Activa, 0) AS BIT) AS Activa,
            l.MaxUsuarios,
            l.Observaciones,
            l.FechaCreacion,
            l.FechaActualizacion
        FROM ERP_LICENCIAS l
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = l.Company_Id
        WHERE {' AND '.join(where_clauses)}
        ORDER BY l.Company_Id, l.Tipo, l.FechaVencimiento DESC, l.Licencia_Id DESC
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).mappings().all()
    except Exception as exc:
        if _is_missing_license_table(exc):
            return []
        raise

    active_sessions, _ = _get_active_sessions_by_company(
        list({int(row.get("Company_Id") or 0) for row in rows}),
    )
    return [_apply_usage_metrics(dict(row), active_sessions) for row in rows]


def create_license(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = _safe_int(payload.get("Company_Id"))
    tipo = str(payload.get("Tipo") or "").strip()
    fecha_inicio = payload.get("FechaInicio")
    fecha_vencimiento = payload.get("FechaVencimiento")
    activa = bool(payload.get("Activa", True))
    max_usuarios = _safe_int(payload.get("MaxUsuarios"))
    observaciones = str(payload.get("Observaciones") or "").strip() or None

    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not tipo:
        raise HTTPException(status_code=400, detail="Tipo es requerido")
    if tipo not in LICENSE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de licencia invalido")
    if not fecha_inicio:
        raise HTTPException(status_code=400, detail="FechaInicio es requerida")

    _ensure_company_access(company_id, current_user)

    try:
        with get_transaction() as connection:
            inserted = connection.execute(
                text(
                    """
                    INSERT INTO ERP_LICENCIAS (
                        Company_Id,
                        Tipo,
                        FechaInicio,
                        FechaVencimiento,
                        Activa,
                        MaxUsuarios,
                        Observaciones,
                        FechaCreacion,
                        FechaActualizacion
                    )
                    OUTPUT INSERTED.*
                    VALUES (
                        :company_id,
                        :tipo,
                        :fecha_inicio,
                        :fecha_vencimiento,
                        :activa,
                        :max_usuarios,
                        :observaciones,
                        GETDATE(),
                        GETDATE()
                    )
                    """
                ),
                {
                    "company_id": company_id,
                    "tipo": tipo,
                    "fecha_inicio": fecha_inicio,
                    "fecha_vencimiento": fecha_vencimiento,
                    "activa": 1 if activa else 0,
                    "max_usuarios": max_usuarios,
                    "observaciones": observaciones,
                },
            ).mappings().first()
    except Exception as exc:
        if _is_missing_license_table(exc):
            raise HTTPException(
                status_code=503,
                detail="ERP_LICENCIAS no esta inicializada. Ejecuta fase_3_licencias.sql",
            ) from exc
        raise

    _audit(
        "CREATE",
        current_user,
        company_id,
        {"tipo": tipo, "fecha_inicio": fecha_inicio, "fecha_vencimiento": fecha_vencimiento},
    )
    return _format_license_row(dict(inserted))


def update_license(licencia_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    licencia_id = int(licencia_id)

    with get_connection() as connection:
        existing = connection.execute(
            text("SELECT * FROM ERP_LICENCIAS WHERE Licencia_Id = :licencia_id"),
            {"licencia_id": licencia_id},
        ).mappings().first()

    if not existing:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")

    existing_dict = dict(existing)
    company_id = int(existing_dict.get("Company_Id") or 0)
    _ensure_company_access(company_id, current_user)

    next_values = {
        "tipo": str(payload.get("Tipo") or existing_dict.get("Tipo") or "").strip(),
        "fecha_inicio": payload.get("FechaInicio") or existing_dict.get("FechaInicio"),
        "fecha_vencimiento": payload.get("FechaVencimiento") if "FechaVencimiento" in payload else existing_dict.get("FechaVencimiento"),
        "activa": 1 if bool(payload.get("Activa", existing_dict.get("Activa"))) else 0,
        "max_usuarios": _safe_int(payload.get("MaxUsuarios"), _safe_int(existing_dict.get("MaxUsuarios"))),
        "observaciones": (
            str(payload.get("Observaciones")).strip()
            if "Observaciones" in payload and payload.get("Observaciones") is not None
            else existing_dict.get("Observaciones")
        ),
    }

    if next_values["tipo"] not in LICENSE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de licencia invalido")

    try:
        with get_transaction() as connection:
            updated = connection.execute(
                text(
                    """
                    UPDATE ERP_LICENCIAS
                    SET
                        Tipo = :tipo,
                        FechaInicio = :fecha_inicio,
                        FechaVencimiento = :fecha_vencimiento,
                        Activa = :activa,
                        MaxUsuarios = :max_usuarios,
                        Observaciones = :observaciones,
                        FechaActualizacion = GETDATE()
                    OUTPUT INSERTED.*
                    WHERE Licencia_Id = :licencia_id
                    """
                ),
                {
                    "licencia_id": licencia_id,
                    **next_values,
                },
            ).mappings().first()
    except Exception as exc:
        if _is_missing_license_table(exc):
            raise HTTPException(
                status_code=503,
                detail="ERP_LICENCIAS no esta inicializada. Ejecuta fase_3_licencias.sql",
            ) from exc
        raise

    _audit("UPDATE", current_user, company_id, {"licencia_id": licencia_id, **next_values})
    return _format_license_row(dict(updated))


def delete_license(licencia_id: int, current_user: dict[str, Any]) -> dict[str, str]:
    licencia_id = int(licencia_id)

    with get_connection() as connection:
        existing = connection.execute(
            text("SELECT * FROM ERP_LICENCIAS WHERE Licencia_Id = :licencia_id"),
            {"licencia_id": licencia_id},
        ).mappings().first()

    if not existing:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")

    company_id = int(existing.get("Company_Id") or 0)
    _ensure_company_access(company_id, current_user)

    try:
        with get_transaction() as connection:
            connection.execute(
                text("DELETE FROM ERP_LICENCIAS WHERE Licencia_Id = :licencia_id"),
                {"licencia_id": licencia_id},
            )
    except Exception as exc:
        if _is_missing_license_table(exc):
            raise HTTPException(
                status_code=503,
                detail="ERP_LICENCIAS no esta inicializada. Ejecuta fase_3_licencias.sql",
            ) from exc
        raise

    _audit("DELETE", current_user, company_id, {"licencia_id": licencia_id})
    return {"msg": "Licencia eliminada"}


def evaluate_login_access(company_ids: list[int], user_id: int | None = None) -> dict[str, Any]:
    normalized_company_ids = [int(company_id) for company_id in company_ids if int(company_id or 0)]
    if not normalized_company_ids:
        return {
            "allow_login": True,
            "allowed_company_ids": [],
            "mode": "no_companies",
            "warning": None,
            "message": None,
        }

    placeholders, params = _company_placeholders(normalized_company_ids)
    query = f"""
        SELECT
            Licencia_Id,
            Company_Id,
            Tipo,
            FechaInicio,
            FechaVencimiento,
            CAST(ISNULL(Activa, 0) AS BIT) AS Activa,
            MaxUsuarios
        FROM ERP_LICENCIAS
        WHERE Company_Id IN ({placeholders})
        ORDER BY Company_Id, FechaVencimiento DESC, Licencia_Id DESC
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(text(query), params).mappings().all()
    except Exception as exc:
        if _is_missing_license_table(exc):
            return {
                "allow_login": True,
                "allowed_company_ids": normalized_company_ids,
                "mode": "missing_table",
                "warning": None,
                "message": None,
            }
        raise

    if not rows:
        return {
            "allow_login": True,
            "allowed_company_ids": normalized_company_ids,
            "mode": "unconfigured",
            "warning": None,
            "message": None,
        }

    active_sessions, current_user_active_companies = _get_active_sessions_by_company(
        normalized_company_ids,
        current_user_id=user_id,
    )

    allowed_company_ids: set[int] = set()
    nearest_days: int | None = None
    seat_warnings: list[str] = []
    saturated_companies: set[int] = set()

    for row in rows:
        formatted = _apply_usage_metrics(dict(row), active_sessions)
        company_id = int(formatted["Company_Id"])
        max_usuarios = _safe_int(formatted.get("MaxUsuarios"))
        usuarios_activos = int(formatted.get("UsuariosActivos") or 0)
        cupo_lleno = bool(formatted.get("CupoLleno"))
        current_user_already_active = company_id in current_user_active_companies

        if formatted["Vigente"] and not (
            cupo_lleno and not current_user_already_active and max_usuarios is not None and max_usuarios > 0
        ):
            allowed_company_ids.add(company_id)
        elif formatted["Vigente"] and cupo_lleno and not current_user_already_active:
            saturated_companies.add(company_id)

        dias_restantes = formatted.get("DiasRestantes")
        if formatted["Activa"] and dias_restantes is not None and dias_restantes >= 0:
            nearest_days = dias_restantes if nearest_days is None else min(nearest_days, dias_restantes)

        if max_usuarios is not None and max_usuarios > 0 and usuarios_activos >= max_usuarios:
            seat_warnings.append(
                f"Empresa {company_id} llego al limite de {max_usuarios} usuario(s) activos."
            )

    if not allowed_company_ids:
        if saturated_companies:
            return {
                "allow_login": False,
                "allowed_company_ids": [],
                "mode": "seat_limit",
                "warning": None,
                "message": "No hay cupo disponible en las licencias activas de las empresas asignadas.",
            }
        return {
            "allow_login": False,
            "allowed_company_ids": [],
            "mode": "blocked",
            "warning": None,
            "message": "No hay licencias activas vigentes para las empresas asignadas a este usuario.",
        }

    warning = None
    if nearest_days is not None and nearest_days <= 15:
        warning = f"Una licencia vence en {nearest_days} dia(s)."
    if seat_warnings:
        seat_warning = " ".join(dict.fromkeys(seat_warnings))
        warning = f"{warning} {seat_warning}".strip() if warning else seat_warning

    return {
        "allow_login": True,
        "allowed_company_ids": sorted(allowed_company_ids),
        "mode": "enforced",
        "warning": warning,
        "message": None,
    }
