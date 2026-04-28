from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.session import get_connection, get_transaction
from app.utils.company_access import build_in_clause, normalize_company_ids, user_company_ids


DEFAULT_CLIENT_TYPE = "CLIENTE"


def _normalize_client_type_value(raw_value: str | None) -> str:
    if not raw_value and raw_value != 0:
        return DEFAULT_CLIENT_TYPE

    value = str(raw_value).strip().upper()
    if not value:
        return DEFAULT_CLIENT_TYPE

    mapping = {
        "CLIENTE": "CLIENTE",
        "CLIENT": "CLIENTE",
        "CUSTOMER": "CLIENTE",
        "PROVEEDOR": "PROVEEDOR",
        "SUPPLIER": "PROVEEDOR",
        "VENDOR": "PROVEEDOR",
        "AMBOS": "AMBOS",
        "BOTH": "AMBOS",
        "CLIENTE_PROVEEDOR": "AMBOS",
        "PROVEEDOR_CLIENTE": "AMBOS",
    }
    return mapping.get(value, value)


def _extract_check_values(definition: str | None) -> list[str]:
    if not definition:
        return []
    return [match.strip("'") for match in re.findall(r"'([^']+)'", definition)]


def get_allowed_client_type_values() -> list[str]:
    try:
        with get_connection() as connection:
            result = connection.execute(
                text(
                    """
                    SELECT cc.definition
                    FROM sys.check_constraints cc
                    WHERE cc.parent_object_id = OBJECT_ID('ERP_CLIENT')
                      AND cc.definition LIKE '%ClientType%'
                    """
                )
            ).mappings().first()
        values = [value.upper() for value in _extract_check_values(result["definition"] if result else None)]
        if values:
            return values
    except Exception:
        pass
    return ["CLIENTE", "PROVEEDOR", "AMBOS"]


def get_allowed_status_values() -> list[str]:
    try:
        with get_connection() as connection:
            result = connection.execute(
                text(
                    """
                    SELECT cc.definition
                    FROM sys.check_constraints cc
                    WHERE cc.parent_object_id = OBJECT_ID('ERP_CLIENT')
                      AND cc.definition LIKE '%Status%'
                    """
                )
            ).mappings().first()
        values = _extract_check_values(result["definition"] if result else None)
        if values:
            return values
    except Exception:
        pass

    try:
        with get_connection() as connection:
            rows = connection.execute(
                text("SELECT DISTINCT Status FROM ERP_CLIENT")
            ).mappings().all()
        values = [str(row["Status"]) for row in rows if row.get("Status")]
        if values:
            return values
    except Exception:
        pass

    return ["ACTIVO", "INACTIVO", "BLOQUEADO"]


def meta() -> dict[str, list[str]]:
    return {"allowed": get_allowed_status_values()}


def _resolve_company_ids(
    current_user: dict[str, Any],
    requested_company_ids: list[int],
) -> list[int]:
    normalized = normalize_company_ids(requested_company_ids)
    if current_user.get("is_admin"):
        return normalized

    allowed = set(user_company_ids(current_user))
    if not allowed:
        raise HTTPException(status_code=403, detail="No tiene empresas asignadas")

    if not normalized:
        return list(allowed)

    if not set(normalized).issubset(allowed):
        raise HTTPException(
            status_code=403,
            detail="Solo puede usar empresas a las que pertenece",
        )
    return normalized


def _client_companies(connection: Connection, client_id: int) -> list[int]:
    rows = connection.execute(
        text("SELECT Company_Id FROM ERP_CLIENTCOMPANIES WHERE Client_Id = :client_id"),
        {"client_id": client_id},
    ).mappings().all()
    return [int(row["Company_Id"]) for row in rows]


def _ensure_client_access(
    connection: Connection,
    client_id: int,
    current_user: dict[str, Any],
) -> None:
    if current_user.get("is_admin"):
        return
    allowed = set(user_company_ids(current_user))
    if not allowed:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    client_companies = set(_client_companies(connection, client_id))
    if client_companies and not client_companies.intersection(allowed):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")


