from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import text

from app.db.session import get_connection, get_transaction


AVAILABLE_MODULES = [
    {"key": "dashboard", "name": "Dashboard"},
    {"key": "users", "name": "Usuarios"},
    {"key": "clients", "name": "Clientes"},
    {"key": "reports", "name": "Reportes"},
]


def ensure_role_modules_table() -> None:
    with get_transaction() as connection:
        connection.execute(
            text(
                """
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_ROLE_MODULES' AND xtype='U')
                CREATE TABLE ERP_ROLE_MODULES (
                    RoleModule_Id INT IDENTITY(1,1) PRIMARY KEY,
                    Role_Id INT NOT NULL,
                    ModuleKey VARCHAR(100) NOT NULL,
                    IsEnabled BIT DEFAULT 0,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UK_Role_Module UNIQUE (Role_Id, ModuleKey)
                )
                """
            )
        )


def list_roles() -> list[dict[str, Any]]:
    with get_connection() as connection:
        result = connection.execute(
            text("SELECT Rol_Id, Name FROM ERP_ROL ORDER BY Name")
        )
        return [dict(row) for row in result.mappings().all()]


def get_role_modules(role_id: int) -> dict[str, Any]:
    if role_id <= 0:
        raise HTTPException(status_code=400, detail="Rol invalido")

    ensure_role_modules_table()
    with get_connection() as connection:
        result = connection.execute(
            text(
                """
                SELECT ModuleKey, IsEnabled
                FROM ERP_ROLE_MODULES
                WHERE Role_Id = :role_id
                """
            ),
            {"role_id": role_id},
        )
        db_modules = {row["ModuleKey"]: bool(row["IsEnabled"]) for row in result.mappings().all()}

    merged = [
        {
            "key": module["key"],
            "name": module["name"],
            "isEnabled": db_modules.get(module["key"], False),
        }
        for module in AVAILABLE_MODULES
    ]

    for extra_key, enabled in db_modules.items():
        if not any(module["key"] == extra_key for module in AVAILABLE_MODULES):
            merged.append({"key": extra_key, "name": extra_key, "isEnabled": enabled})

    return {"modules": merged}


def update_role_module(role_id: int, module_key: str, is_enabled: bool) -> dict[str, Any]:
    if role_id <= 0 or not module_key:
        raise HTTPException(status_code=400, detail="Parametros invalidos")

    ensure_role_modules_table()
    with get_transaction() as connection:
        exists = connection.execute(
            text(
                """
                SELECT 1
                FROM ERP_ROLE_MODULES
                WHERE Role_Id = :role_id AND ModuleKey = :module_key
                """
            ),
            {"role_id": role_id, "module_key": module_key},
        ).first()

        if exists:
            connection.execute(
                text(
                    """
                    UPDATE ERP_ROLE_MODULES
                    SET IsEnabled = :is_enabled
                    WHERE Role_Id = :role_id AND ModuleKey = :module_key
                    """
                ),
                {
                    "role_id": role_id,
                    "module_key": module_key,
                    "is_enabled": 1 if is_enabled else 0,
                },
            )
        else:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_ROLE_MODULES (Role_Id, ModuleKey, IsEnabled)
                    VALUES (:role_id, :module_key, :is_enabled)
                    """
                ),
                {
                    "role_id": role_id,
                    "module_key": module_key,
                    "is_enabled": 1 if is_enabled else 0,
                },
            )

    return {
        "msg": "Modulo actualizado",
        "moduleKey": module_key,
        "isEnabled": is_enabled,
    }
