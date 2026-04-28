from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.core.config import BASE_DIR
from app.db.session import get_connection, get_transaction
from app.utils.company_access import user_company_ids


ENV_FILE = BASE_DIR / ".env"


def _write_env_value(key: str, value: str) -> None:
    if ENV_FILE.exists():
        content = ENV_FILE.read_text(encoding="utf-8")
    else:
        content = ""

    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    line = f"{key}={value}"
    if pattern.search(content):
        content = pattern.sub(line, content)
    else:
        if content and not content.endswith("\n"):
            content += "\n"
        content += line + "\n"

    ENV_FILE.write_text(content, encoding="utf-8")
    os.environ[key] = value


def get_email_aprobacion() -> dict[str, str]:
    return {"email": os.getenv("EMAIL_APROBACION_PRECIOS", "")}


def update_email_aprobacion(email: str) -> dict[str, str]:
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email invalido")
    _write_env_value("EMAIL_APROBACION_PRECIOS", email)
    return {"msg": "Email de aprobacion actualizado", "email": email}


def get_price_approval_emails(
    current_user: dict[str, Any],
    company_id: int | None,
    client_id: int | None,
) -> dict[str, str]:
    resolved_company_id = company_id

    with get_connection() as connection:
        if client_id and not resolved_company_id:
            client_row = connection.execute(
                text(
                    """
                    SELECT TOP 1 Company_Id
                    FROM ERP_CLIENTCOMPANIES
                    WHERE Client_Id = :client_id
                    """
                ),
                {"client_id": client_id},
            ).mappings().first()
            if client_row:
                resolved_company_id = int(client_row["Company_Id"])

        if not current_user.get("is_admin"):
            companies = user_company_ids(current_user)
            if not companies:
                return {"email1": "", "email2": ""}
            resolved_company_id = companies[0]

        if not resolved_company_id:
            raise HTTPException(status_code=400, detail="company_id o client_id requerido")

        row = connection.execute(
            text(
                """
                SELECT EmailAprobacion1, EmailAprobacion2
                FROM ERP_COMPANY
                WHERE Company_Id = :company_id
                """
            ),
            {"company_id": resolved_company_id},
        ).mappings().first()

    return {
        "email1": str(row["EmailAprobacion1"] or "") if row else "",
        "email2": str(row["EmailAprobacion2"] or "") if row else "",
    }


def update_price_approval_emails(
    current_user: dict[str, Any],
    company_id: int | None,
    email1: str | None,
    email2: str | None,
) -> dict[str, str]:
    resolved_company_id = company_id
    if not current_user.get("is_admin"):
        companies = user_company_ids(current_user)
        if not companies:
            raise HTTPException(status_code=403, detail="No autorizado")
        resolved_company_id = companies[0]

    if not resolved_company_id:
        raise HTTPException(status_code=400, detail="company_id requerido")

    if (email1 and "@" not in email1) or (email2 and "@" not in email2):
        raise HTTPException(status_code=400, detail="Email invalido")

    with get_transaction() as connection:
        connection.execute(
            text(
                """
                UPDATE ERP_COMPANY
                SET
                    EmailAprobacion1 = :email1,
                    EmailAprobacion2 = :email2
                WHERE Company_Id = :company_id
                """
            ),
            {
                "company_id": resolved_company_id,
                "email1": email1,
                "email2": email2,
            },
        )

    return {
        "msg": "Correos de aprobacion actualizados",
        "email1": email1 or "",
        "email2": email2 or "",
    }