def list_clients(current_user: dict[str, Any], company_id: str | None) -> dict[str, Any]:
    with get_connection() as connection:
        if not current_user.get("is_admin"):
            companies = user_company_ids(current_user)
            if not companies:
                return {"success": True, "data": []}
            clause, params = build_in_clause("company", companies)
            result = connection.execute(
                text(
                    f"""
                    SELECT DISTINCT
                        c.Client_Id,
                        c.LegalName,
                        c.CommercialName,
                        c.RFC,
                        c.TaxRegime,
                        c.ClientType,
                        c.Status,
                        c.CreatedAt,
                        c.UpdatedAt
                    FROM ERP_CLIENT c
                    INNER JOIN ERP_CLIENTCOMPANIES cc ON c.Client_Id = cc.Client_Id
                    WHERE cc.Company_Id IN ({clause})
                    ORDER BY c.LegalName
                    """
                ),
                params,
            )
            return {"success": True, "data": [dict(row) for row in result.mappings().all()]}

        if company_id and company_id != "all":
            result = connection.execute(
                text(
                    """
                    SELECT DISTINCT
                        c.Client_Id,
                        c.LegalName,
                        c.CommercialName,
                        c.RFC,
                        c.TaxRegime,
                        c.ClientType,
                        c.Status,
                        c.CreatedAt,
                        c.UpdatedAt
                    FROM ERP_CLIENT c
                    INNER JOIN ERP_CLIENTCOMPANIES cc ON c.Client_Id = cc.Client_Id
                    WHERE cc.Company_Id = :company_id
                    ORDER BY c.LegalName
                    """
                ),
                {"company_id": int(company_id)},
            )
            return {"success": True, "data": [dict(row) for row in result.mappings().all()]}

        result = connection.execute(
            text(
                """
                SELECT TOP (1000)
                    Client_Id,
                    LegalName,
                    CommercialName,
                    RFC,
                    TaxRegime,
                    ClientType,
                    Status,
                    CreatedAt,
                    UpdatedAt
                FROM ERP_CLIENT
                ORDER BY LegalName
                """
            )
        )
        return {"success": True, "data": [dict(row) for row in result.mappings().all()]}


