from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class TicketBody(BaseModel):
    Titulo: str
    Descripcion: str | None = None
    Prioridad: str = "media"
    Categoria: str | None = None
    Client_Id: int | None = None
    AsignadoA: int | None = None
    VentaRef: int | None = None
    FacturaRef: str | None = None


class ComentarioBody(BaseModel):
    Texto: str
    EsInterno: bool = False


class ActualizarEstadoBody(BaseModel):
    Estado: str
    AsignadoA: int | None = None


@router.get("")
def list_tickets(
    estado: str | None = Query(default=None),
    prioridad: str | None = Query(default=None),
    company_id: int | None = Query(default=None),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_companies = current_user.get("companies", [])
    if not user_companies:
        return {"items": [], "count": 0}

    where = "WHERE t.Company_Id IN :companies"
    params: dict[str, Any] = {"companies": tuple(user_companies)}

    if company_id and company_id in user_companies:
        where = "WHERE t.Company_Id = :company_id"
        params = {"company_id": company_id}

    if estado:
        where += " AND t.Estado = :estado"
        params["estado"] = estado
    if prioridad:
        where += " AND t.Prioridad = :prioridad"
        params["prioridad"] = prioridad

    try:
        with get_connection() as conn:
            result = conn.execute(
                text(f"""
                    SELECT
                        t.Ticket_Id, t.Company_Id, t.Titulo, t.Descripcion,
                        t.Prioridad, t.Estado, t.Categoria, t.AsignadoA,
                        t.Client_Id, t.VentaRef, t.FacturaRef,
                        t.FechaCreacion, t.FechaActualizacion, t.FechaResolucion,
                        t.CreadoPor,
                        c.LegalName as ClienteNombre,
                        u.Name as AsignadoNombre
                    FROM ERP_HELPDESK_TICKET t
                    LEFT JOIN ERP_CLIENTS c ON t.Client_Id = c.Client_Id
                    LEFT JOIN ERP_USERS u ON t.AsignadoA = u.User_Id
                    {where}
                    ORDER BY t.FechaCreacion DESC
                """),
                params
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        print(f"Error listando tickets: {e}")
        return {"items": [], "count": 0, "error": str(e)}


@router.post("")
def create_ticket(
    data: TicketBody,
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
                    INSERT INTO ERP_HELPDESK_TICKET
                    (Company_Id, Client_Id, Titulo, Descripcion, Prioridad, Estado,
                     Categoria, AsignadoA, VentaRef, FacturaRef, CreadoPor, FechaCreacion, FechaActualizacion)
                    VALUES (:company_id, :client_id, :titulo, :descripcion, :prioridad, 'abierto',
                            :categoria, :asignado_a, :venta_ref, :factura_ref, :creado_por, GETDATE(), GETDATE())
                """),
                {
                    "company_id": company_id,
                    "client_id": data.Client_Id,
                    "titulo": data.Titulo,
                    "descripcion": data.Descripcion or "",
                    "prioridad": data.Prioridad,
                    "categoria": data.Categoria or "",
                    "asignado_a": data.AsignadoA,
                    "venta_ref": data.VentaRef,
                    "factura_ref": data.FacturaRef or "",
                    "creado_por": current_user.get("id"),
                }
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY() as id")).first()
            ticket_id = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Ticket creado", "ticket_id": ticket_id, "status": 201}
    except Exception as e:
        print(f"Error creando ticket: {e}")
        return {"error": str(e), "status": 500}


@router.get("/{ticket_id}")
def get_ticket(
    ticket_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        t.Ticket_Id, t.Company_Id, t.Titulo, t.Descripcion,
                        t.Prioridad, t.Estado, t.Categoria, t.AsignadoA,
                        t.Client_Id, t.VentaRef, t.FacturaRef,
                        t.FechaCreacion, t.FechaActualizacion, t.FechaResolucion,
                        t.CreadoPor,
                        c.LegalName as ClienteNombre,
                        u.Name as AsignadoNombre,
                        uc.Name as CreadoPorNombre
                    FROM ERP_HELPDESK_TICKET t
                    LEFT JOIN ERP_CLIENTS c ON t.Client_Id = c.Client_Id
                    LEFT JOIN ERP_USERS u ON t.AsignadoA = u.User_Id
                    LEFT JOIN ERP_USERS uc ON t.CreadoPor = uc.User_Id
                    WHERE t.Ticket_Id = :id
                """),
                {"id": ticket_id}
            ).mappings().first()

            if not result:
                return {"error": "Ticket no encontrado", "status": 404}

            ticket = dict(result)

            comentarios = conn.execute(
                text("""
                    SELECT
                        co.Comentario_Id, co.Texto, co.EsInterno, co.FechaCreacion,
                        u.Name as AutorNombre
                    FROM ERP_HELPDESK_COMENTARIO co
                    LEFT JOIN ERP_USERS u ON co.User_Id = u.User_Id
                    WHERE co.Ticket_Id = :id
                    ORDER BY co.FechaCreacion ASC
                """),
                {"id": ticket_id}
            ).mappings().all()

            ticket["comentarios"] = [dict(c) for c in comentarios]
            return ticket
    except Exception as e:
        print(f"Error obteniendo ticket: {e}")
        return {"error": str(e), "status": 500}


@router.patch("/{ticket_id}/estado")
def actualizar_estado(
    ticket_id: int,
    data: ActualizarEstadoBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    estados_validos = ("abierto", "en_progreso", "resuelto", "cerrado")
    if data.Estado not in estados_validos:
        return {"error": f"Estado inválido. Válidos: {estados_validos}", "status": 400}

    try:
        with get_connection() as conn:
            params: dict[str, Any] = {
                "estado": data.Estado,
                "id": ticket_id,
            }
            fecha_resolucion_sql = ""
            if data.Estado in ("resuelto", "cerrado"):
                fecha_resolucion_sql = ", FechaResolucion = GETDATE()"

            asignado_sql = ""
            if data.AsignadoA is not None:
                asignado_sql = ", AsignadoA = :asignado_a"
                params["asignado_a"] = data.AsignadoA

            conn.execute(
                text(f"""
                    UPDATE ERP_HELPDESK_TICKET
                    SET Estado = :estado, FechaActualizacion = GETDATE()
                        {fecha_resolucion_sql}
                        {asignado_sql}
                    WHERE Ticket_Id = :id
                """),
                params
            )
            conn.commit()
            return {"message": f"Ticket actualizado a '{data.Estado}'"}
    except Exception as e:
        print(f"Error actualizando estado: {e}")
        return {"error": str(e), "status": 500}


@router.post("/{ticket_id}/comentarios")
def add_comentario(
    ticket_id: int,
    data: ComentarioBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_HELPDESK_COMENTARIO (Ticket_Id, User_Id, Texto, EsInterno, FechaCreacion)
                    VALUES (:ticket_id, :user_id, :texto, :es_interno, GETDATE())
                """),
                {
                    "ticket_id": ticket_id,
                    "user_id": current_user.get("id"),
                    "texto": data.Texto,
                    "es_interno": 1 if data.EsInterno else 0,
                }
            )
            conn.execute(
                text("UPDATE ERP_HELPDESK_TICKET SET FechaActualizacion = GETDATE() WHERE Ticket_Id = :id"),
                {"id": ticket_id}
            )
            conn.commit()
            return {"message": "Comentario agregado", "status": 201}
    except Exception as e:
        print(f"Error agregando comentario: {e}")
        return {"error": str(e), "status": 500}


@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("DELETE FROM ERP_HELPDESK_COMENTARIO WHERE Ticket_Id = :id"),
                {"id": ticket_id}
            )
            conn.execute(
                text("DELETE FROM ERP_HELPDESK_TICKET WHERE Ticket_Id = :id"),
                {"id": ticket_id}
            )
            conn.commit()
            return {"message": "Ticket eliminado"}
    except Exception as e:
        print(f"Error eliminando ticket: {e}")
        return {"error": str(e), "status": 500}
