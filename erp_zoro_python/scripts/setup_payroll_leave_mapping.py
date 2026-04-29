#!/usr/bin/env python3
"""
Script para crear la tabla ERP_PAYROLL_LEAVE_MAPPING
Tabla que mapea vacaciones aprobadas a entradas de nómina

Ejecución:
    cd erp_zoro_python
    python setup_payroll_leave_mapping.py
"""

import sys
import os
from datetime import datetime

# Agregar directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.db.session import get_connection
except ModuleNotFoundError:
    print("⚠️  No se pudo importar app.db.session, usando conexión directa...")
    import pyodbc
    
    def get_connection():
        """Crear conexión directa a SQL Server"""
        conn_str = (
            'Driver={ODBC Driver 17 for SQL Server};'
            'Server=74.208.195.73,1433;'
            'Database=ERP_Zoro;'
            'UID=sa;'
            'PWD=Zoro2024!.;'
        )
        try:
            return pyodbc.connect(conn_str)
        except Exception as e:
            print(f"Error conectando con ODBC Driver 17: {e}")
            conn_str = conn_str.replace('ODBC Driver 17 for SQL Server', 'ODBC Driver 18 for SQL Server')
            return pyodbc.connect(conn_str)


def create_payroll_leave_mapping_table():
    """Crear la tabla ERP_PAYROLL_LEAVE_MAPPING"""
    
    print("\n" + "="*70)
    print("CREANDO TABLA ERP_PAYROLL_LEAVE_MAPPING")
    print("="*70)
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Verificar si existe
            cursor.execute("""
                IF OBJECT_ID('ERP_PAYROLL_LEAVE_MAPPING', 'U') IS NOT NULL
                    SELECT 1
                ELSE
                    SELECT 0
            """)
            
            exists = cursor.fetchone()[0]
            if exists:
                print("⚠️  Tabla ya existe")
                return True
            
            # Crear tabla principal
            print("Creando tabla...")
            cursor.execute("""
                CREATE TABLE ERP_PAYROLL_LEAVE_MAPPING (
                    Mapping_Id INT PRIMARY KEY IDENTITY(1,1),
                    VacacionesId INT NOT NULL,
                    NominaLineaId INT NULL,
                    NominaDetalleId INT NULL,
                    ConceptoId INT NULL,
                    Importe DECIMAL(12, 2) NULL,
                    FechaImporte DATETIME NULL,
                    EstadoSincronizacion NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
                    FechaSincronizacion DATETIME NULL,
                    MensajeError NVARCHAR(MAX) NULL,
                    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_MAPPING_VACATION FOREIGN KEY (VacacionesId) REFERENCES ERP_HR_VACATION_REQUEST(Vacaciones_Id),
                    CONSTRAINT FK_MAPPING_CONCEPTO FOREIGN KEY (ConceptoId) REFERENCES ERP_NOI_CONCEPTOS(Concepto_Id),
                    CONSTRAINT CK_MAPPING_STATUS CHECK (EstadoSincronizacion IN ('Pendiente', 'Sincronizado', 'Error', 'Cancelado'))
                )
            """)
            
            conn.commit()
            print("✅ Tabla creada")
            
            # Crear índices
            print("Creando índices...")
            
            indices = [
                "IX_MAPPING_VACATION_ID",
                "IX_MAPPING_NOMINA_LINEA_ID", 
                "IX_MAPPING_STATE",
                "IX_MAPPING_FECHA_SYNC",
                "IX_MAPPING_VACATION_STATE"
            ]
            
            index_sqls = [
                "CREATE INDEX IX_MAPPING_VACATION_ID ON ERP_PAYROLL_LEAVE_MAPPING(VacacionesId)",
                "CREATE INDEX IX_MAPPING_NOMINA_LINEA_ID ON ERP_PAYROLL_LEAVE_MAPPING(NominaLineaId)",
                "CREATE INDEX IX_MAPPING_STATE ON ERP_PAYROLL_LEAVE_MAPPING(EstadoSincronizacion)",
                "CREATE INDEX IX_MAPPING_FECHA_SYNC ON ERP_PAYROLL_LEAVE_MAPPING(FechaSincronizacion DESC)",
                "CREATE INDEX IX_MAPPING_VACATION_STATE ON ERP_PAYROLL_LEAVE_MAPPING(VacacionesId, EstadoSincronizacion)"
            ]
            
            for idx_name, idx_sql in zip(indices, index_sqls):
                try:
                    cursor.execute(idx_sql)
                    conn.commit()
                except:
                    pass  # El índice podría ya existir
            
            print("✅ Índices creados")
            
            # Verificación
            cursor.execute("""
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CASE WHEN IS_NULLABLE = 'YES' THEN 'Sí' ELSE 'No' END AS 'Permite NULL'
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ERP_PAYROLL_LEAVE_MAPPING'
                ORDER BY ORDINAL_POSITION
            """)
            
            print("\nEstructura de la tabla:")
            print("-" * 60)
            for row in cursor.fetchall():
                print(f"  {row[0]:<25} | {row[1]:<15} | {row[2]:<10}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error creando tabla: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def create_leave_concept():
    """Crear concepto de VACACIONES en la nómina si no existe"""
    
    print("\n" + "="*70)
    print("CREANDO CONCEPTO DE VACACIONES")
    print("="*70)
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Verificar si existe
            cursor.execute("""
                SELECT TOP 1 Concepto_Id 
                FROM ERP_NOI_CONCEPTOS 
                WHERE Clave = 'VAC' OR Descripcion LIKE '%VACACION%'
            """)
            
            if cursor.fetchone():
                print("✅ Concepto de vacaciones ya existe")
                return True
            
            # Crear concepto
            cursor.execute("""
                INSERT INTO ERP_NOI_CONCEPTOS 
                (Tipo, Clave, Descripcion, EsGravado, EsExento)
                VALUES ('PERCEPCION', 'VAC', 'Pago de Vacaciones', 1, 0)
            """)
            
            conn.commit()
            print("✅ Concepto de vacaciones creado")
            return True
            
    except Exception as e:
        print(f"⚠️  No se pudo crear concepto: {str(e)}")
        print("   (Puede que ya exista)")
        return True  # No es crítico


def main():
    """Función principal"""
    
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*10 + "SETUP DE INTEGRACIÓN NÓMINA - VACACIONES (PAYROLL)" + " "*8 + "║")
    print("╚" + "="*68 + "╝")
    
    success = True
    
    # Crear tabla
    if not create_payroll_leave_mapping_table():
        success = False
    
    # Crear concepto
    if not create_leave_concept():
        success = False
    
    # Resumen final
    print("\n" + "="*70)
    if success:
        print("✅ SETUP DE INTEGRACIÓN NÓMINA COMPLETADO EXITOSAMENTE")
        print("\nProximos pasos:")
        print("  1. Iniciar el backend: uvicorn app.main:app --reload")
        print("  2. Los endpoints de integración estarán disponibles en /api/rh/payroll/")
        print("  3. Cuando se apruebe una vacación, crear mapeo: POST /rh/payroll/create-mapping")
    else:
        print("❌ SETUP COMPLETADO CON ERRORES")
    print("="*70 + "\n")
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
