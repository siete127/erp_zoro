from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services import ledger_service
from app.utils.company_access import build_in_clause, can_access_company, user_company_ids


VALID_ESTATUS = {"ACTIVO", "BAJA", "VENDIDO"}


def _check_company(current_user: dict[str, Any], company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _parse_date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(str(value)[:10]).date()


def _parse_period(value: Any | None) -> date:
    parsed = _parse_date(value) or date.today()
    return parsed.replace(day=1)


def _base_monthly_depreciation(activo: dict[str, Any]) -> float:
    valor_adq = float(activo.get("ValorAdquisicion") or 0)
    valor_residual = float(activo.get("ValorResidual") or 0)
    vida_util = int(activo.get("VidaUtilMeses") or 0)
    if vida_util <= 0:
        return 0.0
    depreciable = max(valor_adq - valor_residual, 0.0)
    if depreciable <= 0:
        return 0.0
    return round(depreciable / vida_util, 2)


def _preview_asset_depreciation(conn, activo: dict[str, Any], periodo: date) -> dict[str, Any]:
    existing = conn.execute(
        text("SELECT TOP 1 * FROM ERP_DEPRECIACIONES WHERE Activo_Id = :aid AND Periodo = :periodo"),
        {"aid": int(activo["Activo_Id"]), "periodo": periodo},
    ).mappings().first()
    if existing:
        return {
            "Activo_Id": int(activo["Activo_Id"]),
            "Nombre": activo.get("Nombre"),
            "Monto": float(existing["Monto"] or 0),
            "ValorLibros": float(existing["ValorLibros"] or 0),
            "YaAplicada": True,
            "Aplicada": bool(existing.get("Aplicada")),
            "Deprec_Id": int(existing["Deprec_Id"]),
        }

    fecha_adquisicion = _parse_date(activo.get("FechaAdquisicion"))
    if not fecha_adquisicion or fecha_adquisicion.replace(day=1) > periodo:
        return {
            "Activo_Id": int(activo["Activo_Id"]),
            "Nombre": activo.get("Nombre"),
            "Monto": 0.0,
            "ValorLibros": float(activo.get("ValorActual") or activo.get("ValorAdquisicion") or 0),
            "YaAplicada": False,
            "Aplicada": False,
        }

    acumulada_row = conn.execute(
        text("SELECT CAST(COALESCE(SUM(Monto), 0) AS DECIMAL(18, 2)) AS Monto FROM ERP_DEPRECIACIONES WHERE Activo_Id = :aid"),
        {"aid": int(activo["Activo_Id"])},
    ).mappings().first()
    depreciacion_acum = float(acumulada_row["Monto"] or 0)
    valor_adq = float(activo.get("ValorAdquisicion") or 0)
    valor_residual = float(activo.get("ValorResidual") or 0)
    restante = max(valor_adq - valor_residual - depreciacion_acum, 0.0)
    mensual = _base_monthly_depreciation(activo)
    monto = min(mensual, restante) if restante > 0 else 0.0
    valor_libros = max(valor_residual, valor_adq - depreciacion_acum - monto)
    return {
        "Activo_Id": int(activo["Activo_Id"]),
        "Nombre": activo.get("Nombre"),
        "Monto": round(monto, 2),
        "ValorLibros": round(valor_libros, 2),
        "YaAplicada": False,
        "Aplicada": False,
    }


def _recalc_asset_values(conn, activo_id: int) -> None:
    conn.execute(
        text(
            """
            UPDATE a
            SET
                DepreciacionAcum = COALESCE(agg.DepreciacionAcum, 0),
                ValorActual = CASE
                    WHEN a.ValorAdquisicion - COALESCE(agg.DepreciacionAcum, 0) < COALESCE(a.ValorResidual, 0)
                        THEN COALESCE(a.ValorResidual, 0)
                    ELSE a.ValorAdquisicion - COALESCE(agg.DepreciacionAcum, 0)
                END,
                UpdatedAt = GETDATE()
            FROM ERP_ACTIVOS_FIJOS a
            OUTER APPLY (
                SELECT CAST(COALESCE(SUM(Monto), 0) AS DECIMAL(18, 2)) AS DepreciacionAcum
                FROM ERP_DEPRECIACIONES
                WHERE Activo_Id = :aid
            ) agg
            WHERE a.Activo_Id = :aid
            """
        ),
        {"aid": activo_id},
    )


def list_activos(current_user: dict[str, Any], filtros: dict[str, Any]) -> list[dict[str, Any]]:
    params: dict[str, Any] = {}
    where: list[str] = []

    if not current_user.get("is_admin") and not current_user.get("is_super_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            return []
        clause, clause_params = build_in_clause("company", companies)
        where.append(f"a.Company_Id IN ({clause})")
        params.update(clause_params)

    if filtros.get("company_id"):
        company_id = int(filtros["company_id"])
        _check_company(current_user, company_id)
        where.append("a.Company_Id = :company_id")
        params["company_id"] = company_id

    if filtros.get("estatus"):
        where.append("a.Estatus = :estatus")
        params["estatus"] = str(filtros["estatus"]).upper()

    if filtros.get("categoria"):
        where.append("a.Categoria = :categoria")
        params["categoria"] = filtros["categoria"]

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    with get_connection() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT
                    a.*,
                    c.NameCompany,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS ResponsableNombre,
                    al.Nombre AS AlmacenNombre,
                    CAST(
                        CASE
                            WHEN ISNULL(a.VidaUtilMeses, 0) > 0
                                THEN (ISNULL(a.ValorAdquisicion, 0) - ISNULL(a.ValorResidual, 0)) / NULLIF(a.VidaUtilMeses, 0)
                            ELSE 0
                        END AS DECIMAL(18, 2)
                    ) AS DepreciacionMensual,
                    ISNULL(dep.TotalDepreciaciones, 0) AS TotalDepreciaciones
                FROM ERP_ACTIVOS_FIJOS a
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = a.Company_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = a.Responsable_Id
                LEFT JOIN ERP_ALMACENES al ON al.Almacen_Id = a.Almacen_Id
                OUTER APPLY (
                    SELECT COUNT(1) AS TotalDepreciaciones
                    FROM ERP_DEPRECIACIONES d
                    WHERE d.Activo_Id = a.Activo_Id
                ) dep
                {where_sql}
                ORDER BY
                    CASE a.Estatus WHEN 'ACTIVO' THEN 1 WHEN 'BAJA' THEN 2 ELSE 3 END,
                    a.FechaAdquisicion DESC,
                    a.Activo_Id DESC
                """
            ),
            params,
        ).mappings().all()
    return [dict(row) for row in rows]


def get_activo(activo_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        activo = conn.execute(
            text(
                """
                SELECT
                    a.*,
                    c.NameCompany,
                    LTRIM(RTRIM(COALESCE(u.Name, '') + ' ' + COALESCE(u.Lastname, ''))) AS ResponsableNombre,
                    al.Nombre AS AlmacenNombre,
                    CAST(
                        CASE
                            WHEN ISNULL(a.VidaUtilMeses, 0) > 0
                                THEN (ISNULL(a.ValorAdquisicion, 0) - ISNULL(a.ValorResidual, 0)) / NULLIF(a.VidaUtilMeses, 0)
                            ELSE 0
                        END AS DECIMAL(18, 2)
                    ) AS DepreciacionMensual
                FROM ERP_ACTIVOS_FIJOS a
                LEFT JOIN ERP_COMPANY c ON c.Company_Id = a.Company_Id
                LEFT JOIN ERP_USERS u ON u.User_Id = a.Responsable_Id
                LEFT JOIN ERP_ALMACENES al ON al.Almacen_Id = a.Almacen_Id
                WHERE a.Activo_Id = :aid
                """
            ),
            {"aid": activo_id},
        ).mappings().first()
        if not activo:
            raise HTTPException(status_code=404, detail="Activo no encontrado")
        _check_company(current_user, int(activo["Company_Id"]))

        depreciaciones = conn.execute(
            text(
                """
                SELECT *
                FROM ERP_DEPRECIACIONES
                WHERE Activo_Id = :aid
                ORDER BY Periodo DESC, Deprec_Id DESC
                """
            ),
            {"aid": activo_id},
        ).mappings().all()

    return {"activo": dict(activo), "depreciaciones": [dict(row) for row in depreciaciones]}


def create_activo(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = int(payload.get("Company_Id") or 0)
    nombre = str(payload.get("Nombre") or "").strip()
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id es requerido")
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre es requerido")
    _check_company(current_user, company_id)

    estatus = str(payload.get("Estatus") or "ACTIVO").upper()
    if estatus not in VALID_ESTATUS:
        raise HTTPException(status_code=400, detail="Estatus invalido")

    valor_adq = float(payload.get("ValorAdquisicion") or 0)
    valor_residual = float(payload.get("ValorResidual") or 0)
    valor_actual = max(valor_adq, valor_residual)

    with get_transaction() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO ERP_ACTIVOS_FIJOS
                    (Company_Id, Nombre, Categoria, NumeroSerie, NumeroEconomico,
                     FechaAdquisicion, ValorAdquisicion, VidaUtilMeses, MetodoDeprec,
                     ValorResidual, ValorActual, DepreciacionAcum, Estatus,
                     Responsable_Id, Almacen_Id, Notas, CuentaDeprec, CuentaActivo)
                OUTPUT INSERTED.Activo_Id
                VALUES
                    (:company_id, :nombre, :categoria, :numero_serie, :numero_economico,
                     :fecha_adquisicion, :valor_adquisicion, :vida_util, :metodo,
                     :valor_residual, :valor_actual, 0, :estatus,
                     :responsable_id, :almacen_id, :notas, :cuenta_deprec, :cuenta_activo)
                """
            ),
            {
                "company_id": company_id,
                "nombre": nombre,
                "categoria": payload.get("Categoria"),
                "numero_serie": payload.get("NumeroSerie"),
                "numero_economico": payload.get("NumeroEconomico"),
                "fecha_adquisicion": payload.get("FechaAdquisicion"),
                "valor_adquisicion": valor_adq,
                "vida_util": payload.get("VidaUtilMeses"),
                "metodo": payload.get("MetodoDeprec") or "LINEA_RECTA",
                "valor_residual": valor_residual,
                "valor_actual": valor_actual,
                "estatus": estatus,
                "responsable_id": payload.get("Responsable_Id"),
                "almacen_id": payload.get("Almacen_Id"),
                "notas": payload.get("Notas"),
                "cuenta_deprec": payload.get("CuentaDeprec"),
                "cuenta_activo": payload.get("CuentaActivo"),
            },
        ).mappings().first()

    return {"success": True, "Activo_Id": int(row["Activo_Id"])}


