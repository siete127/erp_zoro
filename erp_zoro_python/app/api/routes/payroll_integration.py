"""
Endpoints de integración entre Vacaciones y Nómina
Endpoints REST para sincronizar vacaciones aprobadas con el sistema de pago

Rutas base: /api/rh/payroll
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_current_user
from app.services import payroll_leave_service as svc
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class SyncLeaveRequest(BaseModel):
    """Request para sincronizar una vacación a nómina"""
    mapping_id: int
    nomina_linea_id: int


class MappingResponse(BaseModel):
    """Response de mapeo de vacación a nómina"""
    mapping_id: int
    vacaciones_id: int
    concepto_id: Optional[int]
    importe: float
    status: str
    dias: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/payroll/create-mapping", status_code=201)
def create_leave_mapping(
    vacaciones_id: int = Query(..., description="ID de la solicitud de vacaciones"),
    current_user: dict = Depends(get_current_user),
):
    """
    Crear un mapeo de nómina cuando se aprueba una vacación.
    
    Solo los admins pueden ejecutar esta operación.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones aprobada
    
    Returns:
        dict: Información del mapeo creado
    """
    # Verificar permisos
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para crear mapeos de nómina"
        )
    
    return svc.create_payroll_mapping(vacaciones_id, current_user.get("User_Id"))


@router.post("/payroll/sync-to-payroll", status_code=200)
def sync_leave_to_payroll(
    request: SyncLeaveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Sincronizar un mapeo de vacación a una línea de nómina específica.
    
    Solo los admins de nómina pueden ejecutar esta operación.
    
    Args:
        request: Contains mapping_id and nomina_linea_id
    
    Returns:
        dict: Resultado de la sincronización
    """
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para sincronizar a nómina"
        )
    
    return svc.sync_leave_to_payroll(request.mapping_id, request.nomina_linea_id)


@router.get("/payroll/pending-mappings")
def get_pending_mappings(
    limit: int = Query(50, ge=1, le=500, description="Número máximo de resultados"),
    current_user: dict = Depends(get_current_user),
):
    """
    Obtener mapeos pendientes de sincronización a nómina.
    
    Solo admins pueden ver esta información.
    
    Args:
        limit: Número máximo de registros
    
    Returns:
        list: Mapeos pendientes
    """
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver mapeos pendientes"
        )
    
    return svc.get_pending_leave_mappings(limit)


@router.get("/payroll/vacation-mapping/{vacaciones_id}")
def get_vacation_mapping(
    vacaciones_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Obtener mapeos de nómina para una vacación específica.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones
    
    Returns:
        dict: Información del mapeo
    """
    mapping = svc.get_leave_mappings_by_vacation(vacaciones_id)
    
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="No se encontró mapeo de nómina para esta vacación"
        )
    
    return mapping


@router.post("/payroll/cancel-mapping/{vacaciones_id}")
def cancel_vacation_mapping(
    vacaciones_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancelar el mapeo de nómina cuando se rechaza una vacación.
    
    Solo admins pueden ejecutar esta operación.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones
    
    Returns:
        dict: Resultado de la cancelación
    """
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para cancelar mapeos"
        )
    
    return svc.cancel_leave_mapping(vacaciones_id)


@router.get("/payroll/concepts")
def get_payroll_concepts(
    current_user: dict = Depends(get_current_user),
):
    """
    Obtener lista de conceptos de nómina disponibles para vacaciones.
    
    Args:
        None
    
    Returns:
        list: Conceptos de nómina
    """
    from app.db.session import get_connection
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            cursor.execute("""
                SELECT 
                    Concepto_Id,
                    Clave,
                    Descripcion,
                    Tipo,
                    EsGravado,
                    EsExento
                FROM ERP_NOI_CONCEPTOS
                WHERE Tipo IN ('PERCEPCION', 'DEDUCCION')
                ORDER BY Tipo, Descripcion
            """)
            
            concepts = []
            for row in cursor.fetchall():
                concepto_id, clave, descripcion, tipo, es_gravado, es_exento = row
                concepts.append({
                    'concepto_id': concepto_id,
                    'clave': clave,
                    'descripcion': descripcion,
                    'tipo': tipo,
                    'es_gravado': bool(es_gravado),
                    'es_exento': bool(es_exento)
                })
            
            return concepts
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo conceptos: {str(e)}"
        )


