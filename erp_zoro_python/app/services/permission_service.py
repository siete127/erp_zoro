from __future__ import annotations

from typing import Any

from sqlalchemy import text

from app.db.session import get_connection, get_transaction


MODULE_CATALOG: list[tuple[str, str, str]] = [
    ("dashboard", "Inicio", "Dashboard principal con indicadores y resumen operativo"),
    ("users", "Usuarios", "Gestion de usuarios, roles y accesos"),
    ("rh", "Recursos Humanos", "Gestion de expediente de personal, contactos y cuentas"),
    ("clients", "Clientes", "Catalogo y administracion de clientes"),
    ("crm", "CRM", "Oportunidades, leads y seguimiento comercial"),
    ("sales", "Ventas", "Ventas, cotizaciones y seguimiento comercial"),
    ("quotes", "Cotizaciones", "Creacion y administracion de cotizaciones"),
    ("purchases", "Compras", "Ordenes de compra, requisiciones y aprobaciones"),
    ("products", "Productos", "Catalogo de productos, precios y configuracion"),
    ("inventory", "Inventario", "Inventario, almacenes, kardex y recepciones"),
    ("production", "Produccion", "Ordenes de produccion y mantenimiento operativo"),
    ("bom", "Recetas de Produccion", "Recetas de produccion y materias primas"),
    ("reporteria", "Reporteria", "Reportes, notas de credito y complementos de pago"),
    ("accounting", "Contabilidad", "Modulo de contabilidad: catalogos, balanzas y reportes financieros"),
    ("fixed_assets", "Activos Fijos", "Control de activos fijos y depreciacion mensual"),
    ("companies", "Configuracion", "Configuracion del sistema, empresas, licencias y auditoria"),
    ("projects", "Proyectos", "Gestion de proyectos, tareas vinculadas y captura de horas"),
    ("helpdesk", "Helpdesk", "Mesa de ayuda y tickets de soporte"),
    ("expenses", "Gastos", "Gestion de gastos de empleados"),
    ("website", "Website", "Configuracion de pagina web publica"),
    ("marketing", "Marketing", "Campanas de correo masivo y listas de contactos"),
    ("fleet", "Flotilla", "Gestion de vehiculos y mantenimiento"),
    ("surveys", "Encuestas", "Formularios y encuestas de satisfaccion"),
    ("subscriptions", "Suscripciones", "Planes y facturacion recurrente"),
]


def ensure_modules_exist() -> None:
    with get_transaction() as connection:
        for module_key, module_name, description in MODULE_CATALOG:
            connection.execute(
                text(
                    """
                    IF NOT EXISTS (
                        SELECT 1
                        FROM ERP_MODULES
                        WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = :module_key
                    )
                    BEGIN
                        INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description, IsActive)
                        VALUES (:module_key, :module_name, :description, 1)
                    END
                    ELSE
                    BEGIN
                        UPDATE ERP_MODULES
                        SET
                            ModuleKey = LOWER(LTRIM(RTRIM(ModuleKey))),
                            ModuleName = CASE
                                WHEN ModuleName IS NULL OR LTRIM(RTRIM(ModuleName)) = '' THEN :module_name
                                ELSE ModuleName
                            END,
                            Description = COALESCE(Description, :description),
                            IsActive = 1
                        WHERE LOWER(LTRIM(RTRIM(ModuleKey))) = :module_key
                    END
                    """
                ),
                {
                    "module_key": module_key,
                    "module_name": module_name,
                    "description": description,
                },
            )


def get_modules() -> dict[str, Any]:
    ensure_modules_exist()
    with get_connection() as connection:
        result = connection.execute(
            text("SELECT * FROM ERP_MODULES WHERE IsActive = 1 ORDER BY ModuleName")
        )
        return {"success": True, "data": [dict(row) for row in result.mappings().all()]}


