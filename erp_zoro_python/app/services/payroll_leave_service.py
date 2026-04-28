"""
Payroll Leave Integration Service
Maneja la sincronización de vacaciones aprobadas a entradas de nómina

Funciones principales:
- Sincronizar vacación a nómina cuando es aprobada
- Calcular importe de vacación (días × salario diario)
- Manejar cambios de estado (aprobar, rechazar)
- Reporte de sincronizaciones
"""

from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import text
from app.db.session import get_connection
from fastapi import HTTPException


def get_or_create_leave_concept():
    """
    Obtener o crear el concepto de VACACIONES en la nómina.
    
    Returns:
        int: ID del concepto de vacaciones
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Buscar concepto existente
            cursor.execute("""
                SELECT TOP 1 Concepto_Id 
                FROM ERP_NOI_CONCEPTOS 
                WHERE Clave = 'VAC' OR Descripcion LIKE '%VACACION%'
                ORDER BY Concepto_Id
            """)
            
            result = cursor.fetchone()
            if result:
                return result[0]
            
            # Si no existe, crear uno
            cursor.execute("""
                INSERT INTO ERP_NOI_CONCEPTOS 
                (Tipo, Clave, Descripcion, EsGravado, EsExento)
                VALUES ('PERCEPCION', 'VAC', 'Pago de Vacaciones', 1, 0)
            """)
            conn.commit()
            
            # Obtener el ID generado
            cursor.execute("SELECT @@IDENTITY")
            concepto_id = cursor.fetchone()[0]
            
            return concepto_id
            
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error obteniendo concepto de vacaciones: {str(e)}"
        )


def calculate_leave_amount(user_id: int, days: int) -> Decimal:
    """
    Calcular el importe de las vacaciones basado en salario diario.
    
    Args:
        user_id: ID del usuario/empleado
        days: Número de días de vacación
    
    Returns:
        Decimal: Importe total de las vacaciones
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Buscar empleado y obtener salario base
            cursor.execute("""
                SELECT TOP 1 SalarioBase
                FROM ERP_NOI_EMPLEADOS
                WHERE User_Id = ? OR Empleado_Id = ?
                ORDER BY Empleado_Id DESC
            """, (user_id, user_id))
            
            result = cursor.fetchone()
            if not result or not result[0]:
                # Si no hay salario registrado, devolver 0
                return Decimal('0.00')
            
            salary_base = Decimal(str(result[0]))
            
            # Calcular salario diario (asumiendo 20 días laborales por mes, 240 días por año)
            daily_salary = salary_base / Decimal('20')  # Salario diario aproximado
            
            # Total de vacaciones
            leave_amount = daily_salary * Decimal(str(days))
            
            return leave_amount.quantize(Decimal('0.01'))
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculando importe de vacaciones: {str(e)}"
        )


