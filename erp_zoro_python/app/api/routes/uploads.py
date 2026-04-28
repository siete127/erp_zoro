from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.api.deps import get_current_user

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads"


@router.get("/uploads/{file_path:path}")
async def get_file(file_path: str, user=Depends(get_current_user)):
    safe_path = Path(file_path)

    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise HTTPException(status_code=400, detail="Ruta inválida")

    file = UPLOADS_DIR / safe_path

    if not file.exists() or not file.is_file():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return FileResponse(file)