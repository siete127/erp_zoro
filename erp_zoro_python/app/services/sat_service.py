from __future__ import annotations

import base64
import os
from typing import Any

from sqlalchemy import text

from app.db.session import get_connection


def _facturama_headers() -> dict[str, str] | None:
    user = os.getenv("FACTURAMA_USER")
    password = os.getenv("FACTURAMA_PASSWORD")
    if not user or not password:
        return None
    encoded = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {encoded}"}


def _facturama_get(path: str, keyword: str) -> list[dict[str, Any]]:
    base_url = os.getenv("FACTURAMA_BASE_URL")
    headers = _facturama_headers()
    if not base_url or not headers:
        return []

    try:
        import httpx
    except ImportError:
        return []

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{base_url.rstrip('/')}/{path.lstrip('/')}",
                params={"keyword": keyword},
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
    except Exception:
        return []


def search_prodserv(search: str, page: int, limit: int) -> dict[str, Any]:
    search = str(search or "").strip()
    page = max(int(page or 1), 1)
    limit = max(int(limit or 20), 1)
    offset = (page - 1) * limit

    query = "SELECT Clave, Descripcion FROM SAT_CLAVE_PRODSERV WHERE 1=1"
    params: dict[str, Any] = {"offset": offset, "limit": limit}

    if len(search) >= 2:
        query += " AND (Clave LIKE :search OR Descripcion LIKE :search)"
        params["search"] = f"%{search}%"

    query += " ORDER BY Clave OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY"

    with get_connection() as connection:
        result = connection.execute(text(query), params)
        rows = [dict(row) for row in result.mappings().all()]

    if rows:
        return {"data": rows, "hasMore": len(rows) == limit}

    if len(search) >= 2:
        remote = _facturama_get("/Catalogs/ProductsOrServices", search)
        mapped = [
            {
                "Clave": item.get("Value"),
                "Descripcion": item.get("Name"),
            }
            for item in remote
            if item.get("Name") and item.get("Name") != "No existe en el catalogo"
        ]
        return {"data": mapped, "hasMore": False}

    return {"data": [], "hasMore": False}


def get_prodserv(clave: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        result = connection.execute(
            text("SELECT * FROM SAT_CLAVE_PRODSERV WHERE Clave = :clave"),
            {"clave": clave},
        ).mappings().first()
    return dict(result) if result else None


def search_unidades(search: str) -> dict[str, Any]:
    search = str(search or "").strip()
    if len(search) < 2:
        return {"data": [], "hasMore": False}

    with get_connection() as connection:
        local_result = connection.execute(
            text(
                """
                SELECT Clave, Nombre, Descripcion, Simbolo
                FROM SAT_UNIDADES
                WHERE Clave LIKE :search OR Nombre LIKE :search OR Descripcion LIKE :search OR Simbolo LIKE :search
                ORDER BY Clave
                """
            ),
            {"search": f"%{search}%"},
        )
        local_rows = [dict(row) for row in local_result.mappings().all()]

    if local_rows:
        return {"data": local_rows, "hasMore": False}

    remote = _facturama_get("/Catalogs/Units", search)
    mapped = [
        {
            "Clave": item.get("Value") or item.get("Key") or item.get("Clave") or "",
            "Nombre": item.get("Name") or item.get("Nombre") or "",
            "Descripcion": item.get("Description") or item.get("Descripcion") or "",
            "Simbolo": item.get("Symbol") or item.get("Simbolo"),
        }
        for item in remote
    ]
    mapped = [item for item in mapped if item["Clave"] and item["Nombre"]]
    return {"data": mapped, "hasMore": False}


def get_unidad(clave: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        result = connection.execute(
            text("SELECT * FROM SAT_UNIDADES WHERE Clave = :clave"),
            {"clave": clave},
        ).mappings().first()
    return dict(result) if result else None
