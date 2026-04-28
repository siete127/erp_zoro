from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import get_current_user
from app.db.session import get_connection

router = APIRouter()


class WebsiteConfigBody(BaseModel):
    TituloPagina: str | None = None
    Descripcion: str | None = None
    ColorPrimario: str | None = None
    MostrarPrecios: bool = False
    Activo: bool = True


class ContactoBody(BaseModel):
    Nombre: str
    Email: str
    Telefono: str | None = None
    Empresa: str | None = None
    Mensaje: str | None = None
    Origen: str = "website"


def _slug_from_name(name: str) -> str:
    import re
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    return slug[:80]


# ——— Endpoints PÚBLICOS (sin auth) ———

@router.get("/public/{slug}")
def get_catalogo_publico(slug: str) -> dict[str, Any]:
    """Catálogo público de productos de una empresa identificada por su slug"""
    try:
        with get_connection() as conn:
            config = conn.execute(
                text("""
                    SELECT wc.Config_Id, wc.Company_Id, wc.Slug, wc.Activo,
                           wc.TituloPagina, wc.Descripcion, wc.ColorPrimario,
                           wc.MostrarPrecios, wc.LogoUrl,
                           c.NameCompany, c.LegalName, c.Email as ContactoEmail
                    FROM ERP_WEBSITE_CONFIG wc
                    JOIN ERP_COMPANY c ON wc.Company_Id = c.Company_Id
                    WHERE wc.Slug = :slug AND wc.Activo = 1
                """),
                {"slug": slug}
            ).mappings().first()

            if not config:
                return {"error": "Empresa no encontrada o no tiene sitio activo", "status": 404}

            config_dict = dict(config)
            company_id = config_dict["Company_Id"]

            productos = conn.execute(
                text("""
                    SELECT p.Producto_Id, p.Nombre, p.Descripcion, p.Codigo,
                           p.PrecioVenta,
                           pi.ImageUrl as ImagenPrincipal
                    FROM ERP_PRODUCTS p
                    LEFT JOIN (
                        SELECT Producto_Id, ImageUrl
                        FROM ERP_PRODUCT_IMAGES
                        WHERE EsPrincipal = 1
                    ) pi ON pi.Producto_Id = p.Producto_Id
                    WHERE p.Company_Id = :company_id AND p.IsActive = 1
                    ORDER BY p.Nombre
                """),
                {"company_id": company_id}
            ).mappings().all()

            productos_list = []
            for p in productos:
                item = dict(p)
                if not config_dict.get("MostrarPrecios"):
                    item.pop("PrecioVenta", None)
                productos_list.append(item)

            return {
                "empresa": {
                    "nombre": config_dict["NameCompany"],
                    "titulo": config_dict["TituloPagina"] or config_dict["NameCompany"],
                    "descripcion": config_dict["Descripcion"],
                    "colorPrimario": config_dict["ColorPrimario"] or "#092052",
                    "logo": config_dict["LogoUrl"],
                    "email": config_dict["ContactoEmail"],
                },
                "productos": productos_list,
                "total": len(productos_list),
            }
    except Exception as e:
        print(f"Error en catálogo público: {e}")
        return {"error": str(e), "status": 500}


@router.post("/public/{slug}/contacto")
def enviar_contacto(slug: str, data: ContactoBody) -> dict[str, Any]:
    """Formulario de contacto — genera lead en ERP_WEBSITE_LEAD y en CRM si está disponible"""
    try:
        with get_connection() as conn:
            config = conn.execute(
                text("SELECT Company_Id FROM ERP_WEBSITE_CONFIG WHERE Slug = :slug AND Activo = 1"),
                {"slug": slug}
            ).mappings().first()

            if not config:
                return {"error": "Empresa no encontrada", "status": 404}

            company_id = config["Company_Id"]

            conn.execute(
                text("""
                    INSERT INTO ERP_WEBSITE_LEAD
                    (Company_Id, Nombre, Email, Telefono, Empresa, Mensaje, Origen, Estado, FechaCreacion)
                    VALUES (:company_id, :nombre, :email, :telefono, :empresa, :mensaje, :origen, 'nuevo', GETDATE())
                """),
                {
                    "company_id": company_id,
                    "nombre": data.Nombre,
                    "email": data.Email,
                    "telefono": data.Telefono or "",
                    "empresa": data.Empresa or "",
                    "mensaje": data.Mensaje or "",
                    "origen": data.Origen,
                }
            )

            # Intentar crear lead en CRM automáticamente
            try:
                conn.execute(
                    text("""
                        INSERT INTO ERP_CRM_LEADS
                        (Company_Id, NombreLead, Email, Telefono, Empresa, Fuente, Estado, FechaCreacion)
                        VALUES (:company_id, :nombre, :email, :telefono, :empresa, 'website', 'nuevo', GETDATE())
                    """),
                    {
                        "company_id": company_id,
                        "nombre": data.Nombre,
                        "email": data.Email,
                        "telefono": data.Telefono or "",
                        "empresa": data.Empresa or "",
                    }
                )
            except Exception:
                pass  # Si CRM no tiene la tabla exacta, no bloqueamos

            conn.commit()
            return {"message": "Mensaje enviado. Nos pondremos en contacto pronto.", "status": 201}
    except Exception as e:
        print(f"Error enviando contacto: {e}")
        return {"error": str(e), "status": 500}