def update_activo(activo_id: int, payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        activo = conn.execute(
            text("SELECT * FROM ERP_ACTIVOS_FIJOS WHERE Activo_Id = :aid"),
            {"aid": activo_id},
        ).mappings().first()
        if not activo:
            raise HTTPException(status_code=404, detail="Activo no encontrado")
        _check_company(current_user, int(activo["Company_Id"]))

        if "Estatus" in payload:
            status_value = str(payload.get("Estatus") or "").upper()
            if status_value not in VALID_ESTATUS:
                raise HTTPException(status_code=400, detail="Estatus invalido")

        fields: list[str] = []
        params: dict[str, Any] = {"aid": activo_id}
        for column, key in [
            ("Nombre", "Nombre"),
            ("Categoria", "Categoria"),
            ("NumeroSerie", "NumeroSerie"),
            ("NumeroEconomico", "NumeroEconomico"),
            ("FechaAdquisicion", "FechaAdquisicion"),
            ("ValorAdquisicion", "ValorAdquisicion"),
            ("VidaUtilMeses", "VidaUtilMeses"),
            ("MetodoDeprec", "MetodoDeprec"),
            ("ValorResidual", "ValorResidual"),
            ("Estatus", "Estatus"),
            ("Responsable_Id", "Responsable_Id"),
            ("Almacen_Id", "Almacen_Id"),
            ("Notas", "Notas"),
            ("CuentaDeprec", "CuentaDeprec"),
            ("CuentaActivo", "CuentaActivo"),
        ]:
            if key in payload:
                fields.append(f"{column} = :{column}")
                params[column] = payload.get(key)

        if not fields:
            return {"success": True}

        fields.append("UpdatedAt = GETDATE()")
        conn.execute(
            text(f"UPDATE ERP_ACTIVOS_FIJOS SET {', '.join(fields)} WHERE Activo_Id = :aid"),
            params,
        )
        _recalc_asset_values(conn, activo_id)

    return {"success": True}


def delete_activo(activo_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_transaction() as conn:
        activo = conn.execute(
            text("SELECT Company_Id FROM ERP_ACTIVOS_FIJOS WHERE Activo_Id = :aid"),
            {"aid": activo_id},
        ).mappings().first()
        if not activo:
            raise HTTPException(status_code=404, detail="Activo no encontrado")
        _check_company(current_user, int(activo["Company_Id"]))

        dep_count = conn.execute(
            text("SELECT COUNT(1) AS Total FROM ERP_DEPRECIACIONES WHERE Activo_Id = :aid"),
            {"aid": activo_id},
        ).mappings().first()
        if int(dep_count["Total"] or 0) > 0:
            conn.execute(
                text("UPDATE ERP_ACTIVOS_FIJOS SET Estatus = 'BAJA', UpdatedAt = GETDATE() WHERE Activo_Id = :aid"),
                {"aid": activo_id},
            )
            return {"success": True, "message": "Activo marcado como BAJA porque ya tiene depreciaciones"}

        conn.execute(text("DELETE FROM ERP_ACTIVOS_FIJOS WHERE Activo_Id = :aid"), {"aid": activo_id})

    return {"success": True, "message": "Activo eliminado"}


def calcular_depreciacion_mes(
    current_user: dict[str, Any],
    *,
    company_id: int,
    periodo: str | None = None,
) -> dict[str, Any]:
    _check_company(current_user, company_id)
    periodo_date = _parse_period(periodo)

    with get_connection() as conn:
        activos = conn.execute(
            text("SELECT * FROM ERP_ACTIVOS_FIJOS WHERE Company_Id = :cid AND Estatus = 'ACTIVO' ORDER BY Nombre"),
            {"cid": company_id},
        ).mappings().all()

        data = [_preview_asset_depreciation(conn, dict(activo), periodo_date) for activo in activos]

    total = round(sum(float(item["Monto"] or 0) for item in data), 2)
    return {"periodo": periodo_date.isoformat(), "total": total, "data": data}


def aplicar_depreciaciones_mes(
    current_user: dict[str, Any],
    *,
    company_id: int,
    periodo: str | None = None,
) -> dict[str, Any]:
    _check_company(current_user, company_id)
    periodo_date = _parse_period(periodo)

    aplicados = 0
    omitidos = 0
    total = 0.0

    with get_transaction() as conn:
        activos = conn.execute(
            text("SELECT * FROM ERP_ACTIVOS_FIJOS WHERE Company_Id = :cid AND Estatus = 'ACTIVO' ORDER BY Nombre"),
            {"cid": company_id},
        ).mappings().all()

        for activo_row in activos:
            activo = dict(activo_row)
            preview = _preview_asset_depreciation(conn, activo, periodo_date)
            monto = float(preview.get("Monto") or 0)
            if preview.get("YaAplicada") or monto <= 0:
                omitidos += 1
                continue

            description = f"[DEPRECIACION] {activo.get('Nombre')} {periodo_date.isoformat()}"
            ledger_id = ledger_service.post_entry(
                conn,
                company_id=company_id,
                debit_account=str(activo.get("CuentaDeprec") or ""),
                credit_account=str(activo.get("CuentaActivo") or ""),
                amount=monto,
                reference_id=int(activo["Activo_Id"]),
                description=description,
                date=periodo_date,
            )

            conn.execute(
                text(
                    """
                    INSERT INTO ERP_DEPRECIACIONES
                        (Activo_Id, Periodo, Monto, ValorLibros, Aplicada, Ledger_Id)
                    VALUES
                        (:activo_id, :periodo, :monto, :valor_libros, :aplicada, :ledger_id)
                    """
                ),
                {
                    "activo_id": int(activo["Activo_Id"]),
                    "periodo": periodo_date,
                    "monto": monto,
                    "valor_libros": preview.get("ValorLibros"),
                    "aplicada": 1 if ledger_id else 0,
                    "ledger_id": ledger_id,
                },
            )
            _recalc_asset_values(conn, int(activo["Activo_Id"]))

            aplicados += 1
            total += monto

    return {
        "success": True,
        "periodo": periodo_date.isoformat(),
        "aplicados": aplicados,
        "omitidos": omitidos,
        "total": round(total, 2),
    }
