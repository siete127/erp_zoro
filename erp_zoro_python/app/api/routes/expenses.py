from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class GastoBody(BaseModel):
    Categoria: str
    Descripcion: str | None = None
    Monto: float
    Moneda: str = "MXN"
    FechaGasto: str  # YYYY-MM-DD
    Notas: str | None = None


class AprobacionBody(BaseModel):
    accion: str  # "aprobar" | "rechazar"
    Notas: str | None = None


@router.get("")
def list_gastos(
    estado: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_companies = current_user.get("companies", [])
    if not user_companies:
        return {"items": [], "count": 0}

    where = "WHERE g.Company_Id IN :companies"
    params: dict[str, Any] = {"companies": tuple(user_companies)}

    if estado:
        where += " AND g.Estado = :estado"
        params["estado"] = estado
    if user_id:
        where += " AND g.User_Id = :user_id"
        params["user_id"] = user_id

    try:
        with get_connection() as conn:
            result = conn.execute(
                text(f"""
                    SELECT
                        g.Gasto_Id, g.Company_Id, g.User_Id, g.Categoria,
                        g.Descripcion, g.Monto, g.Moneda, g.FechaGasto,
                        g.Comprobante, g.Estado, g.AprobadoPor,
                        g.FechaAprobacion, g.Notas, g.FechaCreacion,
                        u.Name as UsuarioNombre,
                        a.Name as AprobadorNombre
                    FROM ERP_GASTO g
                    LEFT JOIN ERP_USERS u ON g.User_Id = u.User_Id
                    LEFT JOIN ERP_USERS a ON g.AprobadoPor = a.User_Id
                    {where}
                    ORDER BY g.FechaCreacion DESC
                """),
                params
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        print(f"Error listando gastos: {e}")
        return {"items": [], "count": 0, "error": str(e)}


@router.post("")
def create_gasto(
    data: GastoBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_companies = current_user.get("companies", [])
    company_id = user_companies[0] if user_companies else None
    if not company_id:
        return {"error": "Sin empresa asociada", "status": 400}

    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_GASTO
                    (Company_Id, User_Id, Categoria, Descripcion, Monto, Moneda,
                     FechaGasto, Estado, Notas, FechaCreacion)
                    VALUES (:company_id, :user_id, :categoria, :descripcion, :monto, :moneda,
                            :fecha_gasto, 'borrador', :notas, GETDATE())
                """),
                {
                    "company_id": company_id,
                    "user_id": current_user.get("id"),
                    "categoria": data.Categoria,
                    "descripcion": data.Descripcion or "",
                    "monto": data.Monto,
                    "moneda": data.Moneda,
                    "fecha_gasto": data.FechaGasto,
                    "notas": data.Notas or "",
                }
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY() as id")).first()
            gasto_id = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Gasto registrado", "gasto_id": gasto_id, "status": 201}
    except Exception as e:
        print(f"Error creando gasto: {e}")
        return {"error": str(e), "status": 500}


@router.get("/{gasto_id}")
def get_gasto(
    gasto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        g.Gasto_Id, g.Company_Id, g.User_Id, g.Categoria,
                        g.Descripcion, g.Monto, g.Moneda, g.FechaGasto,
                        g.Comprobante, g.Estado, g.AprobadoPor,
                        g.FechaAprobacion, g.Notas, g.FechaCreacion,
                        u.Name as UsuarioNombre,
                        a.Name as AprobadorNombre
                    FROM ERP_GASTO g
                    LEFT JOIN ERP_USERS u ON g.User_Id = u.User_Id
                    LEFT JOIN ERP_USERS a ON g.AprobadoPor = a.User_Id
                    WHERE g.Gasto_Id = :id
                """),
                {"id": gasto_id}
            ).mappings().first()
            if not result:
                return {"error": "Gasto no encontrado", "status": 404}
            return dict(result)
    except Exception as e:
        print(f"Error obteniendo gasto: {e}")
        return {"error": str(e), "status": 500}


@router.patch("/{gasto_id}/enviar")
def enviar_gasto(
    gasto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Envía el gasto para aprobación (borrador → enviado)"""
    try:
        with get_connection() as conn:
            conn.execute(
                text("UPDATE ERP_GASTO SET Estado = 'enviado' WHERE Gasto_Id = :id AND User_Id = :uid"),
                {"id": gasto_id, "uid": current_user.get("id")}
            )
            conn.commit()
            return {"message": "Gasto enviado para aprobación"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.patch("/{gasto_id}/aprobar")
def aprobar_gasto(
    gasto_id: int,
    data: AprobacionBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Aprueba o rechaza un gasto (para supervisores/admins)"""
    if data.accion not in ("aprobar", "rechazar"):
        return {"error": "accion debe ser 'aprobar' o 'rechazar'", "status": 400}
    nuevo_estado = "aprobado" if data.accion == "aprobar" else "rechazado"
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_GASTO
                    SET Estado = :estado,
                        AprobadoPor = :aprobado_por,
                        FechaAprobacion = GETDATE(),
                        Notas = ISNULL(Notas, '') + CASE WHEN :notas <> '' THEN ' | ' + :notas ELSE '' END
                    WHERE Gasto_Id = :id
                """),
                {
                    "estado": nuevo_estado,
                    "aprobado_por": current_user.get("id"),
                    "notas": data.Notas or "",
                    "id": gasto_id,
                }
            )
            conn.commit()
            return {"message": f"Gasto {nuevo_estado}"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/{gasto_id}")
def delete_gasto(
    gasto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("DELETE FROM ERP_GASTO WHERE Gasto_Id = :id AND User_Id = :uid"),
                {"id": gasto_id, "uid": current_user.get("id")}
            )
            conn.commit()
            return {"message": "Gasto eliminado"}
    except Exception as e:
        return {"error": str(e), "status": 500}
