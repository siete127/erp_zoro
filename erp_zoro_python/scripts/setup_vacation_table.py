#!/usr/bin/env python3
"""
Script para crear tabla ERP_HR_VACATION_REQUEST usando la sesión del backend
"""

import sys
import os

# Agregar ruta del proyecto
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from sqlalchemy import text

# Cargar variables de entorno
load_dotenv()

print("\n" + "="*70)
print("🔧 CREAR TABLA ERP_HR_VACATION_REQUEST")
print("="*70 + "\n")

try:
    # Importar la sesión ya configurada del backend
    from app.db.session import engine
    
    print("✅ Conectado a SQL Server\n")
    
    # SQL para crear la tabla
    create_table_sql = """
    IF OBJECT_ID('ERP_HR_VACATION_REQUEST', 'U') IS NOT NULL
    BEGIN
        PRINT 'La tabla ya existe'
        DROP TABLE ERP_HR_VACATION_REQUEST
        PRINT 'Tabla eliminada, recreando...'
    END
    
    CREATE TABLE ERP_HR_VACATION_REQUEST (
        Vacaciones_Id INT PRIMARY KEY IDENTITY(1,1),
        User_Id INT NOT NULL,
        FechaInicio DATETIME NOT NULL,
        FechaFin DATETIME NOT NULL,
        Cantidad INT NOT NULL,
        Razon NVARCHAR(255) NULL,
        Observaciones NVARCHAR(MAX) NULL,
        Estatus NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
        AprobadoPor INT NULL,
        FechaAprobacion DATETIME NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_VACATION_USER FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id),
        CONSTRAINT FK_VACATION_APPROVED_BY FOREIGN KEY (AprobadoPor) REFERENCES ERP_USERS(User_Id),
        CONSTRAINT CK_VACATION_STATUS CHECK (Estatus IN ('Pendiente', 'Aprobado', 'Rechazado')),
        CONSTRAINT CK_VACATION_DATES CHECK (FechaFin >= FechaInicio),
        CONSTRAINT CK_VACATION_CANTIDAD CHECK (Cantidad > 0)
    )
    """
    
    index_sqls = [
        "CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id)",
        "CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus)",
        "CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin)",
        "CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC)"
    ]
    
    print("📝 Creando tabla...")
    with engine.begin() as conn:
        conn.execute(text(create_table_sql))
    print("✅ Tabla creada\n")
    
    print("📑 Creando índices...")
    with engine.begin() as conn:
        for i, sql in enumerate(index_sqls, 1):
            conn.execute(text(sql))
            print(f"   ✅ Índice {i}/{len(index_sqls)}")
    
    print("\n📊 Verificando estructura...\n")
    
    verify_sql = """
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CASE WHEN IS_NULLABLE = 'YES' THEN 'Sí' ELSE 'No' END AS 'Permite NULL'
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST'
    ORDER BY ORDINAL_POSITION
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(verify_sql))
        
        print(f"{'Columna':<25} {'Tipo':<20} {'Nulo?':<8}")
        print("-" * 53)
        
        rows = result.fetchall()
        for row in rows:
            print(f"{row[0]:<25} {row[1]:<20} {row[2]:<8}")
        
        print(f"\nTotal de columnas: {len(rows)}")
        
        # Contar registros
        count_sql = "SELECT COUNT(*) FROM ERP_HR_VACATION_REQUEST"
        count_result = conn.execute(text(count_sql))
        count = count_result.scalar()
        print(f"Registros: {count}\n")
    
    print("="*70)
    print("✅ TABLA ERP_HR_VACATION_REQUEST CREADA EXITOSAMENTE")
    print("="*70 + "\n")
    
    print("🎉 El módulo de vacaciones está 100% listo!\n")
    print("📝 Próximos pasos:")
    print("  1. Reinicia el frontend si está corriendo")
    print("  2. Navega a RH → Selecciona un empleado")
    print("  3. Click en la pestaña '📅 Vacaciones'")
    print("  4. ¡Comienza a solicitar vacaciones!\n")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}\n")
    print(f"Tipo de error: {type(e).__name__}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
