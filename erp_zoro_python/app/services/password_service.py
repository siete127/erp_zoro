from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import text

from app.db.session import get_connection, get_transaction
from app.services.email_service import send_password_changed_email, send_password_reset_email

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_TABLE_DDL = """
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PASSWORD_RESET_TOKENS' AND xtype='U')
    CREATE TABLE PASSWORD_RESET_TOKENS (
        Token_Id  INT IDENTITY(1,1) PRIMARY KEY,
        User_Id   INT NOT NULL,
        Token     VARCHAR(255) NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        Used      BIT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id)
    )
"""


def request_password_reset(email: str) -> dict:
    generic_msg = "Si el email está registrado, recibirás un correo con instrucciones para recuperar tu contraseña"

    with get_connection() as conn:
        row = conn.execute(
            text("SELECT User_Id, Email, Username FROM ERP_USERS WHERE Email = :e AND IsActive = 1"),
            {"e": email},
        ).fetchone()

    if not row:
        return {"msg": generic_msg}

    user_id, user_email, username = row[0], row[1], row[2]
    reset_token = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    with get_transaction() as conn:
        conn.execute(text(_TABLE_DDL))
        conn.execute(
            text("INSERT INTO PASSWORD_RESET_TOKENS (User_Id, Token, ExpiresAt) VALUES (:uid, :tok, :exp)"),
            {"uid": user_id, "tok": reset_token, "exp": expires_at},
        )

    try:
        send_password_reset_email(user_email, username, reset_token)
    except Exception:
        pass

    return {"msg": generic_msg}


def verify_reset_token(token: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT prt.Token_Id, u.User_Id, u.Email, u.Username
                FROM PASSWORD_RESET_TOKENS prt
                INNER JOIN ERP_USERS u ON prt.User_Id = u.User_Id
                WHERE prt.Token = :tok AND prt.Used = 0 AND prt.ExpiresAt > GETDATE()
            """),
            {"tok": token},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")
    return {"valid": True, "username": row[3]}


def reset_password(token: str, new_password: str) -> dict:
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    with get_connection() as conn:
        row = conn.execute(
            text("""
                SELECT prt.Token_Id, u.User_Id, u.Email, u.Username
                FROM PASSWORD_RESET_TOKENS prt
                INNER JOIN ERP_USERS u ON prt.User_Id = u.User_Id
                WHERE prt.Token = :tok AND prt.Used = 0 AND prt.ExpiresAt > GETDATE()
            """),
            {"tok": token},
        ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Token inválido o usuario no encontrado")

    _, user_id, user_email, username = row[0], row[1], row[2], row[3]
    hashed = pwd_context.hash(new_password)

    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_USERS SET Password = :pwd WHERE User_Id = :uid"),
            {"pwd": hashed, "uid": user_id},
        )
        conn.execute(
            text("UPDATE PASSWORD_RESET_TOKENS SET Used = 1 WHERE Token = :tok"),
            {"tok": token},
        )

    try:
        send_password_changed_email(user_email, username)
    except Exception:
        pass

    return {"msg": "Contraseña actualizada exitosamente"}