def get_user_permissions(user_id: int) -> dict[str, Any]:
    ensure_modules_exist()
    with get_connection() as connection:
        result = connection.execute(
            text(
                """
                WITH UserPermissionState AS (
                    SELECT CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM ERP_USER_PERMISSIONS
                            WHERE User_Id = :user_id
                        ) THEN 1
                        ELSE 0
                    END AS HasCustomPermissions
                )
                SELECT
                    m.Module_Id,
                    LOWER(LTRIM(RTRIM(m.ModuleKey))) AS ModuleKey,
                    m.ModuleName,
                    m.Description,
                    CASE
                        WHEN ups.HasCustomPermissions = 1 THEN COALESCE(up.CanAccess, 0)
                        ELSE COALESCE(up.CanAccess, 1)
                    END AS CanAccess,
                    CASE WHEN up.Permission_Id IS NOT NULL THEN 1 ELSE 0 END AS IsCustom
                FROM ERP_MODULES m
                CROSS JOIN UserPermissionState ups
                LEFT JOIN ERP_USER_PERMISSIONS up
                    ON LOWER(LTRIM(RTRIM(up.ModuleKey))) = LOWER(LTRIM(RTRIM(m.ModuleKey)))
                    AND up.User_Id = :user_id
                WHERE m.IsActive = 1
                ORDER BY m.ModuleName
                """
            ),
            {"user_id": user_id},
        )
        return {"success": True, "data": [dict(row) for row in result.mappings().all()]}


def update_user_permissions(
    user_id: int,
    permissions: list[dict[str, Any]],
    current_user_id: int,
) -> dict[str, Any]:
    ensure_modules_exist()
    with get_transaction() as connection:
        for permission in permissions:
            module_key = str(permission.get("ModuleKey") or "").strip().lower()
            if not module_key:
                continue

            exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM ERP_USER_PERMISSIONS
                    WHERE User_Id = :user_id
                    AND LOWER(LTRIM(RTRIM(ModuleKey))) = :module_key
                    """
                ),
                {"user_id": user_id, "module_key": module_key},
            ).first()

            if exists:
                connection.execute(
                    text(
                        """
                        UPDATE ERP_USER_PERMISSIONS
                        SET CanAccess = :can_access, UpdatedAt = GETDATE()
                        WHERE User_Id = :user_id
                        AND LOWER(LTRIM(RTRIM(ModuleKey))) = :module_key
                        """
                    ),
                    {
                        "user_id": user_id,
                        "module_key": module_key,
                        "can_access": 1 if permission.get("CanAccess") else 0,
                    },
                )
            else:
                connection.execute(
                    text(
                        """
                        INSERT INTO ERP_USER_PERMISSIONS (User_Id, ModuleKey, CanAccess, CreatedBy)
                        VALUES (:user_id, :module_key, :can_access, :created_by)
                        """
                    ),
                    {
                        "user_id": user_id,
                        "module_key": module_key,
                        "can_access": 1 if permission.get("CanAccess") else 0,
                        "created_by": current_user_id,
                    },
                )

    return {"success": True, "message": "Permisos actualizados correctamente"}


def check_permission(user_id: int, module_key: str) -> dict[str, Any]:
    normalized_module_key = str(module_key or "").strip().lower()
    with get_connection() as connection:
        result = connection.execute(
            text(
                """
                WITH UserPermissionState AS (
                    SELECT CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM ERP_USER_PERMISSIONS
                            WHERE User_Id = :user_id
                        ) THEN 1
                        ELSE 0
                    END AS HasCustomPermissions
                )
                SELECT CASE
                    WHEN ups.HasCustomPermissions = 1 THEN COALESCE(up.CanAccess, 0)
                    ELSE COALESCE(up.CanAccess, 1)
                END AS HasAccess
                FROM ERP_USERS u
                CROSS JOIN UserPermissionState ups
                LEFT JOIN ERP_USER_PERMISSIONS up
                    ON LOWER(LTRIM(RTRIM(up.ModuleKey))) = :module_key
                    AND up.User_Id = :user_id
                WHERE u.User_Id = :user_id
                """
            ),
            {"user_id": user_id, "module_key": normalized_module_key},
        ).mappings().first()

    has_access = bool(result["HasAccess"]) if result else False
    return {"success": True, "hasAccess": has_access}
