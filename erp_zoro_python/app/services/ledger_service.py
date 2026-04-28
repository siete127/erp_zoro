"""
Asientos contables automáticos en ERP_LEDGER.

Cada función recibe una conexión abierta dentro de un get_transaction() del
servicio llamante, inserta las partidas dobles y retorna silenciosamente si
no existen las cuentas configuradas para esa empresa (nunca bloquea la
transacción principal).
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection


# ---------------------------------------------------------------------------
# Helpers privados
# ---------------------------------------------------------------------------

def _find_account(conn: Connection, company_id: int, *keywords: str) -> str | None:
    """Devuelve el primer AccountCode cuyo Name contenga alguna de las keywords."""
    clauses = []
    params: dict[str, Any] = {"company_id": company_id}
    for i, kw in enumerate(keywords):
        key = f"kw_{i}"
        clauses.append(f"LOWER(Name) LIKE :{key}")
        params[key] = f"%{kw.lower()}%"

    row = conn.execute(
        text(
            f"""
            SELECT TOP 1 AccountCode
            FROM ERP_ACCOUNTS
            WHERE ({' OR '.join(clauses)}) AND Company_Id = :company_id
            ORDER BY AccountCode
            """
        ),
        params,
    ).mappings().first()
    return row["AccountCode"] if row else None


def _account_exists(conn: Connection, company_id: int, account_code: str | None) -> bool:
    if not account_code:
        return False

    row = conn.execute(
        text(
            """
            SELECT TOP 1 1 AS ok
            FROM ERP_ACCOUNTS
            WHERE Company_Id = :company_id AND AccountCode = :account_code
            """
        ),
        {"company_id": company_id, "account_code": account_code},
    ).mappings().first()
    return bool(row)


def _resolve_account(
    conn: Connection,
    company_id: int,
    *,
    fallback_code: str | None = None,
    keywords: tuple[str, ...] = (),
) -> str | None:
    account_code = _find_account(conn, company_id, *keywords) if keywords else None
    if _account_exists(conn, company_id, account_code):
        return account_code
    if _account_exists(conn, company_id, fallback_code):
        return fallback_code
    return None


def _already_posted(conn: Connection, reference_id: int, module: str) -> bool:
    """Evita duplicar asientos si se llama más de una vez."""
    row = conn.execute(
        text(
            """
            SELECT COUNT(1) AS cnt FROM ERP_LEDGER
            WHERE Reference_Id = :ref AND Description LIKE :mod
            """
        ),
        {"ref": reference_id, "mod": f"[{module}]%"},
    ).mappings().first()
    return int(row["cnt"] or 0) > 0


def _post(
    conn: Connection,
    *,
    company_id: int,
    account_code: str,
    debit: float,
    credit: float,
    reference_id: int,
    description: str,
    entry_date: date | datetime | None = None,
) -> int:
    params = {
        "account_code": account_code,
        "debit": round(debit, 2),
        "credit": round(credit, 2),
        "ref_id": reference_id,
        "company_id": company_id,
        "description": description,
    }

    if entry_date is None:
        query = """
            INSERT INTO ERP_LEDGER
                (Date, AccountCode, Debit, Credit, Reference_Id, Company_Id, Description, CreatedAt)
            OUTPUT INSERTED.Ledger_Id
            VALUES
                (GETDATE(), :account_code, :debit, :credit, :ref_id, :company_id, :description, GETDATE())
        """
    else:
        params["entry_date"] = entry_date
        query = """
            INSERT INTO ERP_LEDGER
                (Date, AccountCode, Debit, Credit, Reference_Id, Company_Id, Description, CreatedAt)
            OUTPUT INSERTED.Ledger_Id
            VALUES
                (:entry_date, :account_code, :debit, :credit, :ref_id, :company_id, :description, GETDATE())
        """

    return int(conn.execute(text(query), params).scalar())


def post_entry(
    conn: Connection,
    *,
    company_id: int,
    debit_account: str,
    credit_account: str,
    amount: float,
    reference_id: int,
    description: str,
    date: date | datetime | None = None,
) -> int | None:
    amount_value = round(float(amount or 0), 2)
    if amount_value <= 0:
        return None
    if not _account_exists(conn, company_id, debit_account):
        return None
    if not _account_exists(conn, company_id, credit_account):
        return None

    debit_id = _post(
        conn,
        company_id=company_id,
        account_code=debit_account,
        debit=amount_value,
        credit=0,
        reference_id=reference_id,
        description=description,
        entry_date=date,
    )
    _post(
        conn,
        company_id=company_id,
        account_code=credit_account,
        debit=0,
        credit=amount_value,
        reference_id=reference_id,
        description=description,
        entry_date=date,
    )
    return debit_id


# ---------------------------------------------------------------------------
# Asiento: Venta confirmada
#   Débito  → Cuentas por Cobrar (CxC)
#   Crédito → Ingresos por Ventas
# ---------------------------------------------------------------------------
def post_venta(conn: Connection, *, venta_id: int, company_id: int, total: float, subtotal: float, iva: float) -> None:
    if _already_posted(conn, venta_id, "VENTA"):
        return
    cxc = _resolve_account(
        conn,
        company_id,
        fallback_code="1300",
        keywords=("cliente", "por cobrar", "cxc"),
    )
    ingresos = _resolve_account(
        conn,
        company_id,
        fallback_code="4000",
        keywords=("venta", "ingreso", "ingresos"),
    )
    iva_ac = (
        _resolve_account(
            conn,
            company_id,
            fallback_code="2100",
            keywords=("iva trasladado", "iva", "impuesto"),
        )
        if float(iva or 0) > 0
        else None
    )
    if not cxc or not ingresos or (float(iva or 0) > 0 and not iva_ac):
        return

    _post(conn, company_id=company_id, account_code=cxc,
          debit=total, credit=0, reference_id=venta_id,
          description=f"[VENTA] Venta #{venta_id} - CxC")
    if subtotal > 0:
        _post(conn, company_id=company_id, account_code=ingresos,
              debit=0, credit=subtotal, reference_id=venta_id,
              description=f"[VENTA] Venta #{venta_id} - Ingresos")
    if iva > 0:
        _post(conn, company_id=company_id, account_code=iva_ac,
              debit=0, credit=iva, reference_id=venta_id,
              description=f"[VENTA] Venta #{venta_id} - IVA trasladado")


# ---------------------------------------------------------------------------
# Asiento: Recepción de mercancía (compra)
#   Débito  → Inventario / Almacén
#   Crédito → Cuentas por Pagar (CxP) a proveedores
# ---------------------------------------------------------------------------
def post_recepcion_compra(
    conn: Connection,
    *,
    recepcion_id: int,
    company_id: int,
    total: float,
) -> None:
    if _already_posted(conn, recepcion_id, "RECEPCION"):
        return
    inventario = _resolve_account(
        conn,
        company_id,
        fallback_code="1400",
        keywords=("inventario", "almacen", "mercancia"),
    )
    cxp = _resolve_account(
        conn,
        company_id,
        fallback_code="2200",
        keywords=("proveedor", "por pagar", "cxp"),
    )
    if not inventario or not cxp:
        return

    _post(conn, company_id=company_id, account_code=inventario,
          debit=total, credit=0, reference_id=recepcion_id,
          description=f"[RECEPCION] Recepción #{recepcion_id} - Inventario")
    _post(conn, company_id=company_id, account_code=cxp,
          debit=0, credit=total, reference_id=recepcion_id,
          description=f"[RECEPCION] Recepción #{recepcion_id} - CxP proveedor")


# ---------------------------------------------------------------------------
# Asiento: Nómina cerrada
#   Débito  → Sueldos y Salarios
#   Crédito → Bancos / Nómina por pagar
# ---------------------------------------------------------------------------
def post_nomina(
    conn: Connection,
    *,
    nomina_id: int,
    company_id: int,
    total_percepciones: float,
    total_deducciones: float,
    total_neto: float,
) -> None:
    if _already_posted(conn, nomina_id, "NOMINA"):
        return
    sueldos = _resolve_account(
        conn,
        company_id,
        fallback_code="6000",
        keywords=("sueldo", "salario", "nomina", "remuneracion"),
    )
    bancos = _resolve_account(
        conn,
        company_id,
        fallback_code="1100",
        keywords=("banco", "bancos", "caja"),
    )
    isr_ret = (
        _resolve_account(
            conn,
            company_id,
            fallback_code="2150",
            keywords=("isr retenido", "retencion isr", "isr"),
        )
        if float(total_deducciones or 0) > 0
        else None
    )
    if not sueldos or not bancos or (float(total_deducciones or 0) > 0 and not isr_ret):
        return

    _post(conn, company_id=company_id, account_code=sueldos,
          debit=total_percepciones, credit=0, reference_id=nomina_id,
          description=f"[NOMINA] Nómina #{nomina_id} - Sueldos y salarios")
    if total_deducciones > 0:
        _post(conn, company_id=company_id, account_code=isr_ret,
              debit=0, credit=total_deducciones, reference_id=nomina_id,
              description=f"[NOMINA] Nómina #{nomina_id} - Deducciones / ISR retenido")
    _post(conn, company_id=company_id, account_code=bancos,
          debit=0, credit=total_neto, reference_id=nomina_id,
          description=f"[NOMINA] Nómina #{nomina_id} - Pago neto bancos")


def post_factura_cliente(
    conn: Connection,
    *,
    factura_id: int,
    company_id: int,
    subtotal: float,
    iva: float,
    total: float,
    sale_id: int | None = None,
    facturama_id: str | None = None,
    receiver_rfc: str | None = None,
) -> None:
    if _already_posted(conn, factura_id, "FACTURA"):
        return
    if sale_id and _already_posted(conn, sale_id, "VENTA"):
        return

    cxc = _resolve_account(
        conn,
        company_id,
        fallback_code="1300",
        keywords=("cliente", "por cobrar", "cxc"),
    )
    ingresos = _resolve_account(
        conn,
        company_id,
        fallback_code="4000",
        keywords=("venta", "ingreso", "ingresos"),
    )
    iva_ac = (
        _resolve_account(
            conn,
            company_id,
            fallback_code="2100",
            keywords=("iva trasladado", "iva", "impuesto"),
        )
        if float(iva or 0) > 0
        else None
    )
    if not cxc or not ingresos or (float(iva or 0) > 0 and not iva_ac):
        return

    invoice_label = facturama_id or str(factura_id)
    customer_suffix = f" - Receptor {receiver_rfc}" if receiver_rfc else ""

    _post(
        conn,
        company_id=company_id,
        account_code=cxc,
        debit=total,
        credit=0,
        reference_id=factura_id,
        description=f"[FACTURA] Factura {invoice_label}{customer_suffix} - CxC",
    )
    if subtotal > 0:
        _post(
            conn,
            company_id=company_id,
            account_code=ingresos,
            debit=0,
            credit=subtotal,
            reference_id=factura_id,
            description=f"[FACTURA] Factura {invoice_label} - Ventas",
        )
    if iva > 0 and iva_ac:
        _post(
            conn,
            company_id=company_id,
            account_code=iva_ac,
            debit=0,
            credit=iva,
            reference_id=factura_id,
            description=f"[FACTURA] Factura {invoice_label} - IVA trasladado",
        )


def post_cobro_cliente(
    conn: Connection,
    *,
    complemento_id: int,
    company_id: int,
    monto: float,
    num_operacion: str | None = None,
) -> None:
    if _already_posted(conn, complemento_id, "COBRO"):
        return

    bancos = _resolve_account(
        conn,
        company_id,
        fallback_code="1100",
        keywords=("banco", "bancos", "caja"),
    )
    cxc = _resolve_account(
        conn,
        company_id,
        fallback_code="1300",
        keywords=("cliente", "por cobrar", "cxc"),
    )
    if not bancos or not cxc:
        return

    operation_suffix = f" ({num_operacion})" if num_operacion else ""
    _post(
        conn,
        company_id=company_id,
        account_code=bancos,
        debit=monto,
        credit=0,
        reference_id=complemento_id,
        description=f"[COBRO] Complemento pago #{complemento_id}{operation_suffix} - Bancos",
    )
    _post(
        conn,
        company_id=company_id,
        account_code=cxc,
        debit=0,
        credit=monto,
        reference_id=complemento_id,
        description=f"[COBRO] Complemento pago #{complemento_id}{operation_suffix} - CxC",
    )
