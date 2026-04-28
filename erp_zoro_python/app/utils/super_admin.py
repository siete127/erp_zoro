"""
Utilidades y validaciones para SuperAdmin Management
Sesión 1: Middleware SuperAdmin y validaciones Company Admin
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status


def require_super_admin(current_user: dict[str, Any]) -> dict[str, Any]:
    """
    Valida que el usuario sea SuperAdmin (is_super_admin=true en JWT).
    
    Args:
        current_user: Dict con info del usuario autenticado
        
    Returns:
        El mismo current_user si es SuperAdmin
        
    Raises:
        HTTPException(403): Si no es SuperAdmin
    """
    if not current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol de Super Administrador.",
        )
    return current_user


def is_company_admin(user_id: int, company_id: int, session) -> bool:
    """
    Valida si un usuario es admin de una empresa específica.
    
    Args:
        user_id: ID del usuario
        company_id: ID de la empresa
        session: Session de SQLAlchemy para queries
        
    Returns:
        True si el usuario es admin de esa empresa, False en caso contrario
    """
    try:
        from app.models.company_admin import CompanyAdmin
        
        admin = session.query(CompanyAdmin).filter(
            CompanyAdmin.user_id == user_id,
            CompanyAdmin.company_id == company_id,
            CompanyAdmin.is_active == 1,
        ).first()
        
        return admin is not None
    except Exception:
        # Si la tabla no existe aún (primera ejecución), retornar False
        return False


def validate_company_admin_access(
    current_user: dict[str, Any],
    company_id: int,
    session,
) -> None:
    """
    Valida que el usuario tenga acceso como Company Admin a una empresa.
    
    SuperAdmin siempre tiene acceso.
    Company Admin solo tiene acceso a su empresa asignada.
    
    Args:
        current_user: Dict con info del usuario
        company_id: ID de empresa a validar
        session: Session de SQLAlchemy
        
    Raises:
        HTTPException(403): Si no tiene acceso
    """
    # SuperAdmin puede hacer todo
    if current_user.get("is_super_admin"):
        return
    
    # Para otros usuarios, validar que sea admin de esa empresa
    if not is_company_admin(current_user.get("id"), company_id, session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a esta empresa.",
        )


def get_user_company_ids(current_user: dict[str, Any]) -> list[int]:
    """
    Extrae lista de company_ids del usuario desde el JWT.
    
    Args:
        current_user: Dict con info del usuario
        
    Returns:
        Lista de IDs de empresas a las que el usuario tiene acceso
    """
    companies = current_user.get("companies", [])
    if not companies:
        return []
    
    if isinstance(companies, (int, str)):
        return [int(companies)]
    
    if isinstance(companies, list):
        return [int(c) for c in companies if str(c).isdigit()]
    
    return []


# Aliases para compatibilidad con nombres existentes
assert_super_admin = require_super_admin