@router.get("/payroll/employee-salary/{user_id}")
def get_employee_salary(
    user_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Obtener información salarial de un empleado para cálculos.
    
    Args:
        user_id: ID del usuario/empleado
    
    Returns:
        dict: Información salarial
    """
    from app.db.session import get_connection
    
    # Verificar que no sea información privada (solo admin, super, o del mismo usuario)
    current_user_id = current_user.get("User_Id")
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if user_id != current_user_id and not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver información de otros empleados"
        )
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            cursor.execute("""
                SELECT 
                    Empleado_Id,
                    RFC,
                    CURP,
                    FechaIngreso,
                    SalarioBase,
                    Banco,
                    CuentaBancaria
                FROM ERP_NOI_EMPLEADOS
                WHERE User_Id = ? OR Empleado_Id = ?
                ORDER BY Empleado_Id DESC
            """, (user_id, user_id))
            
            result = cursor.fetchone()
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Información salarial no encontrada para este empleado"
                )
            
            (empleado_id, rfc, curp, fecha_ingreso, 
             salario_base, banco, cuenta) = result
            
            return {
                'empleado_id': empleado_id,
                'rfc': rfc,
                'curp': curp,
                'fecha_ingreso': fecha_ingreso.isoformat() if fecha_ingreso else None,
                'salario_base': float(salario_base) if salario_base else 0,
                'banco': banco,
                'cuenta_bancaria': cuenta
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo información salarial: {str(e)}"
        )


@router.post("/payroll/auto-sync", status_code=200)
def auto_sync_to_payroll(
    current_user: dict = Depends(get_current_user),
):
    """
    Sincroniza automáticamente todos los mapeos pendientes a la nómina abierta más reciente.
    No requiere seleccionar nómina_linea_id manualmente.
    """
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    if not is_admin and not is_super:
        raise HTTPException(status_code=403, detail="No tiene permisos para auto-sincronizar")
    return svc.auto_sync_pending_to_open_payroll()


@router.get("/payroll/all-mappings")
def get_all_mappings(
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """Obtiene historial completo de mapeos (todos los estados)."""
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    if not is_admin and not is_super:
        raise HTTPException(status_code=403, detail="No tiene permisos")
    return svc.get_all_leave_mappings(limit)


# Statistics and reporting endpoints

@router.get("/payroll/stats/pending")
def get_mapping_statistics(
    current_user: dict = Depends(get_current_user),
):
    """
    Obtener estadísticas de mapeos pendientes de sincronización.
    
    Returns:
        dict: Estadísticas de mapeos
    """
    is_admin = current_user.get("isAdmin", False)
    is_super = current_user.get("isSuperAdmin", False)
    
    if not is_admin and not is_super:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver estadísticas"
        )
    
    from app.db.session import get_connection
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Estadísticas por estado
            cursor.execute("""
                SELECT 
                    EstadoSincronizacion,
                    COUNT(*) as cantidad,
                    SUM(ISNULL(Importe, 0)) as total_importe
                FROM ERP_PAYROLL_LEAVE_MAPPING
                GROUP BY EstadoSincronizacion
            """)
            
            stats = {}
            for row in cursor.fetchall():
                estado, cantidad, total = row
                stats[estado] = {
                    'cantidad': cantidad,
                    'importe_total': float(total) if total else 0
                }
            
            # Total general
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(ISNULL(Importe, 0)) as importe_total
                FROM ERP_PAYROLL_LEAVE_MAPPING
            """)
            
            total_result = cursor.fetchone()
            
            return {
                'por_estado': stats,
                'total': {
                    'cantidad': total_result[0],
                    'importe_total': float(total_result[1]) if total_result[1] else 0
                }
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculando estadísticas: {str(e)}"
        )
