from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import text

from app.db.session import get_connection, get_transaction


def _build_company_in(companies: list) -> tuple[str, dict]:
    if not companies:
        return "", {}
    placeholders = ", ".join(f":c{i}" for i in range(len(companies)))
    params = {f"c{i}": v for i, v in enumerate(companies)}
    return f"({placeholders})", params


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = :t"),
        {"t": table_name},
    ).fetchone()
    return bool(row and row[0] > 0)


def get_accounts(companies: list) -> list[dict[str, Any]]:
    in_clause, params = _build_company_in(companies)
    where = f"WHERE Company_Id IN {in_clause}" if in_clause else ""
    try:
        with get_connection() as conn:
            rows = conn.execute(
                text(f"SELECT * FROM ERP_ACCOUNTS {where} ORDER BY AccountCode"),
                params,
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


def create_account(payload: dict) -> Optional[dict[str, Any]]:
    with get_transaction() as conn:
        row = conn.execute(
            text("""
                INSERT INTO ERP_ACCOUNTS (AccountCode, Name, Type, Company_Id, ParentAccount)
                OUTPUT INSERTED.*
                VALUES (:code, :name, :type, :company, :parent)
            """),
            {
                "code": payload.get("AccountCode"),
                "name": payload.get("Name"),
                "type": payload.get("Type"),
                "company": payload.get("Company_Id"),
                "parent": payload.get("ParentAccount"),
            },
        ).mappings().first()
    return dict(row) if row else None


def update_account(account_code: str, payload: dict) -> Optional[dict[str, Any]]:
    with get_transaction() as conn:
        row = conn.execute(
            text("""
                UPDATE ERP_ACCOUNTS
                SET Name = :name, Type = :type, ParentAccount = :parent
                OUTPUT INSERTED.*
                WHERE AccountCode = :code
            """),
            {
                "code": account_code,
                "name": payload.get("Name"),
                "type": payload.get("Type"),
                "parent": payload.get("ParentAccount"),
            },
        ).mappings().first()
    return dict(row) if row else None


def get_balances(
    companies: list,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    account_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    in_clause, params = _build_company_in(companies)
    conditions: list[str] = []
    if in_clause:
        conditions.append(f"Company_Id IN {in_clause}")
    if account_id:
        conditions.append("AccountCode = :acct")
        params["acct"] = account_id
    if from_date:
        conditions.append("Date >= :fd")
        params["fd"] = from_date
    if to_date:
        conditions.append("Date <= :td")
        params["td"] = to_date

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    try:
        with get_connection() as conn:
            rows = conn.execute(
                text(f"""
                    SELECT AccountCode,
                           SUM(ISNULL(Debit, 0)) AS Debit,
                           SUM(ISNULL(Credit, 0)) AS Credit
                    FROM ERP_LEDGER {where}
                    GROUP BY AccountCode
                """),
                params,
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


def get_income_statement(
    companies: list,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> list[dict[str, Any]]:
    in_clause, params = _build_company_in(companies)
    conditions = ["1=1"]
    if in_clause:
        conditions.append(f"l.Company_Id IN {in_clause}")
    if from_date:
        conditions.append("l.Date >= :fd")
        params["fd"] = from_date
    if to_date:
        conditions.append("l.Date <= :td")
        params["td"] = to_date

    where = " AND ".join(conditions)
    try:
        with get_connection() as conn:
            rows = conn.execute(
                text(f"""
                    SELECT a.Type AS AccountType,
                           SUM(ISNULL(l.Debit, 0)) AS TotalDebit,
                           SUM(ISNULL(l.Credit, 0)) AS TotalCredit
                    FROM ERP_LEDGER l
                    LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
                    WHERE {where}
                    GROUP BY a.Type
                """),
                params,
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


def get_supplier_invoice_relations(
    companies: list,
    supplier_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> list[dict[str, Any]]:
    in_clause, params = _build_company_in(companies)
    conditions: list[str] = []
    if in_clause:
        conditions.append(f"c.Company_Id IN {in_clause}")
    if supplier_id:
        conditions.append("c.Supplier_Id = :sup")
        params["sup"] = supplier_id
    if from_date:
        conditions.append("c.Date >= :fd")
        params["fd"] = from_date
    if to_date:
        conditions.append("c.Date <= :td")
        params["td"] = to_date

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    try:
        with get_connection() as conn:
            rows = conn.execute(
                text(f"""
                    SELECT c.OC_Id AS Compra_Id, c.NumeroOC AS Folio, c.FechaOC AS Date,
                           c.Proveedor_Id AS Supplier_Id, c.Total,
                           l.AccountCode, l.Debit, l.Credit
                    FROM ERP_COMPRA_ORDEN c
                    LEFT JOIN ERP_LEDGER l ON l.Reference_Id = c.OC_Id
                    {where}
                    ORDER BY c.Date DESC
                """),
                params,
            ).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []


def get_operational_reports(companies: list) -> list[dict[str, Any]]:
    in_clause, cparams = _build_company_in(companies)
    results: list[dict[str, Any]] = []

    try:
        with get_connection() as conn:
            for metric, table in [
                ("Receivables", "ERP_ACCOUNTS_RECEIVABLE"),
                ("Payables", "ERP_ACCOUNTS_PAYABLE"),
                ("Cash", "ERP_CASH_BALANCES"),
            ]:
                try:
                    if _table_exists(conn, table):
                        where = f"WHERE Company_Id IN {in_clause}" if in_clause else ""
                        row = conn.execute(
                            text(f"SELECT SUM(ISNULL(Balance, 0)) FROM {table} {where}"),
                            cparams,
                        ).fetchone()
                        value = float(row[0] or 0) if row else 0.0
                    else:
                        # Fallback: derivar desde ERP_LEDGER por tipo de cuenta
                        keyword_map = {
                            "Receivables": ("%receiv%", "%cxc%", "%por cobrar%", "%cliente%"),
                            "Payables": ("%pay%", "%cxp%", "%por pagar%", "%proveed%"),
                            "Cash": ("%caja%", "%banco%", "%cash%"),
                        }
                        kws = keyword_map[metric]
                        kw_conds = " OR ".join(f"LOWER(ISNULL(a.Name,'')) LIKE :kw{i}" for i in range(len(kws)))
                        kw_p: dict = {f"kw{i}": kw for i, kw in enumerate(kws)}
                        if in_clause:
                            kw_p.update(cparams)
                            extra = f"AND l.Company_Id IN {in_clause}"
                        else:
                            extra = ""
                        sign = "Debit" if metric in ("Receivables", "Cash") else "Credit"
                        opp = "Credit" if sign == "Debit" else "Debit"
                        row = conn.execute(
                            text(f"""
                                SELECT SUM(ISNULL(l.{sign},0) - ISNULL(l.{opp},0))
                                FROM ERP_LEDGER l
                                LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
                                WHERE ({kw_conds}) {extra}
                            """),
                            kw_p,
                        ).fetchone()
                        value = float(row[0] or 0) if row else 0.0
                    results.append({"Metric": metric, "Value": value})
                except Exception:
                    results.append({"Metric": metric, "Value": 0.0})
    except Exception:
        pass

    return results
