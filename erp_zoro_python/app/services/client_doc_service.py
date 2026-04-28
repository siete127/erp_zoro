from __future__ import annotations

import os
import uuid
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import text

from app.db.session import get_connection, get_transaction

ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg", "image/png", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
TIPOS_VALIDOS = {"CSF", "INE", "PODER_NOTARIAL", "CONTRATO", "COMPROBANTE_DOMICILIO", "OTRO"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "clientes")


def _ensure_dir() -> str:
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    return UPLOADS_DIR


def list_documentos(cliente_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
                SELECT Doc_Id, Cliente_Id, TipoDocumento, NombreArchivo, ArchivoUrl,
                       MimeType, SizeBytes, FechaCarga, CargadoPor
                FROM ERP_CLIENT_DOCUMENTOS
                WHERE Cliente_Id = :cid
                ORDER BY FechaCarga DESC
            """),
            {"cid": cliente_id},
        ).mappings().all()
    return [dict(r) for r in rows]


async def upload_documento(
    cliente_id: int,
    tipo: str,
    file: UploadFile,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    tipo_upper = tipo.upper()
    if tipo_upper not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Válidos: {', '.join(TIPOS_VALIDOS)}")
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 10 MB.")

    ext = EXT_BY_MIME.get(file.content_type, ".pdf")
    safe_name = (file.filename or "doc").replace(" ", "_")
    filename = f"cliente_{cliente_id}_{tipo_upper}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(_ensure_dir(), filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    url = f"/uploads/clientes/{filename}"
    user_id = current_user.get("User_Id") or current_user.get("id")

    with get_transaction() as conn:
        inserted = conn.execute(
            text("""
                INSERT INTO ERP_CLIENT_DOCUMENTOS
                    (Cliente_Id, TipoDocumento, NombreArchivo, ArchivoUrl, MimeType, SizeBytes, CargadoPor)
                OUTPUT INSERTED.*
                VALUES (:cid, :tipo, :nombre, :url, :mime, :size, :uid)
            """),
            {
                "cid": cliente_id,
                "tipo": tipo_upper,
                "nombre": safe_name,
                "url": url,
                "mime": file.content_type,
                "size": len(contents),
                "uid": user_id,
            },
        ).mappings().first()

    return dict(inserted)


def delete_documento(doc_id: int, cliente_id: int) -> dict[str, str]:
    with get_transaction() as conn:
        row = conn.execute(
            text("SELECT NombreArchivo, ArchivoUrl FROM ERP_CLIENT_DOCUMENTOS WHERE Doc_Id=:did AND Cliente_Id=:cid"),
            {"did": doc_id, "cid": cliente_id},
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Documento no encontrado")

        conn.execute(
            text("DELETE FROM ERP_CLIENT_DOCUMENTOS WHERE Doc_Id=:did"),
            {"did": doc_id},
        )

    try:
        filename = os.path.basename(row["ArchivoUrl"])
        filepath = os.path.join(_ensure_dir(), filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass

    return {"msg": "Documento eliminado"}