def create_payroll_mapping(vacaciones_id: int, user_id: int) -> dict:
    """
    Crear un registro de mapeo cuando se aprueba una vacación.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones
        user_id: ID del usuario que solicita
    
    Returns:
        dict: Información del mapeo creado
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Obtener detalles de la vacación
            cursor.execute("""
                SELECT 
                    FechaInicio, 
                    FechaFin, 
                    Cantidad,
                    Estatus,
                    User_Id
                FROM ERP_HR_VACATION_REQUEST
                WHERE Vacaciones_Id = ?
            """, (vacaciones_id,))
            
            vac_result = cursor.fetchone()
            if not vac_result:
                raise HTTPException(
                    status_code=404,
                    detail="Solicitud de vacaciones no encontrada"
                )
            
            fecha_inicio, fecha_fin, cantidad, estatus, vac_user_id = vac_result
            
            # Si no está aprobada, no crear mapeo
            if estatus != 'Aprobado':
                raise HTTPException(
                    status_code=400,
                    detail=f"La vacación debe estar aprobada. Estado actual: {estatus}"
                )
            
            # Verificar si ya existe un mapeo
            cursor.execute("""
                SELECT Mapping_Id, EstadoSincronizacion
                FROM ERP_PAYROLL_LEAVE_MAPPING
                WHERE VacacionesId = ?
            """, (vacaciones_id,))
            
            existing = cursor.fetchone()
            if existing:
                return {
                    'mapping_id': existing[0],
                    'status': existing[1],
                    'message': 'El mapeo ya existe'
                }
            
            # Obtener o crear concepto de vacaciones
            concepto_id = get_or_create_leave_concept()
            
            # Calcular importe
            importe = calculate_leave_amount(vac_user_id, int(cantidad))
            
            # Crear mapeo
            cursor.execute("""
                INSERT INTO ERP_PAYROLL_LEAVE_MAPPING
                (VacacionesId, ConceptoId, Importe, EstadoSincronizacion, FechaImporte)
                VALUES (?, ?, ?, 'Pendiente', GETDATE())
            """, (vacaciones_id, concepto_id, float(importe)))
            
            conn.commit()
            
            cursor.execute("SELECT @@IDENTITY")
            mapping_id = cursor.fetchone()[0]
            
            return {
                'mapping_id': int(mapping_id),
                'vacaciones_id': vacaciones_id,
                'concepto_id': concepto_id,
                'importe': float(importe),
                'status': 'Pendiente',
                'dias': int(cantidad),
                'fecha_inicio': fecha_inicio.isoformat() if fecha_inicio else None,
                'fecha_fin': fecha_fin.isoformat() if fecha_fin else None
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creando mapeo de nómina: {str(e)}"
        )


def sync_leave_to_payroll(mapping_id: int, nomina_linea_id: int) -> dict:
    """
    Sincronizar un mapeo de vacación a una línea de nómina específica.
    
    Args:
        mapping_id: ID del mapeo
        nomina_linea_id: ID de la línea de nómina donde agregar
    
    Returns:
        dict: Resultado de la sincronización
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Obtener detalles del mapeo
            cursor.execute("""
                SELECT VacacionesId, ConceptoId, Importe
                FROM ERP_PAYROLL_LEAVE_MAPPING
                WHERE Mapping_Id = ?
            """, (mapping_id,))
            
            result = cursor.fetchone()
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail="Mapeo no encontrado"
                )
            
            vacaciones_id, concepto_id, importe = result
            
            if not concepto_id or not importe:
                raise HTTPException(
                    status_code=400,
                    detail="Mapeo incompleto: falta concepto o importe"
                )
            
            # Crear línea de detalle en nómina
            cursor.execute("""
                INSERT INTO ERP_NOI_NOMINA_DETALLE
                (NominaLinea_Id, Concepto_Id, Importe, Gravado, Exento)
                VALUES (?, ?, ?, ?, 0)
            """, (nomina_linea_id, concepto_id, float(importe), float(importe)))
            
            conn.commit()
            
            cursor.execute("SELECT @@IDENTITY")
            detalle_id = cursor.fetchone()[0]
            
            # Actualizar mapeo
            cursor.execute("""
                UPDATE ERP_PAYROLL_LEAVE_MAPPING
                SET NominaLineaId = ?, 
                    NominaDetalleId = ?,
                    EstadoSincronizacion = 'Sincronizado',
                    FechaSincronizacion = GETDATE()
                WHERE Mapping_Id = ?
            """, (nomina_linea_id, detalle_id, mapping_id))
            
            conn.commit()
            
            return {
                'mapping_id': mapping_id,
                'nomina_linea_id': nomina_linea_id,
                'nomina_detalle_id': int(detalle_id),
                'status': 'Sincronizado',
                'fecha_sync': datetime.now().isoformat()
            }
            
    except HTTPException:
        raise
    except Exception as e:
        # Registrar error en la tabla
        try:
            with get_connection() as conn:
                cursor = conn.connection.cursor()
                cursor.execute("""
                    UPDATE ERP_PAYROLL_LEAVE_MAPPING
                    SET EstadoSincronizacion = 'Error',
                        MensajeError = ?,
                        UpdatedAt = GETDATE()
                    WHERE Mapping_Id = ?
                """, (str(e)[:500], mapping_id))
                conn.commit()
        except:
            pass
        
        raise HTTPException(
            status_code=500,
            detail=f"Error sincronizando vacación a nómina: {str(e)}"
        )


