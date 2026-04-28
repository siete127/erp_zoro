from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import require_super_admin
from app.core.security import create_access_token
from app.db.session import get_connection
from app.services import audit_service

router = APIRouter()


class EmpresaBody(BaseModel):
    NameCompany: str
    RFC: str | None = None
    LegalName: str | None = None
    Email: str | None = None
    FiscalRegime: str | None = None
    TaxZipCode: str | None = None
    Status: str = "Activo"


class AdminBody(BaseModel):
    Name: str
    Lastname: str | None = None
    Email: str
    Password: str = "DefaultPass123!"
    PhoneNumber: str | None = None


@router.get("/test")
def test_endpoint(
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Endpoint de prueba para verificar que SuperAdmin funciona"""
    return {
        "status": "ok",
        "user_id": current_user.get("id"),
        "is_super_admin": current_user.get("is_super_admin"),
        "message": "SuperAdmin endpoint funcionando correctamente"
    }


@router.get("/dashboard")
def get_dashboard(
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Estadísticas globales del sistema para el SuperAdmin."""
    total_companies = 0
    total_users = 0
    activity_today = 0
    last_activity = None
    companies = []
    usuarios_activos_30d = 0
    solicitudes_pendientes = 0
    licencias_por_vencer = 0
    ventas_mes_actual: list[dict] = []

    try:
        with get_connection() as conn:
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM ERP_COMPANY WHERE Status = 'Activo'")).first()
                total_companies = result[0] if result else 0
            except Exception as e:
                print(f"Error contando empresas: {e}")

            try:
                result = conn.execute(text("SELECT COUNT(*) FROM ERP_USERS WHERE IsActive = 1")).first()
                total_users = result[0] if result else 0
            except Exception as e:
                print(f"Error contando usuarios: {e}")

            try:
                result = conn.execute(
                    text("SELECT COUNT(*) FROM ERP_AUDIT_LOGS WHERE CONVERT(date, fecha) = CONVERT(date, GETDATE())")
                ).first()
                activity_today = result[0] if result else 0
            except Exception:
                activity_today = 0

            try:
                result = conn.execute(text("SELECT TOP 1 fecha FROM ERP_AUDIT_LOGS ORDER BY fecha DESC")).first()
                last_activity = str(result[0]) if result else None
            except Exception:
                last_activity = None

            # Usuarios activos últimos 30 días (por audit logs)
            try:
                result = conn.execute(
                    text("""
                        SELECT COUNT(DISTINCT user_id) FROM ERP_AUDIT_LOGS
                        WHERE fecha >= DATEADD(day, -30, GETDATE()) AND user_id IS NOT NULL
                    """)
                ).first()
                usuarios_activos_30d = result[0] if result else 0
            except Exception:
                usuarios_activos_30d = 0

            # Solicitudes de permisos pendientes
            try:
                result = conn.execute(
                    text("SELECT COUNT(*) FROM ERP_PERMISO_SOLICITUD WHERE Estado = 'pendiente'")
                ).first()
                solicitudes_pendientes = result[0] if result else 0
            except Exception:
                solicitudes_pendientes = 0

            # Licencias por vencer (próximos 30 días)
            try:
                result = conn.execute(
                    text("""
                        SELECT COUNT(*) FROM ERP_LICENCIAS
                        WHERE FechaVencimiento BETWEEN GETDATE() AND DATEADD(day, 30, GETDATE())
                          AND Estado = 'activa'
                    """)
                ).first()
                licencias_por_vencer = result[0] if result else 0
            except Exception:
                licencias_por_vencer = 0

            # Ventas del mes actual por empresa (para gráfico)
            try:
                result = conn.execute(
                    text("""
                        SELECT
                            c.NameCompany as name,
                            COUNT(v.Venta_Id) as total_ventas,
                            ISNULL(SUM(CAST(v.Total AS FLOAT)), 0) as monto_total
                        FROM ERP_COMPANY c
                        LEFT JOIN ERP_VENTAS v ON v.Company_Id = c.Company_Id
                            AND MONTH(v.FechaVenta) = MONTH(GETDATE())
                            AND YEAR(v.FechaVenta) = YEAR(GETDATE())
                        GROUP BY c.Company_Id, c.NameCompany
                        ORDER BY monto_total DESC
                    """)
                ).mappings().all()
                ventas_mes_actual = [dict(r) for r in result]
            except Exception as e:
                print(f"Error obteniendo ventas mes: {e}")
                ventas_mes_actual = []

            # Empresas con usuarios
            try:
                result = conn.execute(
                    text("""
                        SELECT
                            c.Company_Id as id,
                            c.NameCompany as name,
                            c.RFC as rfc,
                            c.Status as status,
                            COUNT(DISTINCT uc.User_Id) as total_users
                        FROM ERP_COMPANY c
                        LEFT JOIN ERP_USERCOMPANIES uc ON uc.Company_Id = c.Company_Id
                        GROUP BY c.Company_Id, c.NameCompany, c.RFC, c.Status
                        ORDER BY c.NameCompany
                    """)
                ).mappings().all()
                companies = [dict(row) for row in result]
            except Exception as e:
                print(f"Error obteniendo empresas: {e}")
                companies = []

    except Exception as e:
        print(f"Error crítico en dashboard: {str(e)}")

    return {
        "total_companies": total_companies,
        "total_users": total_users,
        "activity_today": activity_today,
        "last_activity": last_activity,
        "usuarios_activos_30d": usuarios_activos_30d,
        "solicitudes_pendientes": solicitudes_pendientes,
        "licencias_por_vencer": licencias_por_vencer,
        "ventas_mes_actual": ventas_mes_actual,
        "companies": companies,
    }


@router.get("/auditoria")
def get_auditoria_global(
    user_id: int | None = Query(default=None),
    company_id: int | None = Query(default=None),
    action_type: str | None = Query(default=None),
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """
    Obtiene logs globales de auditoría con filtros opcionales.
    Solo accesible para SuperAdmin.
    """
    # Usar audit_service pero sin limitaciones de empresa
    logs = audit_service.list_audit_logs(
        current_user=current_user,
        company_id=company_id,
        modulo=None,
        accion=action_type,
        user_id=user_id,
        fecha_desde=fecha_inicio,
        fecha_hasta=fecha_fin,
        limit=limit,
    )

    # Si hay búsqueda, filtrar en memoria
    if search:
        search_lower = search.lower()
        logs = [
            log for log in logs
            if search_lower in str(log.get("detalle", "")).lower()
            or search_lower in str(log.get("Name", "")).lower()
            or search_lower in str(log.get("NameCompany", "")).lower()
        ]

    return {
        "items": logs,
        "count": len(logs),
    }


# ============= CRUD EMPRESAS =============

@router.get("/empresas")
def list_empresas(
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Obtiene todas las empresas del sistema"""
    print(f"[SUPERADMIN] GET /empresas - Usuario: {current_user.get('id')}")
    try:
        with get_connection() as conn:
            print("[SUPERADMIN] Conexión a BD establecida")
            result = conn.execute(
                text("""
                    SELECT 
                        Company_Id,
                        NameCompany,
                        RFC,
                        LegalName,
                        Email,
                        FiscalRegime,
                        TaxZipCode,
                        Status
                    FROM ERP_COMPANY
                    ORDER BY NameCompany
                """)
            ).mappings().all()
            empresas = [dict(row) for row in result]
            print(f"[SUPERADMIN] Empresas obtenidas: {len(empresas)}")
            return {"items": empresas, "count": len(empresas)}
    except Exception as e:
        print(f"[SUPERADMIN] Error listando empresas: {e}")
        import traceback
        traceback.print_exc()
        return {"items": [], "count": 0, "error": str(e)}


@router.get("/empresas/{empresa_id}")
def get_empresa(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Obtiene detalles de una empresa específica"""
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT 
                        Company_Id,
                        NameCompany,
                        RFC,
                        LegalName,
                        Email,
                        FiscalRegime,
                        TaxZipCode,
                        Status
                    FROM ERP_COMPANY
                    WHERE Company_Id = :id
                """),
                {"id": empresa_id}
            ).mappings().first()
            
            if not result:
                return {"error": "Empresa no encontrada", "status": 404}
            
            return dict(result)
    except Exception as e:
        print(f"Error obteniendo empresa: {e}")
        return {"error": str(e), "status": 500}


@router.post("/empresas")
def create_empresa(
    data: EmpresaBody,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Crea una nueva empresa"""
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_COMPANY
                    (NameCompany, RFC, LegalName, Email, FiscalRegime, TaxZipCode, Status)
                    VALUES (:name, :rfc, :legal_name, :email, :fiscal_regime, :tax_zip_code, :status)
                """),
                {
                    "name": data.NameCompany,
                    "rfc": data.RFC,
                    "legal_name": data.LegalName,
                    "email": data.Email,
                    "fiscal_regime": data.FiscalRegime,
                    "tax_zip_code": data.TaxZipCode,
                    "status": data.Status or "Activo",
                }
            )
            conn.commit()
            return {"message": "Empresa creada exitosamente", "status": 201}
    except Exception as e:
        print(f"Error creando empresa: {e}")
        return {"error": str(e), "status": 500}


@router.put("/empresas/{empresa_id}")
def update_empresa(
    empresa_id: int,
    data: EmpresaBody,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Actualiza una empresa"""
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_COMPANY
                    SET NameCompany = :name,
                        RFC = :rfc,
                        LegalName = :legal_name,
                        Email = :email,
                        FiscalRegime = :fiscal_regime,
                        TaxZipCode = :tax_zip_code,
                        Status = :status
                    WHERE Company_Id = :id
                """),
                {
                    "id": empresa_id,
                    "name": data.NameCompany,
                    "rfc": data.RFC,
                    "legal_name": data.LegalName,
                    "email": data.Email,
                    "fiscal_regime": data.FiscalRegime,
                    "tax_zip_code": data.TaxZipCode,
                    "status": data.Status,
                }
            )
            conn.commit()
            return {"message": "Empresa actualizada exitosamente"}
    except Exception as e:
        print(f"Error actualizando empresa: {e}")
        return {"error": str(e), "status": 500}


@router.delete("/empresas/{empresa_id}")
def delete_empresa(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Desactiva una empresa (soft delete)"""
    try:
        with get_connection() as conn:
            conn.execute(
                text("UPDATE ERP_COMPANY SET Status = :status WHERE Company_Id = :id"),
                {"id": empresa_id, "status": "Inactivo"}
            )
            conn.commit()
            return {"message": "Empresa desactivada exitosamente"}
    except Exception as e:
        print(f"Error desactivando empresa: {e}")
        return {"error": str(e), "status": 500}


# ============= CRUD ADMINISTRADORES POR EMPRESA =============

@router.get("/empresas/{empresa_id}/admins")
def list_empresa_admins(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Lista administradores de una empresa"""
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT 
                        u.User_Id as id,
                        u.Name as name,
                        u.Email as email,
                        u.PhoneNumber as phone,
                        u.RolId as rol_id,
                        r.RolName as rol_name,
                        u.IsActive as is_active
                    FROM ERP_USERS u
                    JOIN ERP_ROL r ON u.RolId = r.RolId
                    JOIN ERP_USERCOMPANIES uc ON u.User_Id = uc.User_Id
                    WHERE uc.Company_Id = :empresa_id AND u.RolId = 2
                """),
                {"empresa_id": empresa_id}
            ).mappings().all()
            
            admins = [dict(row) for row in result]
            return {"items": admins, "count": len(admins)}
    except Exception as e:
        print(f"Error listando administradores: {e}")
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/empresas/{empresa_id}/admins")
def create_empresa_admin(
    empresa_id: int,
    data: AdminBody,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Crea un administrador para una empresa"""
    import bcrypt

    try:
        with get_connection() as conn:
            result = conn.execute(
                text("SELECT Company_Id FROM ERP_COMPANY WHERE Company_Id = :id"),
                {"id": empresa_id}
            ).first()
            if not result:
                return {"error": "Empresa no encontrada", "status": 404}

        hashed_pwd = bcrypt.hashpw(data.Password.encode('utf-8'), bcrypt.gensalt(rounds=10)).decode('utf-8')

        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_USERS
                    (Name, Lastname, Email, Password, PhoneNumber, RolId, IsActive, IsSystem)
                    VALUES (:name, :lastname, :email, :password, :phone, 2, 1, 0)
                """),
                {
                    "name": data.Name,
                    "lastname": data.Lastname or "",
                    "email": data.Email,
                    "password": hashed_pwd,
                    "phone": data.PhoneNumber or "",
                }
            )

            result = conn.execute(
                text("SELECT TOP 1 User_Id FROM ERP_USERS WHERE Email = :email ORDER BY User_Id DESC"),
                {"email": data.Email}
            ).first()
            user_id = result[0] if result else None

            if user_id:
                conn.execute(
                    text("INSERT INTO ERP_USERCOMPANIES (User_Id, Company_Id) VALUES (:uid, :cid)"),
                    {"uid": user_id, "cid": empresa_id}
                )

            conn.commit()
            return {"message": "Administrador creado exitosamente", "user_id": user_id, "status": 201}

    except Exception as e:
        print(f"Error creando administrador: {e}")
        return {"error": str(e), "status": 500}


@router.delete("/empresas/{empresa_id}/admins/{admin_id}")
def delete_empresa_admin(
    empresa_id: int,
    admin_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Desactiva un administrador de empresa"""
    try:
        with get_connection() as conn:
            # Desactivar usuario
            conn.execute(
                text("UPDATE ERP_USERS SET IsActive = 0 WHERE User_Id = :user_id"),
                {"user_id": admin_id}
            )

            # Eliminar relación empresa-usuario
            conn.execute(
                text("""
                    DELETE FROM ERP_USERCOMPANIES
                    WHERE User_Id = :user_id AND Company_Id = :empresa_id
                """),
                {"user_id": admin_id, "empresa_id": empresa_id}
            )

            conn.commit()
            return {"message": "Administrador eliminado exitosamente"}
    except Exception as e:
        print(f"Error eliminando administrador: {e}")
        return {"error": str(e), "status": 500}


# ============= SOLICITUDES DE PERMISOS =============

class SolicitudPermisosBody(BaseModel):
    NombreEmpresa: str
    NombreSolicitante: str
    Email: str
    Telefono: str | None = None
    Descripcion: str | None = None


@router.get("/solicitudes-permisos")
def list_solicitudes_permisos(
    estado: str | None = Query(default=None),
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Lista todas las solicitudes de acceso al sistema"""
    try:
        with get_connection() as conn:
            where = "WHERE 1=1"
            params: dict[str, Any] = {}
            if estado:
                where += " AND Estado = :estado"
                params["estado"] = estado
            result = conn.execute(
                text(f"""
                    SELECT Solicitud_Id, NombreEmpresa, NombreSolicitante, Email,
                           Telefono, Descripcion, Estado, FechaSolicitud, FechaResolucion, Notas
                    FROM ERP_PERMISO_SOLICITUD
                    {where}
                    ORDER BY FechaSolicitud DESC
                """),
                params
            ).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        print(f"Error listando solicitudes: {e}")
        return {"items": [], "count": 0, "error": str(e)}


@router.post("/solicitudes-permisos")
def create_solicitud_permisos(
    data: SolicitudPermisosBody,
) -> dict[str, Any]:
    """Crea una nueva solicitud de acceso (pública, sin auth)"""
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    INSERT INTO ERP_PERMISO_SOLICITUD
                    (NombreEmpresa, NombreSolicitante, Email, Telefono, Descripcion, Estado, FechaSolicitud)
                    VALUES (:nombre_empresa, :nombre_solicitante, :email, :telefono, :descripcion, 'pendiente', GETDATE())
                """),
                {
                    "nombre_empresa": data.NombreEmpresa,
                    "nombre_solicitante": data.NombreSolicitante,
                    "email": data.Email,
                    "telefono": data.Telefono or "",
                    "descripcion": data.Descripcion or "",
                }
            )
            conn.commit()
            return {"message": "Solicitud enviada exitosamente", "status": 201}
    except Exception as e:
        print(f"Error creando solicitud: {e}")
        return {"error": str(e), "status": 500}


class ResolucionBody(BaseModel):
    accion: str  # "aprobar" | "rechazar"
    Notas: str | None = None


@router.patch("/solicitudes-permisos/{solicitud_id}")
def resolver_solicitud_permisos(
    solicitud_id: int,
    data: ResolucionBody,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Aprueba o rechaza una solicitud de acceso"""
    if data.accion not in ("aprobar", "rechazar"):
        return {"error": "accion debe ser 'aprobar' o 'rechazar'", "status": 400}
    nuevo_estado = "aprobada" if data.accion == "aprobar" else "rechazada"
    try:
        with get_connection() as conn:
            conn.execute(
                text("""
                    UPDATE ERP_PERMISO_SOLICITUD
                    SET Estado = :estado, FechaResolucion = GETDATE(), Notas = :notas
                    WHERE Solicitud_Id = :id
                """),
                {"estado": nuevo_estado, "notas": data.Notas or "", "id": solicitud_id}
            )
            conn.commit()
            return {"message": f"Solicitud {nuevo_estado} exitosamente"}
    except Exception as e:
        print(f"Error resolviendo solicitud: {e}")
        return {"error": str(e), "status": 500}


@router.get("/empresas/{empresa_id}/stats")
def get_empresa_stats(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """KPIs de una empresa específica para el superadmin"""
    try:
        with get_connection() as conn:
            ventas = conn.execute(text("""
                SELECT COUNT(*) AS total_ventas,
                       ISNULL(SUM(CAST(Total AS FLOAT)), 0) AS monto_ventas
                FROM ERP_VENTAS
                WHERE Company_Id = :cid
                  AND MONTH(FechaVenta) = MONTH(GETDATE())
                  AND YEAR(FechaVenta) = YEAR(GETDATE())
            """), {"cid": empresa_id}).mappings().first()

            compras = conn.execute(text("""
                SELECT COUNT(*) AS total_compras,
                       ISNULL(SUM(CAST(Total AS FLOAT)), 0) AS monto_compras
                FROM ERP_COMPRA_ORDEN
                WHERE Company_Id = :cid
                  AND MONTH(FechaOC) = MONTH(GETDATE())
                  AND YEAR(FechaOC) = YEAR(GETDATE())
            """), {"cid": empresa_id}).mappings().first()

            usuarios = conn.execute(text("""
                SELECT COUNT(DISTINCT uc.User_Id) AS total_usuarios,
                       SUM(CASE WHEN u.IsActive = 1 THEN 1 ELSE 0 END) AS usuarios_activos
                FROM ERP_USERCOMPANIES uc
                JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                WHERE uc.Company_Id = :cid
            """), {"cid": empresa_id}).mappings().first()

            facturas_pendientes = 0
            try:
                fp = conn.execute(text("""
                    SELECT COUNT(*) AS pendientes
                    FROM ERP_FACTURAS
                    WHERE Company_Id = :cid AND Estado IN ('pendiente', 'por_timbrar')
                """), {"cid": empresa_id}).mappings().first()
                facturas_pendientes = fp["pendientes"] if fp else 0
            except Exception:
                pass

            empresa = conn.execute(text("""
                SELECT NameCompany, RFC, Status, Email
                FROM ERP_COMPANY WHERE Company_Id = :cid
            """), {"cid": empresa_id}).mappings().first()

        return {
            "empresa": dict(empresa) if empresa else {},
            "ventas_mes": dict(ventas) if ventas else {},
            "compras_mes": dict(compras) if compras else {},
            "usuarios": dict(usuarios) if usuarios else {},
            "facturas_pendientes": facturas_pendientes,
        }
    except Exception as e:
        print(f"Error obteniendo stats empresa: {e}")
        return {"error": str(e)}


@router.get("/empresas/{empresa_id}/usuarios")
def get_empresa_usuarios(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Lista todos los usuarios de una empresa"""
    try:
        with get_connection() as conn:
            result = conn.execute(text("""
                SELECT
                    u.User_Id AS id,
                    u.Name AS name,
                    u.Lastname AS lastname,
                    u.Email AS email,
                    u.PhoneNumber AS phone,
                    u.IsActive AS is_active,
                    r.RolName AS rol_name,
                    u.RolId AS rol_id
                FROM ERP_USERCOMPANIES uc
                JOIN ERP_USERS u ON u.User_Id = uc.User_Id
                JOIN ERP_ROL r ON r.RolId = u.RolId
                WHERE uc.Company_Id = :cid
                ORDER BY u.RolId, u.Name
            """), {"cid": empresa_id}).mappings().all()
            items = [dict(r) for r in result]
            return {"items": items, "count": len(items)}
    except Exception as e:
        print(f"Error obteniendo usuarios empresa: {e}")
        return {"items": [], "count": 0, "error": str(e)}


@router.get("/empresas/{empresa_id}/auditoria")
def get_empresa_auditoria(
    empresa_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Log de auditoría filtrado por empresa"""
    logs = audit_service.list_audit_logs(
        current_user=current_user,
        company_id=empresa_id,
        modulo=None,
        accion=None,
        user_id=None,
        fecha_desde=None,
        fecha_hasta=None,
        limit=limit,
    )
    return {"items": logs, "count": len(logs)}


@router.post("/empresas/{empresa_id}/impersonate")
def impersonate_empresa(
    empresa_id: int,
    current_user: dict[str, Any] = Depends(require_super_admin),
) -> dict[str, Any]:
    """Genera un token temporal de admin para una empresa específica"""
    try:
        with get_connection() as conn:
            result = conn.execute(
                text("SELECT Company_Id, NameCompany FROM ERP_COMPANY WHERE Company_Id = :id"),
                {"id": empresa_id}
            ).mappings().first()
            if not result:
                return {"error": "Empresa no encontrada", "status": 404}
            empresa = dict(result)

        user_id = current_user.get("User_Id") or current_user.get("id")
        token_data = {
            "sub": str(user_id),
            "id": user_id,
            "email": current_user.get("Email") or current_user.get("email"),
            "name": current_user.get("Name") or current_user.get("name", "SuperAdmin"),
            "rol": 2,
            "companies": [empresa_id],
            "is_admin": True,
            "is_super_admin": False,
            "_impersonating": empresa_id,
        }
        temp_token = create_access_token(token_data, expires_delta=timedelta(hours=8))
        return {
            "token": temp_token,
            "empresa_id": empresa_id,
            "empresa_name": empresa["NameCompany"],
        }
    except Exception as e:
        print(f"Error impersonando empresa: {e}")
        return {"error": str(e), "status": 500}
