import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

SEPOMEX_URL = "https://sepomex.icalialabs.com/api/v1/zip_codes"


@router.get("/{codigo}")
async def get_cp(codigo: str):
    cp = "".join(c for c in codigo if c.isdigit())
    if len(cp) != 5:
        raise HTTPException(status_code=400, detail="Código postal inválido")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                SEPOMEX_URL,
                params={"zip_code": cp, "per_page": 1},
                headers={"Accept": "application/json"},
            )
        data = resp.json()
        first = (data.get("zip_codes") or [None])[0]
        if not first:
            raise HTTPException(status_code=404, detail="CP no encontrado")
        return {
            "success": True,
            "data": {
                "ciudad": first.get("d_ciudad") or first.get("d_mnpio") or "",
                "municipio": first.get("d_mnpio") or "",
                "estado": first.get("d_estado") or "",
                "colonia": first.get("d_asenta") or "",
                "pais": "México",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail="No se pudo consultar el servicio de CP")
