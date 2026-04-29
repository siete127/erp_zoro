from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.utils.company_access import can_access_company, user_company_ids, build_in_clause


def _check_company(current_user: dict, company_id: int) -> None:
    if not can_access_company(current_user, company_id):
        raise HTTPException(status_code=403, detail="Sin acceso a esta empresa")


def _company_filter(current_user: dict, params: dict, alias: str = "") -> str:
    prefix = f"{alias}." if alias else ""
    if current_user.get("is_admin"):
        return ""
    companies = user_company_ids(current_user)
    if not companies:
        raise HTTPException(status_code=403, detail="Sin empresas asignadas")
    clause, clause_params = build_in_clause("company", companies)
    params.update(clause_params)
    return f" AND {prefix}Company_Id IN ({clause})"


# ---------- Cuentas bancarias ----------

def list_cuentas(current_user: dict[str, Any], company_id: int | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {}
    query = """
        SELECT cb.CuentaBancaria_Id, cb.Company_Id, c.NameCompany, cb.Banco,
               cb.NumCuenta, cb.Clabe, cb.Titular, cb.RFC, cb.Moneda,
               cb.SaldoInicial, cb.Activa, cb.CreatedAt,
               ISNULL(SUM(CASE WHEN m.Tipo='ABONO' THEN m.Monto ELSE -m.Monto END), 0) AS SaldoMovimientos
        FROM ERP_CUENTAS_BANCARIAS cb
        LEFT JOIN ERP_COMPANY c ON c.Company_Id = cb.Company_Id
        LEFT JOIN ERP_MOVIMIENTOS_BANCARIOS m ON m.CuentaBancaria_Id = cb.CuentaBancaria_Id
        WHERE cb.Activa = 1
    """
    query += _company_filter(current_user, params, "cb")
    if company_id:
        query += " AND cb.Company_Id = :filter_company"
        params["filter_company"] = company_id
    query += " GROUP BY cb.CuentaBancaria_Id, cb.Company_Id, c.NameCompany, cb.Banco, cb.NumCuenta, cb.Clabe, cb.Titular, cb.RFC, cb.Moneda, cb.SaldoInicial, cb.Activa, cb.CreatedAt"
    query += " ORDER BY cb.Banco"

    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()

    result = []
    for r in rows:
        d = dict(r)
        d["SaldoActual"] = round(float(d.get("SaldoInicial") or 0) + float(d.get("SaldoMovimientos") or 0), 2)
        result.append(d)
    return {"success": True, "data": result}


def create_cuenta(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    company_id = payload.get("Company_Id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company_Id requerido")
    _check_company(current_user, int(company_id))

    with get_transaction() as conn:
        result = conn.execute(
            text("""
                INSERT INTO ERP_CUENTAS_BANCARIAS (Company_Id, Banco, NumCuenta, Clabe, Titular, RFC, Moneda, SaldoInicial)
                OUTPUT INSERTED.CuentaBancaria_Id
                VALUES (:company_id, :banco, :num_cuenta, :clabe, :titular, :rfc, :moneda, :saldo_inicial)
            """),
            {
                "company_id": company_id,
                "banco": payload.get("Banco"),
                "num_cuenta": payload.get("NumCuenta"),
                "clabe": payload.get("Clabe"),
                "titular": payload.get("Titular"),
                "rfc": payload.get("RFC"),
                "moneda": payload.get("Moneda") or "MXN",
                "saldo_inicial": float(payload.get("SaldoInicial") or 0),
            },
        )
        cid = result.scalar()
    return {"success": True, "message": "Cuenta bancaria creada", "data": {"CuentaBancaria_Id": cid}}


# ---------- Movimientos ----------

def list_movimientos(
    cuenta_id: int,
    current_user: dict[str, Any],
    conciliado: bool | None = None,
    tipo: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
) -> dict[str, Any]:
    with get_connection() as conn:
        cuenta = conn.execute(
            text("SELECT Company_Id FROM ERP_CUENTAS_BANCARIAS WHERE CuentaBancaria_Id=:id"),
            {"id": cuenta_id},
        ).mappings().first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    _check_company(current_user, int(cuenta["Company_Id"]))

    params: dict[str, Any] = {"cuenta_id": cuenta_id}
    query = """
        SELECT m.Movimiento_Id, m.FechaMovimiento, m.Descripcion, m.Monto, m.Tipo,
               m.Referencia, m.Conciliado, m.FechaConciliacion, m.Pago_Id, m.Notas, m.CreatedAt
        FROM ERP_MOVIMIENTOS_BANCARIOS m
        WHERE m.CuentaBancaria_Id = :cuenta_id
    """
    if conciliado is not None:
        query += " AND m.Conciliado = :conciliado"
        params["conciliado"] = 1 if conciliado else 0
    if tipo:
        query += " AND m.Tipo = :tipo"
        params["tipo"] = tipo.upper()
    if fecha_desde:
        query += " AND m.FechaMovimiento >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        query += " AND m.FechaMovimiento <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    query += " ORDER BY m.FechaMovimiento DESC"

    with get_connection() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return {"success": True, "data": [dict(r) for r in rows]}


def importar_movimientos_csv(cuenta_id: int, csv_text: str, current_user: dict[str, Any]) -> dict[str, Any]:
    """
    Parsea un CSV de estado de cuenta con columnas:
    fecha, descripcion, cargo, abono, referencia
    Acepta variantes de BBVA y Banamex (separador coma o punto y coma).
    """
    with get_connection() as conn:
        cuenta = conn.execute(
            text("SELECT Company_Id FROM ERP_CUENTAS_BANCARIAS WHERE CuentaBancaria_Id=:id"),
            {"id": cuenta_id},
        ).mappings().first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    _check_company(current_user, int(cuenta["Company_Id"]))

    sep = ";" if ";" in csv_text[:500] else ","
    reader = csv.DictReader(io.StringIO(csv_text.strip()), delimiter=sep)

    header_map: dict[str, str] = {}
    if reader.fieldnames:
        for fn in reader.fieldnames:
            fl = fn.lower().strip()
            if "fecha" in fl:
                header_map["fecha"] = fn
            elif "desc" in fl or "concepto" in fl or "detail" in fl:
                header_map["descripcion"] = fn
            elif "cargo" in fl or "debito" in fl or "retiro" in fl:
                header_map["cargo"] = fn
            elif "abono" in fl or "credito" in fl or "deposito" in fl:
                header_map["abono"] = fn
            elif "ref" in fl or "folio" in fl:
                header_map["referencia"] = fn

    insertados = 0
    errores = 0

    with get_transaction() as conn:
        for row in reader:
            try:
                fecha_raw = row.get(header_map.get("fecha", ""), "").strip()
                if not fecha_raw:
                    continue

                # Soportar dd/mm/yyyy y yyyy-mm-dd
                if "/" in fecha_raw:
                    partes = fecha_raw.split("/")
                    if len(partes) == 3:
                        if len(partes[2]) == 4:
                            fecha_raw = f"{partes[2]}-{partes[1].zfill(2)}-{partes[0].zfill(2)}"
                        else:
                            fecha_raw = f"{partes[0]}-{partes[1].zfill(2)}-{partes[2].zfill(2)}"

                descripcion = row.get(header_map.get("descripcion", ""), "").strip()[:499]
                referencia = row.get(header_map.get("referencia", ""), "").strip()[:99] if "referencia" in header_map else None

                cargo_raw = row.get(header_map.get("cargo", ""), "0").strip().replace(",", "").replace("$", "") or "0"
                abono_raw = row.get(header_map.get("abono", ""), "0").strip().replace(",", "").replace("$", "") or "0"

                cargo = float(cargo_raw) if cargo_raw else 0.0
                abono = float(abono_raw) if abono_raw else 0.0

                if cargo > 0:
                    conn.execute(
                        text("""
                            INSERT INTO ERP_MOVIMIENTOS_BANCARIOS
                                (CuentaBancaria_Id, FechaMovimiento, Descripcion, Monto, Tipo, Referencia, Origen)
                            VALUES (:cid, :fecha, :desc, :monto, 'CARGO', :ref, 'IMPORTADO')
                        """),
                        {"cid": cuenta_id, "fecha": fecha_raw, "desc": descripcion, "monto": cargo, "ref": referencia},
                    )
                    insertados += 1
                if abono > 0:
                    conn.execute(
                        text("""
                            INSERT INTO ERP_MOVIMIENTOS_BANCARIOS
                                (CuentaBancaria_Id, FechaMovimiento, Descripcion, Monto, Tipo, Referencia, Origen)
                            VALUES (:cid, :fecha, :desc, :monto, 'ABONO', :ref, 'IMPORTADO')
                        """),
                        {"cid": cuenta_id, "fecha": fecha_raw, "desc": descripcion, "monto": abono, "ref": referencia},
                    )
                    insertados += 1
            except Exception:
                errores += 1

    return {"success": True, "message": f"Importados {insertados} movimientos, {errores} errores", "data": {"insertados": insertados, "errores": errores}}


def conciliar_movimiento(movimiento_id: int, pago_id: int | None, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as conn:
        mov = conn.execute(
            text("""
                SELECT m.Movimiento_Id, cb.Company_Id, m.Conciliado
                FROM ERP_MOVIMIENTOS_BANCARIOS m
                JOIN ERP_CUENTAS_BANCARIAS cb ON cb.CuentaBancaria_Id = m.CuentaBancaria_Id
                WHERE m.Movimiento_Id = :id
            """),
            {"id": movimiento_id},
        ).mappings().first()
    if not mov:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    _check_company(current_user, int(mov["Company_Id"]))
    if mov["Conciliado"]:
        raise HTTPException(status_code=400, detail="El movimiento ya está conciliado")

    with get_transaction() as conn:
        conn.execute(
            text("""
                UPDATE ERP_MOVIMIENTOS_BANCARIOS
                SET Conciliado=1, FechaConciliacion=GETDATE(), Pago_Id=:pago_id
                WHERE Movimiento_Id=:id
            """),
            {"id": movimiento_id, "pago_id": pago_id},
        )
    return {"success": True, "message": "Movimiento conciliado"}


def auto_conciliar(cuenta_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    """
    Matching automático: busca movimientos ABONO sin conciliar y los cruza contra
    ERP_PAGOS_CLIENTE por monto exacto y fecha ±3 días.
    """
    with get_connection() as conn:
        cuenta = conn.execute(
            text("SELECT Company_Id FROM ERP_CUENTAS_BANCARIAS WHERE CuentaBancaria_Id=:id"),
            {"id": cuenta_id},
        ).mappings().first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    _check_company(current_user, int(cuenta["Company_Id"]))
    company_id = int(cuenta["Company_Id"])

    with get_connection() as conn:
        movimientos = conn.execute(
            text("""
                SELECT Movimiento_Id, FechaMovimiento, Monto
                FROM ERP_MOVIMIENTOS_BANCARIOS
                WHERE CuentaBancaria_Id=:cid AND Conciliado=0 AND Tipo='ABONO'
            """),
            {"cid": cuenta_id},
        ).mappings().all()

    conciliados = 0
    with get_transaction() as conn:
        for mov in movimientos:
            fecha = mov["FechaMovimiento"]
            monto = float(mov["Monto"])
            pago = conn.execute(
                text("""
                    SELECT TOP 1 Pago_Id FROM ERP_PAGOS_CLIENTE
                    WHERE Company_Id=:cid AND Monto=:monto
                      AND FechaPago BETWEEN DATEADD(day,-3,:fecha) AND DATEADD(day,3,:fecha)
                      AND Conciliado=0
                """),
                {"cid": company_id, "monto": monto, "fecha": fecha},
            ).mappings().first()

            if pago:
                conn.execute(
                    text("""
                        UPDATE ERP_MOVIMIENTOS_BANCARIOS
                        SET Conciliado=1, FechaConciliacion=GETDATE(), Pago_Id=:pago_id
                        WHERE Movimiento_Id=:mid
                    """),
                    {"pago_id": int(pago["Pago_Id"]), "mid": int(mov["Movimiento_Id"])},
                )
                # Marcar pago como conciliado si la columna existe
                try:
                    conn.execute(
                        text("UPDATE ERP_PAGOS_CLIENTE SET Conciliado=1 WHERE Pago_Id=:pid"),
                        {"pid": int(pago["Pago_Id"])},
                    )
                except Exception:
                    pass
                conciliados += 1

    return {"success": True, "message": f"Auto-conciliados {conciliados} movimientos", "data": {"conciliados": conciliados}}
