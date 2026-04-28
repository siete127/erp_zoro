from typing import Optional
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.services import accounting_service as svc
from app.schemas.accounting import AccountCreate

router = APIRouter()


@router.get("/accounts")
def list_accounts(current_user: dict = Depends(get_current_user)):
    companies = current_user.get("companies", [])
    return {"ok": True, "data": svc.get_accounts(companies)}


@router.post("/accounts")
def create_account(body: AccountCreate, current_user: dict = Depends(get_current_user)):
    result = svc.create_account(body.model_dump())
    return {"ok": True, "data": result}


@router.put("/accounts/{account_code}")
def update_account(account_code: str, body: AccountCreate, current_user: dict = Depends(get_current_user)):
    result = svc.update_account(account_code, body.model_dump())
    return {"ok": True, "data": result}


@router.get("/balances")
def get_balances(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    accountId: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    companies = current_user.get("companies", [])
    return {"ok": True, "data": svc.get_balances(companies, from_date, to_date, accountId)}


@router.get("/income-statement")
def get_income_statement(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    companies = current_user.get("companies", [])
    return {"ok": True, "data": svc.get_income_statement(companies, from_date, to_date)}


@router.get("/supplier-invoices")
@router.get("/supplier-invoice-relations")
def get_supplier_invoice_relations(
    supplierId: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    companies = current_user.get("companies", [])
    return {"ok": True, "data": svc.get_supplier_invoice_relations(companies, supplierId, from_date, to_date)}


@router.get("/reports/operational")
@router.get("/operational-reports")
def get_operational_reports(current_user: dict = Depends(get_current_user)):
    companies = current_user.get("companies", [])
    return {"ok": True, "data": svc.get_operational_reports(companies)}
