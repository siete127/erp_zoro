from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class VehiculoBody(BaseModel):
    Placa: str
    Marca: str
    Modelo: str
    Anio: int | None = None
    Color: str | None = None
    Tipo: str = "camion"          # camion | auto | moto | otro
    AsignadoA: int | None = None  # User_Id del conductor
    Estado: str = "activo"        # activo | mantenimiento | baja
    Notas: str | None = None


class ServicioBody(BaseModel):
    Vehiculo_Id: int
    TipoServicio: str             # mantenimiento | revision | combustible | seguro | otro
    Descripcion: str | None = None
    Costo: float | None = None
    Proveedor: str | None = None
    FechaServicio: str            # YYYY-MM-DD
    KilometrajeActual: int | None = None
    Notas: str | None = None


# ─── VEHÍCULOS ───────────────────────────────────────────────────────

@router.get("/vehiculos")
def list_vehiculos(
    estado: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    where = "WHERE v.Company_Id = :cid"
    params: dict[str, Any] = {"cid": company_id}
    if estado:
        where += " AND v.Estado = :estado"
        params["estado"] = estado
    try:
        with get_connection() as conn:
            result = conn.execute(
                text(f"""
                    SELECT v.Vehiculo_Id, v.Placa, v.Marca, v.Modelo, v.Anio,
                           v.Color, v.Tipo, v.Estado, v.Notas,
                           v.KilometrajeActual, v.FechaCreacion,
                           u.Name as ConductorNombre
                    FROM ERP_FLEET_VEHICULO v
                    LEFT JOIN ERP_USERS u ON v.AsignadoA = u.User_Id
                    {where}
                    ORDER BY v.Marca, v.Modelo
                """),
                params,
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/vehiculos")
def create_vehiculo(
    data: VehiculoBody,
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
                    INSERT INTO ERP_FLEET_VEHICULO
                    (Company_Id, Placa, Marca, Modelo, Anio, Color, Tipo,
                     AsignadoA, Estado, Notas, KilometrajeActual, FechaCreacion)
                    VALUES (:cid, :placa, :marca, :modelo, :anio, :color, :tipo,
                            :asignado, :estado, :notas, 0, GETDATE())
                """),
                {
                    "cid": company_id, "placa": data.Placa, "marca": data.Marca,
                    "modelo": data.Modelo, "anio": data.Anio,
                    "color": data.Color or "", "tipo": data.Tipo,
                    "asignado": data.AsignadoA, "estado": data.Estado,
                    "notas": data.Notas or "",
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            vid = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Vehículo registrado", "vehiculo_id": vid, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/vehiculos/{vehiculo_id}")
def get_vehiculo(
    vehiculo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            v = conn.execute(
                text("""
                    SELECT v.*, u.Name as ConductorNombre
                    FROM ERP_FLEET_VEHICULO v
                    LEFT JOIN ERP_USERS u ON v.AsignadoA = u.User_Id
                    WHERE v.Vehiculo_Id = :id
                """),
                {"id": vehiculo_id},
            ).mappings().first()
            if not v:
                return {"error": "Vehículo no encontrado", "status": 404}
            vehiculo = dict(v)

            servicios = conn.execute(
                text("""
                    SELECT * FROM ERP_FLEET_SERVICIO
                    WHERE Vehiculo_Id = :id
                    ORDER BY FechaServicio DESC
                """),
                {"id": vehiculo_id},
            ).mappings().all()
            vehiculo["servicios"] = [dict(s) for s in servicios]
            return vehiculo
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.put("/vehiculos/{vehiculo_id}")
def update_vehiculo(
    vehiculo_id: int,
    data: VehiculoBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_FLEET_VEHICULO
                    SET Placa=:placa, Marca=:marca, Modelo=:modelo, Anio=:anio,
                        Color=:color, Tipo=:tipo, AsignadoA=:asignado,
                        Estado=:estado, Notas=:notas
                    WHERE Vehiculo_Id = :id
                """),
                {
                    "placa": data.Placa, "marca": data.Marca, "modelo": data.Modelo,
                    "anio": data.Anio, "color": data.Color or "", "tipo": data.Tipo,
                    "asignado": data.AsignadoA, "estado": data.Estado,
                    "notas": data.Notas or "", "id": vehiculo_id,
                },
            )
            conn.commit()
            return {"message": "Vehículo actualizado"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/vehiculos/{vehiculo_id}")
def delete_vehiculo(
    vehiculo_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_FLEET_SERVICIO WHERE Vehiculo_Id = :id"), {"id": vehiculo_id})
            conn.execute(text("DELETE FROM ERP_FLEET_VEHICULO WHERE Vehiculo_Id = :id"), {"id": vehiculo_id})
            conn.commit()
            return {"message": "Vehículo eliminado"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── SERVICIOS / MANTENIMIENTO ───────────────────────────────────────

@router.get("/servicios")
def list_servicios(
    vehiculo_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    if not company_id:
        return {"items": [], "count": 0}
    where = "WHERE v.Company_Id = :cid"
    params: dict[str, Any] = {"cid": company_id}
    if vehiculo_id:
        where += " AND s.Vehiculo_Id = :vid"
        params["vid"] = vehiculo_id
    try:
        with get_connection() as conn:
            result = conn.execute(
                text(f"""
                    SELECT s.Servicio_Id, s.Vehiculo_Id, s.TipoServicio,
                           s.Descripcion, s.Costo, s.Proveedor,
                           s.FechaServicio, s.KilometrajeActual, s.Notas,
                           v.Placa, v.Marca, v.Modelo
                    FROM ERP_FLEET_SERVICIO s
                    JOIN ERP_FLEET_VEHICULO v ON s.Vehiculo_Id = v.Vehiculo_Id
                    {where}
                    ORDER BY s.FechaServicio DESC
                """),
                params,
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/servicios")
def create_servicio(
    data: ServicioBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_FLEET_SERVICIO
                    (Vehiculo_Id, TipoServicio, Descripcion, Costo, Proveedor,
                     FechaServicio, KilometrajeActual, Notas, FechaCreacion)
                    VALUES (:vid, :tipo, :desc, :costo, :proveedor,
                            :fecha, :km, :notas, GETDATE())
                """),
                {
                    "vid": data.Vehiculo_Id, "tipo": data.TipoServicio,
                    "desc": data.Descripcion or "", "costo": data.Costo,
                    "proveedor": data.Proveedor or "", "fecha": data.FechaServicio,
                    "km": data.KilometrajeActual, "notas": data.Notas or "",
                },
            )
            if data.KilometrajeActual:
                conn.execute(
                    text("UPDATE ERP_FLEET_VEHICULO SET KilometrajeActual = :km WHERE Vehiculo_Id = :vid"),
                    {"km": data.KilometrajeActual, "vid": data.Vehiculo_Id},
                )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            sid = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Servicio registrado", "servicio_id": sid, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/servicios/{servicio_id}")
def delete_servicio(
    servicio_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_FLEET_SERVICIO WHERE Servicio_Id = :id"), {"id": servicio_id})
            conn.commit()
            return {"message": "Servicio eliminado"}
    except Exception as e:
        return {"error": str(e), "status": 500}