def get_pending_leave_mappings(limit: int = 50) -> list:
    """
    Obtener mapeos pendientes de sincronización.
    
    Args:
        limit: Número máximo de resultados
    
    Returns:
        list: Lista de mapeos pendientes
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            cursor.execute(f"""
                SELECT TOP {limit}
                    m.Mapping_Id,
                    m.VacacionesId,
                    v.User_Id,
                    v.FechaInicio,
                    v.FechaFin,
                    v.Cantidad,
                    m.Importe,
                    m.EstadoSincronizacion
                FROM ERP_PAYROLL_LEAVE_MAPPING m
                JOIN ERP_HR_VACATION_REQUEST v ON m.VacacionesId = v.Vacaciones_Id
                WHERE m.EstadoSincronizacion = 'Pendiente'
                    AND v.Estatus = 'Aprobado'
                ORDER BY m.CreatedAt ASC
            """)
            
            mappings = []
            for row in cursor.fetchall():
                mapping_id, vac_id, user_id, inicio, fin, dias, importe, estado = row
                mappings.append({
                    'mapping_id': mapping_id,
                    'vacaciones_id': vac_id,
                    'user_id': user_id,
                    'fecha_inicio': inicio.isoformat() if inicio else None,
                    'fecha_fin': fin.isoformat() if fin else None,
                    'dias': dias,
                    'importe': float(importe) if importe else 0,
                    'estado': estado
                })
            
            return mappings
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo mapeos pendientes: {str(e)}"
        )


def get_leave_mappings_by_vacation(vacaciones_id: int) -> dict:
    """
    Obtener todos los mapeos de nómina para una vacación específica.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones
    
    Returns:
        dict: Información completa del mapeo
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            cursor.execute("""
                SELECT 
                    m.Mapping_Id,
                    m.VacacionesId,
                    m.NominaLineaId,
                    m.NominaDetalleId,
                    m.ConceptoId,
                    m.Importe,
                    m.EstadoSincronizacion,
                    m.FechaSincronizacion,
                    m.MensajeError,
                    v.FechaInicio,
                    v.FechaFin,
                    v.Cantidad,
                    v.Estatus
                FROM ERP_PAYROLL_LEAVE_MAPPING m
                LEFT JOIN ERP_HR_VACATION_REQUEST v ON m.VacacionesId = v.Vacaciones_Id
                WHERE m.VacacionesId = ?
            """, (vacaciones_id,))
            
            result = cursor.fetchone()
            if not result:
                return None
            
            (mapping_id, vac_id, nomina_linea_id, nomina_detalle_id, concepto_id, 
             importe, estado, fecha_sync, error, inicio, fin, dias, vac_estatus) = result
            
            return {
                'mapping_id': mapping_id,
                'vacaciones_id': vac_id,
                'nomina_linea_id': nomina_linea_id,
                'nomina_detalle_id': nomina_detalle_id,
                'concepto_id': concepto_id,
                'importe': float(importe) if importe else 0,
                'estado_sincronizacion': estado,
                'fecha_sincronizacion': fecha_sync.isoformat() if fecha_sync else None,
                'mensaje_error': error,
                'vacacion': {
                    'fecha_inicio': inicio.isoformat() if inicio else None,
                    'fecha_fin': fin.isoformat() if fin else None,
                    'dias': dias,
                    'estatus': vac_estatus
                }
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo mapeos de vacación: {str(e)}"
        )