# ——— Endpoints PRIVADOS (requieren auth) ———

@router.get("/config")
def get_website_config(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Obtiene la configuración del website de la empresa del usuario"""
    user_companies = current_user.get("companies", [])
    company_id = user_companies[0] if user_companies else None
    if not company_id:
        return {"error": "Sin empresa", "status": 400}

    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT wc.*, c.NameCompany
                    FROM ERP_WEBSITE_CONFIG wc
                    JOIN ERP_COMPANY c ON wc.Company_Id = c.Company_Id
                    WHERE wc.Company_Id = :company_id
                """),
                {"company_id": company_id}
            ).mappings().first()

            if not result:
                # Crear config default
                company = conn.execute(
                    text("SELECT NameCompany FROM ERP_COMPANY WHERE Company_Id = :id"),
                    {"id": company_id}
                ).mappings().first()
                company_name = company["NameCompany"] if company else "empresa"
                slug = _slug_from_name(company_name)

                conn.execute(
                    text("""
                        INSERT INTO ERP_WEBSITE_CONFIG (Company_Id, Slug, Activo, FechaCreacion)
                        VALUES (:company_id, :slug, 0, GETDATE())
                    """),
                    {"company_id": company_id, "slug": slug}
                )
                conn.commit()

                return {
                    "Company_Id": company_id,
                    "Slug": slug,
                    "Activo": False,
                    "TituloPagina": None,
                    "Descripcion": None,
                    "ColorPrimario": "#092052",
                    "MostrarPrecios": False,
                    "LogoUrl": None,
                }

            return dict(result)
    except Exception as e:
        print(f"Error obteniendo config website: {e}")
        return {"error": str(e), "status": 500}


@router.put("/config")
def update_website_config(
    data: WebsiteConfigBody,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Actualiza la configuración del website"""
    user_companies = current_user.get("companies", [])
    company_id = user_companies[0] if user_companies else None
    if not company_id:
        return {"error": "Sin empresa", "status": 400}

    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_WEBSITE_CONFIG
                    SET TituloPagina = :titulo,
                        Descripcion = :descripcion,
                        ColorPrimario = :color,
                        MostrarPrecios = :mostrar_precios,
                        Activo = :activo
                    WHERE Company_Id = :company_id
                """),
                {
                    "titulo": data.TituloPagina or "",
                    "descripcion": data.Descripcion or "",
                    "color": data.ColorPrimario or "#092052",
                    "mostrar_precios": 1 if data.MostrarPrecios else 0,
                    "activo": 1 if data.Activo else 0,
                    "company_id": company_id,
                }
            )
            conn.commit()
            return {"message": "Configuración actualizada"}
    except Exception as e:
        return {"error": str(e), "status": 500}


@router.get("/leads")
def list_website_leads(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Lista los leads generados desde el website"""
    user_companies = current_user.get("companies", [])
    company_id = user_companies[0] if user_companies else None
    if not company_id:
        return {"items": [], "count": 0}

    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT Lead_Id, Nombre, Email, Telefono, Empresa,
                           Mensaje, Origen, Estado, FechaCreacion
                    FROM ERP_WEBSITE_LEAD
                    WHERE Company_Id = :company_id
                    ORDER BY FechaCreacion DESC
                """),
                {"company_id": company_id}
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        return {"items": [], "count": 0, "error": str(e)}
