from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class PlanBody(BaseModel):
    Nombre: str
    Descripcion: str | None = None
    PrecioMensual: float
    PrecioAnual: float | None = None
    Moneda: str = "MXN"
    Caracteristicas: str | None = None   # texto libre o JSON


class SuscripcionBody(BaseModel):
    Client_Id: int
    Plan_Id: int
    FechaInicio: str            # YYYY-MM-DD
    Ciclo: str = "mensual"      # mensual | anual
    Notas: str | None = None


class RenovarBody(BaseModel):
    FechaInicio: str            # nueva fecha de inicio del ciclo


# ─── PLANES ─────────────────────────────────────────────────────────

@router.get("/planes")
def list_planes(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT Plan_Id, Nombre, Descripcion, PrecioMensual, PrecioAnual,
                           Moneda, Caracteristicas, Activo, FechaCreacion
                    FROM ERP_SUSCRIPCION_PLAN
                    WHERE Company_Id = :cid AND Activo = 1
                    ORDER BY PrecioMensual
                """),
                {"cid": company_id},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/planes")
def create_plan(
    data: PlanBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"error": "Sin empresa", "status": 400}
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_SUSCRIPCION_PLAN
                    (Company_Id, Nombre, Descripcion, PrecioMensual, PrecioAnual,
                     Moneda, Caracteristicas, Activo, FechaCreacion)
                    VALUES (:cid, :nombre, :desc, :pm, :pa, :moneda, :caract, 1, GETDATE())
                """),
                {
                    "cid": company_id, "nombre": data.Nombre,
                    "desc": data.Descripcion or "",
                    "pm": data.PrecioMensual,
                    "pa": data.PrecioAnual if data.PrecioAnual is not None else data.PrecioMensual * 10,
                    "moneda": data.Moneda,
                    "caract": data.Caracteristicas or "",
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            pid = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Plan creado", "plan_id": pid, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/planes/{plan_id}")
def delete_plan(
    plan_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("UPDATE ERP_SUSCRIPCION_PLAN SET Activo = 0 WHERE Plan_Id = :id"),
                {"id": plan_id},
            )
            conn.commit()
            return {"message": "Plan desactivado"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── SUSCRIPCIONES ───────────────────────────────────────────────────

@router.get("")
def list_suscripciones(
    estado: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    where = "WHERE s.Company_Id = :cid"
    params: dict[str, Any] = {"cid": company_id}
    if estado:
        where += " AND s.Estado = :estado"
        params["estado"] = estado
    try:
        with get_connection() as conn:
            result = conn.execute(
                text(f"""
                    SELECT s.Suscripcion_Id, s.Client_Id, s.Plan_Id,
                           s.FechaInicio, s.FechaVencimiento, s.Ciclo,
                           s.Estado, s.Notas, s.FechaCreacion,
                           s.MontoProximo,
                           c.LegalName as ClienteNombre,
                           p.Nombre as PlanNombre,
                           p.PrecioMensual, p.PrecioAnual, p.Moneda
                    FROM ERP_SUSCRIPCION s
                    JOIN ERP_CLIENTS c ON s.Client_Id = c.Client_Id
                    JOIN ERP_SUSCRIPCION_PLAN p ON s.Plan_Id = p.Plan_Id
                    {where}
                    ORDER BY s.FechaVencimiento ASC
                """),
                params,
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("")
def create_suscripcion(
    data: SuscripcionBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"error": "Sin empresa", "status": 400}
    try:
        with get_connection() as conn:
            # Calcular fecha de vencimiento y monto
            plan = conn.execute(
                text("SELECT PrecioMensual, PrecioAnual FROM ERP_SUSCRIPCION_PLAN WHERE Plan_Id = :pid"),
                {"pid": data.Plan_Id},
            ).mappings().first()
            if not plan:
                return {"error": "Plan no encontrado", "status": 404}

            monto = float(plan["PrecioAnual"]) if data.Ciclo == "anual" else float(plan["PrecioMensual"])
            meses = 12 if data.Ciclo == "anual" else 1

            conn.execute(
                text("""
                    INSERT INTO ERP_SUSCRIPCION
                    (Company_Id, Client_Id, Plan_Id, FechaInicio,
                     FechaVencimiento, Ciclo, Estado, MontoProximo, Notas, FechaCreacion)
                    VALUES (:cid, :client, :plan, :inicio,
                            DATEADD(month, :meses, :inicio), :ciclo,
                            'activa', :monto, :notas, GETDATE())
                """),
                {
                    "cid": company_id, "client": data.Client_Id, "plan": data.Plan_Id,
                    "inicio": data.FechaInicio, "meses": meses,
                    "ciclo": data.Ciclo, "monto": monto, "notas": data.Notas or "",
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            sid = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Suscripción creada", "suscripcion_id": sid, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.patch("/{suscripcion_id}/cancelar")
def cancelar_suscripcion(
    suscripcion_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("UPDATE ERP_SUSCRIPCION SET Estado = 'cancelada' WHERE Suscripcion_Id = :id"),
                {"id": suscripcion_id},
            )
            conn.commit()
            return {"message": "Suscripción cancelada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.patch("/{suscripcion_id}/renovar")
def renovar_suscripcion(
    suscripcion_id: int,
    data: RenovarBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            sus = conn.execute(
                text("SELECT Ciclo, Plan_Id FROM ERP_SUSCRIPCION WHERE Suscripcion_Id = :id"),
                {"id": suscripcion_id},
            ).mappings().first()
            if not sus:
                return {"error": "Suscripción no encontrada", "status": 404}
            meses = 12 if sus["Ciclo"] == "anual" else 1
            conn.execute(
                text("""
                    UPDATE ERP_SUSCRIPCION
                    SET Estado = 'activa',
                        FechaInicio = :inicio,
                        FechaVencimiento = DATEADD(month, :meses, :inicio)
                    WHERE Suscripcion_Id = :id
                """),
                {"inicio": data.FechaInicio, "meses": meses, "id": suscripcion_id},
            )
            conn.commit()
            return {"message": "Suscripción renovada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/por-vencer")
def suscripciones_por_vencer(
    dias: int = Query(default=30),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Lista suscripciones que vencen en los próximos N días."""
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT s.Suscripcion_Id, s.FechaVencimiento, s.Ciclo,
                           s.MontoProximo, s.Estado,
                           c.LegalName as ClienteNombre, c.Email as ClienteEmail,
                           p.Nombre as PlanNombre
                    FROM ERP_SUSCRIPCION s
                    JOIN ERP_CLIENTS c ON s.Client_Id = c.Client_Id
                    JOIN ERP_SUSCRIPCION_PLAN p ON s.Plan_Id = p.Plan_Id
                    WHERE s.Company_Id = :cid
                      AND s.Estado = 'activa'
                      AND s.FechaVencimiento BETWEEN GETDATE() AND DATEADD(day, :dias, GETDATE())
                    ORDER BY s.FechaVencimiento ASC
                """),
                {"cid": company_id, "dias": dias},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}
