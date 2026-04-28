from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import text

from app.db.session import get_connection, get_transaction

ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
EXT_BY_MIME = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "productos")


def _ensure_dir() -> str:
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    return UPLOADS_DIR


def list_images(producto_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT Imagen_Id, Producto_Id, Url, NombreArchivo, EsPrincipal, Orden, FechaCarga
                FROM ERP_PRODUCTO_IMAGENES
                WHERE Producto_Id = :pid
                ORDER BY EsPrincipal DESC, Orden ASC
            """),
            {"pid": producto_id},
        ).mappings().all()
    return [dict(r) for r in rows]


async def upload_image(
    producto_id: int,
    file: UploadFile,
    es_principal: bool,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use JPG, PNG o WEBP.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 5 MB.")

    ext = EXT_BY_MIME.get(file.content_type, ".jpg")
    filename = f"prod_{producto_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(_ensure_dir(), filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"/uploads/productos/{filename}"

    with get_transaction() as conn:
        # Si es principal, quitar flag de las demás
        if es_principal:
            conn.execute(
                text("UPDATE ERP_PRODUCTO_IMAGENES SET EsPrincipal=0 WHERE Producto_Id=:pid"),
                {"pid": producto_id},
            )
        # Calcular orden siguiente
        row = conn.execute(
            text("SELECT ISNULL(MAX(Orden),0)+1 AS siguiente FROM ERP_PRODUCTO_IMAGENES WHERE Producto_Id=:pid"),
            {"pid": producto_id},
        ).mappings().first()
        orden = row["siguiente"] if row else 1

        inserted = conn.execute(
            text("""
                INSERT INTO ERP_PRODUCTO_IMAGENES (Producto_Id, Url, NombreArchivo, EsPrincipal, Orden)
                OUTPUT INSERTED.*
                VALUES (:pid, :url, :nombre, :principal, :orden)
            """),
            {"pid": producto_id, "url": url, "nombre": filename, "principal": int(es_principal), "orden": orden},
        ).mappings().first()

    return dict(inserted)


def set_principal(imagen_id: int, producto_id: int) -> dict[str, Any]:
    with get_transaction() as conn:
        conn.execute(
            text("UPDATE ERP_PRODUCTO_IMAGENES SET EsPrincipal=0 WHERE Producto_Id=:pid"),
            {"pid": producto_id},
        )
        updated = conn.execute(
            text("""
                UPDATE ERP_PRODUCTO_IMAGENES SET EsPrincipal=1
                OUTPUT INSERTED.*
                WHERE Imagen_Id=:iid AND Producto_Id=:pid
            """),
            {"iid": imagen_id, "pid": producto_id},
        ).mappings().first()
    if not updated:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return dict(updated)


def delete_image(imagen_id: int, producto_id: int) -> dict[str, str]:
    with get_transaction() as conn:
        row = conn.execute(
            text("SELECT Url, NombreArchivo FROM ERP_PRODUCTO_IMAGENES WHERE Imagen_Id=:iid AND Producto_Id=:pid"),
            {"iid": imagen_id, "pid": producto_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")

        conn.execute(
            text("DELETE FROM ERP_PRODUCTO_IMAGENES WHERE Imagen_Id=:iid"),
            {"iid": imagen_id},
        )

    # Borrar archivo físico
    try:
        filepath = os.path.join(_ensure_dir(), row["NombreArchivo"])
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass

    return {"msg": "Imagen eliminada"}