def get_client(client_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_client_access(connection, client_id, current_user)

        client = connection.execute(
            text("SELECT * FROM ERP_CLIENT WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().first()
        if not client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        addresses = connection.execute(
            text("SELECT * FROM ERP_CLIENTADRESSES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().all()
        contacts = connection.execute(
            text("SELECT * FROM ERP_CLIENTCONTACTS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().all()
        financial = connection.execute(
            text("SELECT * FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().all()
        companies = connection.execute(
            text(
                """
                SELECT cc.Company_Id, ec.NameCompany
                FROM ERP_CLIENTCOMPANIES cc
                JOIN ERP_COMPANY ec ON cc.Company_Id = ec.Company_Id
                WHERE cc.Client_Id = :client_id
                """
            ),
            {"client_id": client_id},
        ).mappings().all()

        # Datos adicionales si es proveedor
        historial_oc: list[dict] = []
        precios_pactados: list[dict] = []
        client_type = str(client.get("ClientType") or "").upper()
        if client_type in ("PROVEEDOR", "AMBOS"):
            oc_rows = connection.execute(
                text(
                    """
                    SELECT TOP 20
                        oc.OC_Id, oc.NumeroOC, oc.FechaOC, oc.Estatus,
                        oc.Total, oc.Moneda, c.NameCompany
                    FROM ERP_COMPRA_ORDEN oc
                    LEFT JOIN ERP_COMPANY c ON c.Company_Id = oc.Company_Id
                    WHERE oc.Proveedor_Id = :client_id
                    ORDER BY oc.FechaOC DESC
                    """
                ),
                {"client_id": client_id},
            ).mappings().all()
            historial_oc = [dict(r) for r in oc_rows]

            precio_rows = connection.execute(
                text(
                    """
                    SELECT pp.*,
                           p.Description  AS ProductoNombre,
                           mp.Nombre      AS MateriaPrimaNombre
                    FROM ERP_PROVEEDOR_PRECIOS pp
                    LEFT JOIN ERP_PRODUCTOS p      ON p.Producto_Id       = pp.Producto_Id
                    LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id  = pp.MateriaPrima_Id
                    WHERE pp.Proveedor_Id = :client_id AND pp.Activo = 1
                    ORDER BY pp.CreatedAt DESC
                    """
                ),
                {"client_id": client_id},
            ).mappings().all()
            precios_pactados = [dict(r) for r in precio_rows]

    return {
        "client": dict(client),
        "addresses": [dict(row) for row in addresses],
        "contacts": [dict(row) for row in contacts],
        "financial": [dict(row) for row in financial],
        "companies": [dict(row) for row in companies],
        "historial_oc": historial_oc,
        "precios_pactados": precios_pactados,
    }


def create_client(payload: dict[str, Any], current_user: dict[str, Any]) -> dict[str, Any]:
    legal_name = payload.get("LegalName")
    if not legal_name:
        raise HTTPException(status_code=400, detail="LegalName es requerido")

    allowed_client_types = get_allowed_client_type_values()
    normalized_client_type = _normalize_client_type_value(payload.get("ClientType"))
    if normalized_client_type not in allowed_client_types:
        raise HTTPException(
            status_code=400,
            detail={
                "msg": "ClientType invalido",
                "received": payload.get("ClientType"),
                "normalized": normalized_client_type,
                "allowed": allowed_client_types,
            },
        )

    company_ids = _resolve_company_ids(current_user, payload.get("Company_Ids") or [])

    with get_transaction() as connection:
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_CLIENT (
                    LegalName,
                    CommercialName,
                    RFC,
                    TaxRegime,
                    ClientType,
                    Status
                )
                OUTPUT INSERTED.Client_Id
                VALUES (
                    :legal_name,
                    :commercial_name,
                    :rfc,
                    :tax_regime,
                    :client_type,
                    :status
                )
                """
            ),
            {
                "legal_name": legal_name,
                "commercial_name": payload.get("CommercialName"),
                "rfc": payload.get("RFC"),
                "tax_regime": payload.get("TaxRegime"),
                "client_type": normalized_client_type,
                "status": payload.get("Status") or "ACTIVO",
            },
        )
        row = result.first()
        client_id = int(row[0]) if row else None

        for company_id in company_ids:
            connection.execute(
                text(
                    """
                    IF NOT EXISTS (
                        SELECT 1
                        FROM ERP_CLIENTCOMPANIES
                        WHERE Client_Id = :client_id AND Company_Id = :company_id
                    )
                    INSERT INTO ERP_CLIENTCOMPANIES (Client_Id, Company_Id)
                    VALUES (:client_id, :company_id)
                    """
                ),
                {"client_id": client_id, "company_id": company_id},
            )

        for address in payload.get("Addresses") or []:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_CLIENTADRESSES (
                        Client_Id,
                        AddressType,
                        Street,
                        City,
                        State,
                        PostalCode,
                        Country,
                        IsPrimary
                    )
                    VALUES (
                        :client_id,
                        :address_type,
                        :street,
                        :city,
                        :state,
                        :postal_code,
                        :country,
                        :is_primary
                    )
                    """
                ),
                {
                    "client_id": client_id,
                    "address_type": address.get("AddressType"),
                    "street": address.get("Street"),
                    "city": address.get("City"),
                    "state": address.get("State"),
                    "postal_code": address.get("PostalCode"),
                    "country": address.get("Country"),
                    "is_primary": bool(address.get("IsPrimary")),
                },
            )

        for contact in payload.get("Contacts") or []:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_CLIENTCONTACTS (
                        Client_Id,
                        FullName,
                        PhoneNumber,
                        MobileNumber,
                        Email,
                        SecondaryEmail,
                        IsPrimary
                    )
                    VALUES (
                        :client_id,
                        :full_name,
                        :phone_number,
                        :mobile_number,
                        :email,
                        :secondary_email,
                        :is_primary
                    )
                    """
                ),
                {
                    "client_id": client_id,
                    "full_name": contact.get("FullName"),
                    "phone_number": contact.get("PhoneNumber"),
                    "mobile_number": contact.get("MobileNumber"),
                    "email": contact.get("Email"),
                    "secondary_email": contact.get("SecondaryEmail"),
                    "is_primary": bool(contact.get("IsPrimary")),
                },
            )

    return {"msg": "Cliente creado", "Client_Id": client_id}


def update_client(
    client_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    legal_name = payload.get("LegalName")
    if not legal_name:
        raise HTTPException(status_code=400, detail="LegalName es requerido")

    allowed_status = get_allowed_status_values()
    status_value = payload.get("Status") or "ACTIVO"
    if status_value not in allowed_status:
        raise HTTPException(
            status_code=400,
            detail={"msg": "Status invalido", "allowed": allowed_status},
        )

    allowed_client_types = get_allowed_client_type_values()
    normalized_client_type = _normalize_client_type_value(payload.get("ClientType"))
    if normalized_client_type not in allowed_client_types:
        raise HTTPException(
            status_code=400,
            detail={
                "msg": "ClientType invalido",
                "received": payload.get("ClientType"),
                "normalized": normalized_client_type,
                "allowed": allowed_client_types,
            },
        )

    company_ids = _resolve_company_ids(current_user, payload.get("Company_Ids") or [])

    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                UPDATE ERP_CLIENT
                SET
                    LegalName = :legal_name,
                    CommercialName = :commercial_name,
                    RFC = :rfc,
                    TaxRegime = :tax_regime,
                    ClientType = :client_type,
                    Status = :status
                WHERE Client_Id = :client_id
                """
            ),
            {
                "client_id": client_id,
                "legal_name": legal_name,
                "commercial_name": payload.get("CommercialName"),
                "rfc": payload.get("RFC"),
                "tax_regime": payload.get("TaxRegime"),
                "client_type": normalized_client_type,
                "status": status_value,
            },
        )

        connection.execute(
            text("DELETE FROM ERP_CLIENTADRESSES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENTCONTACTS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENTCOMPANIES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )

        for company_id in company_ids:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_CLIENTCOMPANIES (Client_Id, Company_Id)
                    VALUES (:client_id, :company_id)
                    """
                ),
                {"client_id": client_id, "company_id": company_id},
            )

        for address in payload.get("Addresses") or []:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_CLIENTADRESSES (
                        Client_Id,
                        AddressType,
                        Street,
                        City,
                        State,
                        PostalCode,
                        Country,
                        IsPrimary
                    )
                    VALUES (
                        :client_id,
                        :address_type,
                        :street,
                        :city,
                        :state,
                        :postal_code,
                        :country,
                        :is_primary
                    )
                    """
                ),
                {
                    "client_id": client_id,
                    "address_type": address.get("AddressType"),
                    "street": address.get("Street"),
                    "city": address.get("City"),
                    "state": address.get("State"),
                    "postal_code": address.get("PostalCode"),
                    "country": address.get("Country"),
                    "is_primary": bool(address.get("IsPrimary")),
                },
            )

        for contact in payload.get("Contacts") or []:
            connection.execute(
                text(
                    """
                    INSERT INTO ERP_CLIENTCONTACTS (
                        Client_Id,
                        FullName,
                        PhoneNumber,
                        MobileNumber,
                        Email,
                        SecondaryEmail,
                        IsPrimary
                    )
                    VALUES (
                        :client_id,
                        :full_name,
                        :phone_number,
                        :mobile_number,
                        :email,
                        :secondary_email,
                        :is_primary
                    )
                    """
                ),
                {
                    "client_id": client_id,
                    "full_name": contact.get("FullName"),
                    "phone_number": contact.get("PhoneNumber"),
                    "mobile_number": contact.get("MobileNumber"),
                    "email": contact.get("Email"),
                    "secondary_email": contact.get("SecondaryEmail"),
                    "is_primary": bool(contact.get("IsPrimary")),
                },
            )

    return {"msg": "Cliente actualizado"}


def delete_client(client_id: int, current_user: dict[str, Any]) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text("DELETE FROM ERP_CLIENTADRESSES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENTCONTACTS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENTCOMPANIES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENT_RECURRING_PRODUCTS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text("DELETE FROM ERP_CLIENT WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
    return {"msg": "Cliente eliminado"}


def toggle_active(
    client_id: int,
    is_active: bool | None,
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        current = connection.execute(
            text("SELECT Status FROM ERP_CLIENT WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().first()
        if not current:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

        if is_active is None:
            new_status = (
                "INACTIVO"
                if str(current["Status"] or "").upper() == "ACTIVO"
                else "ACTIVO"
            )
        else:
            new_status = "ACTIVO" if is_active else "INACTIVO"

        connection.execute(
            text("UPDATE ERP_CLIENT SET Status = :status WHERE Client_Id = :client_id"),
            {"client_id": client_id, "status": new_status},
        )

    return {"msg": "Estado actualizado", "Status": new_status}


def list_addresses(client_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_client_access(connection, client_id, current_user)
        result = connection.execute(
            text("SELECT * FROM ERP_CLIENTADRESSES WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        return {"addresses": [dict(row) for row in result.mappings().all()]}


def create_address(
    client_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_CLIENTADRESSES (
                    Client_Id,
                    AddressType,
                    Street,
                    City,
                    State,
                    PostalCode,
                    Country,
                    IsPrimary
                )
                OUTPUT INSERTED.Address_Id
                VALUES (
                    :client_id,
                    :address_type,
                    :street,
                    :city,
                    :state,
                    :postal_code,
                    :country,
                    :is_primary
                )
                """
            ),
            {
                "client_id": client_id,
                "address_type": payload.get("AddressType"),
                "street": payload.get("Street"),
                "city": payload.get("City"),
                "state": payload.get("State"),
                "postal_code": payload.get("PostalCode"),
                "country": payload.get("Country"),
                "is_primary": bool(payload.get("IsPrimary")),
            },
        )
        row = result.first()
    return {"msg": "Direccion creada", "Address_Id": int(row[0]) if row else None}


def update_address(
    client_id: int,
    address_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                UPDATE ERP_CLIENTADRESSES
                SET
                    AddressType = :address_type,
                    Street = :street,
                    City = :city,
                    State = :state,
                    PostalCode = :postal_code,
                    Country = :country,
                    IsPrimary = :is_primary
                WHERE Address_Id = :address_id AND Client_Id = :client_id
                """
            ),
            {
                "address_id": address_id,
                "client_id": client_id,
                "address_type": payload.get("AddressType"),
                "street": payload.get("Street"),
                "city": payload.get("City"),
                "state": payload.get("State"),
                "postal_code": payload.get("PostalCode"),
                "country": payload.get("Country"),
                "is_primary": bool(payload.get("IsPrimary")),
            },
        )
    return {"msg": "Direccion actualizada"}


def delete_address(
    client_id: int,
    address_id: int,
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                DELETE FROM ERP_CLIENTADRESSES
                WHERE Address_Id = :address_id AND Client_Id = :client_id
                """
            ),
            {"address_id": address_id, "client_id": client_id},
        )
    return {"msg": "Direccion eliminada"}


def list_contacts(client_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_client_access(connection, client_id, current_user)
        result = connection.execute(
            text("SELECT * FROM ERP_CLIENTCONTACTS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        return {"contacts": [dict(row) for row in result.mappings().all()]}


def create_contact(
    client_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        result = connection.execute(
            text(
                """
                INSERT INTO ERP_CLIENTCONTACTS (
                    Client_Id,
                    FullName,
                    PhoneNumber,
                    MobileNumber,
                    Email,
                    SecondaryEmail,
                    IsPrimary
                )
                OUTPUT INSERTED.Contact_Id
                VALUES (
                    :client_id,
                    :full_name,
                    :phone_number,
                    :mobile_number,
                    :email,
                    :secondary_email,
                    :is_primary
                )
                """
            ),
            {
                "client_id": client_id,
                "full_name": payload.get("FullName"),
                "phone_number": payload.get("PhoneNumber"),
                "mobile_number": payload.get("MobileNumber"),
                "email": payload.get("Email"),
                "secondary_email": payload.get("SecondaryEmail"),
                "is_primary": bool(payload.get("IsPrimary")),
            },
        )
        row = result.first()
    return {"msg": "Contacto creado", "Contact_Id": int(row[0]) if row else None}


def update_contact(
    client_id: int,
    contact_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                UPDATE ERP_CLIENTCONTACTS
                SET
                    FullName = :full_name,
                    PhoneNumber = :phone_number,
                    MobileNumber = :mobile_number,
                    Email = :email,
                    SecondaryEmail = :secondary_email,
                    IsPrimary = :is_primary
                WHERE Contact_Id = :contact_id AND Client_Id = :client_id
                """
            ),
            {
                "contact_id": contact_id,
                "client_id": client_id,
                "full_name": payload.get("FullName"),
                "phone_number": payload.get("PhoneNumber"),
                "mobile_number": payload.get("MobileNumber"),
                "email": payload.get("Email"),
                "secondary_email": payload.get("SecondaryEmail"),
                "is_primary": bool(payload.get("IsPrimary")),
            },
        )
    return {"msg": "Contacto actualizado"}


def delete_contact(
    client_id: int,
    contact_id: int,
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                DELETE FROM ERP_CLIENTCONTACTS
                WHERE Contact_Id = :contact_id AND Client_Id = :client_id
                """
            ),
            {"contact_id": contact_id, "client_id": client_id},
        )
    return {"msg": "Contacto eliminado"}


def get_financial(client_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_client_access(connection, client_id, current_user)
        row = connection.execute(
            text("SELECT * FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        ).mappings().first()
    return {"financial": dict(row) if row else None}


def upsert_financial(
    client_id: int,
    payload: dict[str, Any],
    current_user: dict[str, Any],
) -> dict[str, str]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text("DELETE FROM ERP_CLIENTFINANCIALSETTINGS WHERE Client_Id = :client_id"),
            {"client_id": client_id},
        )
        connection.execute(
            text(
                """
                INSERT INTO ERP_CLIENTFINANCIALSETTINGS (
                    Client_Id,
                    HasCredit,
                    CreditLimit,
                    CreditDays,
                    Currency,
                    PaymentMethod,
                    PaymentForm,
                    CreditStatus
                )
                VALUES (
                    :client_id,
                    :has_credit,
                    :credit_limit,
                    :credit_days,
                    :currency,
                    :payment_method,
                    :payment_form,
                    :credit_status
                )
                """
            ),
            {
                "client_id": client_id,
                "has_credit": bool(payload.get("HasCredit")),
                "credit_limit": payload.get("CreditLimit") or 0,
                "credit_days": payload.get("CreditDays") or 0,
                "currency": payload.get("Currency"),
                "payment_method": payload.get("PaymentMethod"),
                "payment_form": payload.get("PaymentForm"),
                "credit_status": payload.get("CreditStatus"),
            },
        )
    return {"msg": "Configuracion financiera guardada"}


def get_recurring_products(client_id: int, current_user: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        _ensure_client_access(connection, client_id, current_user)
        result = connection.execute(
            text(
                """
                SELECT
                    rp.RecurringProduct_Id,
                    rp.Client_Id,
                    rp.Producto_Id,
                    rp.CreatedAt,
                    p.SKU,
                    p.Nombre,
                    p.Descripcion,
                    p.Precio,
                    p.TipoMoneda,
                    p.ClaveProdServSAT,
                    p.ClaveUnidadSAT,
                    p.ImpuestoIVA
                FROM ERP_CLIENT_RECURRING_PRODUCTS rp
                INNER JOIN ERP_PRODUCTOS p ON rp.Producto_Id = p.Producto_Id
                WHERE rp.Client_Id = :client_id AND p.Activo = 1
                ORDER BY p.Nombre
                """
            ),
            {"client_id": client_id},
        )
        rows = [dict(row) for row in result.mappings().all()]
    return {"success": True, "data": rows}


def add_recurring_product(
    client_id: int,
    producto_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        product = connection.execute(
            text(
                """
                SELECT Producto_Id
                FROM ERP_PRODUCTOS
                WHERE Producto_Id = :producto_id AND Activo = 1
                """
            ),
            {"producto_id": producto_id},
        ).mappings().first()
        if not product:
            raise HTTPException(status_code=404, detail="Producto no encontrado o inactivo")

        exists = connection.execute(
            text(
                """
                SELECT 1
                FROM ERP_CLIENT_RECURRING_PRODUCTS
                WHERE Client_Id = :client_id AND Producto_Id = :producto_id
                """
            ),
            {"client_id": client_id, "producto_id": producto_id},
        ).first()
        if exists:
            raise HTTPException(
                status_code=409,
                detail="El producto ya esta en la lista de recurrentes",
            )

        connection.execute(
            text(
                """
                INSERT INTO ERP_CLIENT_RECURRING_PRODUCTS (Client_Id, Producto_Id)
                VALUES (:client_id, :producto_id)
                """
            ),
            {"client_id": client_id, "producto_id": producto_id},
        )

    return {"success": True, "msg": "Producto recurrente agregado"}


def remove_recurring_product(
    client_id: int,
    producto_id: int,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    with get_transaction() as connection:
        _ensure_client_access(connection, client_id, current_user)
        connection.execute(
            text(
                """
                DELETE FROM ERP_CLIENT_RECURRING_PRODUCTS
                WHERE Client_Id = :client_id AND Producto_Id = :producto_id
                """
            ),
            {"client_id": client_id, "producto_id": producto_id},
        )
    return {"success": True, "msg": "Producto recurrente eliminado"}