def cancel_leave_mapping(vacaciones_id: int) -> dict:
    """
    Cancelar el mapeo de nómina cuando se rechaza una vacación.
    
    Args:
        vacaciones_id: ID de la solicitud de vacaciones
    
    Returns:
        dict: Resultado de la cancelación
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Cambiar estado a Cancelado
            cursor.execute("""
                UPDATE ERP_PAYROLL_LEAVE_MAPPING
                SET EstadoSincronizacion = 'Cancelado',
                    UpdatedAt = GETDATE()
                WHERE VacacionesId = ? AND EstadoSincronizacion != 'Sincronizado'
            """, (vacaciones_id,))
            
            conn.commit()
            
            return {
                'vacaciones_id': vacaciones_id,
                'estado': 'Cancelado',
                'mensaje': 'Mapeo de nómina cancelado'
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error cancelando mapeo: {str(e)}"
        )


def auto_sync_pending_to_open_payroll() -> dict:
    """
    Sincroniza automáticamente todos los mapeos pendientes a la nómina abierta más reciente.
    Busca la nómina en estado 'borrador' o 'abierta' con el periodo vigente y crea
    la línea de empleado si no existe, luego agrega el detalle de vacaciones.

    Returns:
        dict: Resumen con synced, skipped, errors
    """
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()

            # Buscar nómina abierta más reciente
            cursor.execute("""
                SELECT TOP 1 Nomina_Id, Descripcion, PeriodoInicio, PeriodoFin
                FROM ERP_NOI_NOMINAS
                WHERE LOWER(Estatus) IN ('borrador', 'abierta', 'en proceso')
                ORDER BY PeriodoInicio DESC
            """)
            nomina = cursor.fetchone()
            if not nomina:
                return {
                    'synced': 0, 'skipped': 0, 'errors': 0,
                    'mensaje': 'No hay nomina abierta o en borrador. Crea una nomina primero.'
                }
            nomina_id, desc, periodo_inicio, periodo_fin = nomina

            # Obtener mapeos pendientes con datos de empleado
            cursor.execute("""
                SELECT
                    m.Mapping_Id,
                    m.VacacionesId,
                    m.ConceptoId,
                    m.Importe,
                    v.User_Id,
                    v.FechaInicio,
                    v.FechaFin,
                    v.Cantidad
                FROM ERP_PAYROLL_LEAVE_MAPPING m
                JOIN ERP_HR_VACATION_REQUEST v ON m.VacacionesId = v.Vacaciones_Id
                WHERE m.EstadoSincronizacion = 'Pendiente'
                    AND v.Estatus = 'Aprobado'
                ORDER BY m.CreatedAt ASC
            """)
            pendientes = cursor.fetchall()

            synced, skipped, errors = 0, 0, 0
            results = []

            for row in pendientes:
                mapping_id, vac_id, concepto_id, importe, user_id, fi, ff, dias = row
                try:
                    # Buscar si el empleado ya tiene línea en esta nómina
                    cursor.execute("""
                        SELECT TOP 1 NominaLinea_Id
                        FROM ERP_NOI_NOMINA_LINEAS
                        WHERE Nomina_Id = ? AND User_Id = ?
                    """, (nomina_id, user_id))
                    linea = cursor.fetchone()

                    if linea:
                        nomina_linea_id = linea[0]
                    else:
                        # Crear línea del empleado en esta nómina
                        cursor.execute("""
                            INSERT INTO ERP_NOI_NOMINA_LINEAS (Nomina_Id, User_Id, Estatus)
                            VALUES (?, ?, 'Activo')
                        """, (nomina_id, user_id))
                        conn.commit()
                        cursor.execute("SELECT @@IDENTITY")
                        nomina_linea_id = cursor.fetchone()[0]

                    # Verificar que no se haya sincronizado ya este mapeo a esta misma línea
                    cursor.execute("""
                        SELECT COUNT(*) FROM ERP_NOI_NOMINA_DETALLE
                        WHERE NominaLinea_Id = ? AND Concepto_Id = ?
                        AND EXISTS (
                            SELECT 1 FROM ERP_PAYROLL_LEAVE_MAPPING
                            WHERE Mapping_Id = ? AND NominaLineaId = ?
                        )
                    """, (nomina_linea_id, concepto_id, mapping_id, nomina_linea_id))
                    ya_sync = cursor.fetchone()[0]
                    if ya_sync:
                        skipped += 1
                        continue

                    # Insertar detalle
                    cursor.execute("""
                        INSERT INTO ERP_NOI_NOMINA_DETALLE
                        (NominaLinea_Id, Concepto_Id, Importe, Gravado, Exento)
                        VALUES (?, ?, ?, ?, 0)
                    """, (nomina_linea_id, concepto_id, float(importe), float(importe)))
                    conn.commit()
                    cursor.execute("SELECT @@IDENTITY")
                    detalle_id = cursor.fetchone()[0]

                    # Marcar mapeo como sincronizado
                    cursor.execute("""
                        UPDATE ERP_PAYROLL_LEAVE_MAPPING
                        SET NominaLineaId = ?, NominaDetalleId = ?,
                            EstadoSincronizacion = 'Sincronizado',
                            FechaSincronizacion = GETDATE()
                        WHERE Mapping_Id = ?
                    """, (nomina_linea_id, detalle_id, mapping_id))
                    conn.commit()

                    synced += 1
                    results.append({
                        'mapping_id': mapping_id,
                        'vacaciones_id': vac_id,
                        'user_id': user_id,
                        'nomina_linea_id': nomina_linea_id,
                        'importe': float(importe),
                        'status': 'synced'
                    })

                except Exception as row_err:
                    # Registrar error en mapeo y continuar con el siguiente
                    try:
                        cursor.execute("""
                            UPDATE ERP_PAYROLL_LEAVE_MAPPING
                            SET EstadoSincronizacion = 'Error', MensajeError = ?
                            WHERE Mapping_Id = ?
                        """, (str(row_err)[:500], mapping_id))
                        conn.commit()
                    except Exception:
                        pass
                    errors += 1
                    results.append({'mapping_id': mapping_id, 'status': 'error', 'error': str(row_err)})

            return {
                'nomina_id': nomina_id,
                'nomina_descripcion': desc or f'Nomina #{nomina_id}',
                'periodo_inicio': periodo_inicio.isoformat() if periodo_inicio else None,
                'periodo_fin': periodo_fin.isoformat() if periodo_fin else None,
                'synced': synced,
                'skipped': skipped,
                'errors': errors,
                'total_procesados': len(pendientes),
                'resultados': results
            }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en auto-sincronizacion: {str(e)}"
        )


def get_all_leave_mappings(limit: int = 100) -> list:
    """Obtiene todos los mapeos (todos los estados) para el historial."""
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            cursor.execute(f"""
                SELECT TOP {limit}
                    m.Mapping_Id,
                    m.VacacionesId,
                    v.User_Id,
                    v.FechaInicio,
                    v.FechaFin,
                    v.Cantidad,
                    m.Importe,
                    m.EstadoSincronizacion,
                    m.FechaSincronizacion,
                    m.MensajeError,
                    m.NominaLineaId
                FROM ERP_PAYROLL_LEAVE_MAPPING m
                JOIN ERP_HR_VACATION_REQUEST v ON m.VacacionesId = v.Vacaciones_Id
                ORDER BY m.CreatedAt DESC
            """)
            result = []
            for row in cursor.fetchall():
                (mapping_id, vac_id, user_id, inicio, fin, dias,
                 importe, estado, fecha_sync, error, nomina_linea_id) = row
                result.append({
                    'mapping_id': mapping_id,
                    'vacaciones_id': vac_id,
                    'user_id': user_id,
                    'fecha_inicio': inicio.isoformat() if inicio else None,
                    'fecha_fin': fin.isoformat() if fin else None,
                    'dias': dias,
                    'importe': float(importe) if importe else 0,
                    'estado': estado,
                    'fecha_sincronizacion': fecha_sync.isoformat() if fecha_sync else None,
                    'mensaje_error': error,
                    'nomina_linea_id': nomina_linea_id,
                })
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo historial: {str(e)}")


# Schemas para FastAPI
class PayrollLeaveMappingResponse:
    """Schema para respuesta de mapeo de nómina"""
    mapping_id: int
    vacaciones_id: int
    concepto_id: int
    importe: float
    status: str
    dias: int


export = {
    'get_or_create_leave_concept': get_or_create_leave_concept,
    'calculate_leave_amount': calculate_leave_amount,
    'create_payroll_mapping': create_payroll_mapping,
    'sync_leave_to_payroll': sync_leave_to_payroll,
    'get_pending_leave_mappings': get_pending_leave_mappings,
    'get_leave_mappings_by_vacation': get_leave_mappings_by_vacation,
    'cancel_leave_mapping': cancel_leave_mapping,
}
