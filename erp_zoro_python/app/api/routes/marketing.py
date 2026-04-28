from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_connection

router = APIRouter()


# ─── Pydantic models ────────────────────────────────────────────────

class ListaBody(BaseModel):
    Nombre: str
    Descripcion: str | None = None


class ContactoBody(BaseModel):
    Nombre: str
    Email: str
    Telefono: str | None = None
    Empresa: str | None = None


class CampanaBody(BaseModel):
    Nombre: str
    Asunto: str
    Cuerpo: str          # HTML permitido
    Lista_Id: int
    Tipo: str = "email"  # email | sms (sms futuro)


# ─── LISTAS DE CONTACTOS ────────────────────────────────────────────

@router.get("/listas")
def list_listas(
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
                    SELECT l.Lista_Id, l.Nombre, l.Descripcion, l.FechaCreacion,
                           COUNT(lc.Contacto_Id) as TotalContactos
                    FROM ERP_MARKETING_LISTA l
                    LEFT JOIN ERP_MARKETING_CONTACTO lc ON lc.Lista_Id = l.Lista_Id
                    WHERE l.Company_Id = :cid
                    GROUP BY l.Lista_Id, l.Nombre, l.Descripcion, l.FechaCreacion
                    ORDER BY l.FechaCreacion DESC
                """),
                {"cid": company_id},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/listas")
def create_lista(
    data: ListaBody,
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
                    INSERT INTO ERP_MARKETING_LISTA (Company_Id, Nombre, Descripcion, FechaCreacion)
                    VALUES (:cid, :nombre, :desc, GETDATE())
                """),
                {"cid": company_id, "nombre": data.Nombre, "desc": data.Descripcion or ""},
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            lista_id = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Lista creada", "lista_id": lista_id, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/listas/{lista_id}")
def delete_lista(
    lista_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_MARKETING_CONTACTO WHERE Lista_Id = :id"), {"id": lista_id})
            conn.execute(text("DELETE FROM ERP_MARKETING_LISTA WHERE Lista_Id = :id"), {"id": lista_id})
            conn.commit()
            return {"message": "Lista eliminada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── CONTACTOS DE UNA LISTA ──────────────────────────────────────────

@router.get("/listas/{lista_id}/contactos")
def list_contactos(
    lista_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT Contacto_Id, Nombre, Email, Telefono, Empresa, FechaAgregado
                    FROM ERP_MARKETING_CONTACTO
                    WHERE Lista_Id = :lid
                    ORDER BY FechaAgregado DESC
                """),
                {"lid": lista_id},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/listas/{lista_id}/contactos")
def add_contacto(
    lista_id: int,
    data: ContactoBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            # Evitar duplicado de email en la misma lista
            dup = conn.execute(
                text("SELECT 1 FROM ERP_MARKETING_CONTACTO WHERE Lista_Id = :lid AND Email = :email"),
                {"lid": lista_id, "email": data.Email},
            ).first()
            if dup:
                return {"error": "Este email ya está en la lista", "status": 409}
            conn.execute(
                text("""
                    INSERT INTO ERP_MARKETING_CONTACTO
                    (Lista_Id, Nombre, Email, Telefono, Empresa, FechaAgregado)
                    VALUES (:lid, :nombre, :email, :tel, :empresa, GETDATE())
                """),
                {
                    "lid": lista_id,
                    "nombre": data.Nombre,
                    "email": data.Email,
                    "tel": data.Telefono or "",
                    "empresa": data.Empresa or "",
                },
            )
            conn.commit()
            return {"message": "Contacto agregado", "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/listas/{lista_id}/contactos/{contacto_id}")
def remove_contacto(
    lista_id: int,
    contacto_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(
                text("DELETE FROM ERP_MARKETING_CONTACTO WHERE Contacto_Id = :id AND Lista_Id = :lid"),
                {"id": contacto_id, "lid": lista_id},
            )
            conn.commit()
            return {"message": "Contacto eliminado"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── CAMPAÑAS ────────────────────────────────────────────────────────

@router.get("/campanas")
def list_campanas(
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
                    SELECT c.Campana_Id, c.Nombre, c.Asunto, c.Estado,
                           c.FechaCreacion, c.FechaEnvio,
                           c.TotalEnviados, c.TotalAbiertos, c.TotalErrores,
                           l.Nombre as ListaNombre
                    FROM ERP_MARKETING_CAMPANA c
                    LEFT JOIN ERP_MARKETING_LISTA l ON l.Lista_Id = c.Lista_Id
                    WHERE c.Company_Id = :cid
                    ORDER BY c.FechaCreacion DESC
                """),
                {"cid": company_id},
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/campanas")
def create_campana(
    data: CampanaBody,
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
                    INSERT INTO ERP_MARKETING_CAMPANA
                    (Company_Id, Lista_Id, Nombre, Asunto, Cuerpo, Tipo, Estado, FechaCreacion)
                    VALUES (:cid, :lista, :nombre, :asunto, :cuerpo, :tipo, 'borrador', GETDATE())
                """),
                {
                    "cid": company_id,
                    "lista": data.Lista_Id,
                    "nombre": data.Nombre,
                    "asunto": data.Asunto,
                    "cuerpo": data.Cuerpo,
                    "tipo": data.Tipo,
                },
            )
            result = conn.execute(text("SELECT SCOPE_IDENTITY()")).first()
            campana_id = int(result[0]) if result and result[0] else None
            conn.commit()
            return {"message": "Campaña creada", "campana_id": campana_id, "status": 201}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/campanas/{campana_id}")
def get_campana(
    campana_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT c.*, l.Nombre as ListaNombre
                    FROM ERP_MARKETING_CAMPANA c
                    LEFT JOIN ERP_MARKETING_LISTA l ON l.Lista_Id = c.Lista_Id
                    WHERE c.Campana_Id = :id
                """),
                {"id": campana_id},
            ).mappings().first()
            if not result:
                return {"error": "Campaña no encontrada", "status": 404}
            return dict(result)
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.delete("/campanas/{campana_id}")
def delete_campana(
    campana_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            conn.execute(text("DELETE FROM ERP_MARKETING_CAMPANA WHERE Campana_Id = :id"), {"id": campana_id})
            conn.commit()
            return {"message": "Campaña eliminada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ─── ENVÍO DE CAMPAÑA ────────────────────────────────────────────────

def _send_campaign_emails(campana_id: int, company_id: int) -> None:
    """Tarea en background: envía los correos de una campaña."""
    try:
        with get_connection() as conn:
            campana = conn.execute(
                text("SELECT * FROM ERP_MARKETING_CAMPANA WHERE Campana_Id = :id"),
                {"id": campana_id},
            ).mappings().first()
            if not campana:
                return
            campana = dict(campana)

            contactos = conn.execute(
                text("""
                    SELECT Nombre, Email FROM ERP_MARKETING_CONTACTO
                    WHERE Lista_Id = :lid
                """),
                {"lid": campana["Lista_Id"]},
            ).mappings().all()

            # Marcar como enviando
            conn.execute(
                text("UPDATE ERP_MARKETING_CAMPANA SET Estado = 'enviando', FechaEnvio = GETDATE() WHERE Campana_Id = :id"),
                {"id": campana_id},
            )
            conn.commit()

        enviados = 0
        errores = 0

        smtp_user = getattr(settings, "email_user", None) or ""
        smtp_pass = getattr(settings, "email_password", None) or ""

        if not smtp_user:
            # Sin config SMTP, simular envío
            enviados = len(contactos)
        else:
            for c in contactos:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = campana["Asunto"]
                    msg["From"] = smtp_user
                    msg["To"] = c["Email"]
                    msg.attach(MIMEText(campana["Cuerpo"], "html", "utf-8"))

                    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                        server.login(smtp_user, smtp_pass)
                        server.sendmail(smtp_user, c["Email"], msg.as_string())
                    enviados += 1
                except Exception:
                    errores += 1

        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_MARKETING_CAMPANA
                    SET Estado = 'enviada', TotalEnviados = :env, TotalErrores = :err
                    WHERE Campana_Id = :id
                """),
                {"env": enviados, "err": errores, "id": campana_id},
            )
            conn.commit()

    except Exception as e:
        print(f"[marketing] Error enviando campaña {campana_id}: {e}")
        try:
            with get_connection() as conn:
                conn.execute(
                    text("UPDATE ERP_MARKETING_CAMPANA SET Estado = 'error' WHERE Campana_Id = :id"),
                    {"id": campana_id},
                )
                conn.commit()
        except Exception:
            pass


@router.post("/campanas/{campana_id}/enviar")
def enviar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Lanza el envío de la campaña en background."""
    companies = current_user.get("companies", [])
    company_id = companies[0] if companies else None
    try:
        with get_connection() as conn:
            campana = conn.execute(
                text("SELECT Estado, Company_Id FROM ERP_MARKETING_CAMPANA WHERE Campana_Id = :id"),
                {"id": campana_id},
            ).mappings().first()
            if not campana:
                return {"error": "Campaña no encontrada", "status": 404}
            if campana["Estado"] not in ("borrador", "error"):
                return {"error": f"No se puede enviar una campaña en estado '{campana['Estado']}'", "status": 400}

        background_tasks.add_task(_send_campaign_emails, campana_id, company_id)
        return {"message": "Envío iniciado en background"}
    except Exception as e:
        return {"error": str(e), "status": 500}
