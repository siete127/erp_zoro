from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import constancia_service as svc

router = APIRouter()


@router.post("/parse")
async def parse_constancia(constancia: UploadFile = File(...)):
    if not constancia.filename:
        raise HTTPException(status_code=400, detail="No se recibió archivo")
    content = await constancia.read()
    try:
        data = await svc.parse_constancia(content, constancia.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": data}
