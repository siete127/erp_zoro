#!/usr/bin/env python3
"""
Script para crear tabla ERP_HR_VACATION_REQUEST usando SQLAlchemy
Uso: python create_vacation_table_v2.py
"""

import sys
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError

# Cargar variables de entorno
load_dotenv()

HOST = os.getenv('ERP_SQLSERVER_HOST', '74.208.195.73')
PORT = int(os.getenv('ERP_SQLSERVER_PORT', '1433'))
USER = os.getenv('ERP_SQLSERVER_USER', 'sa')
PASSWORD = os.getenv('ERP_SQLSERVER_PASSWORD', '')
DATABASE = os.getenv('ERP_SQLSERVER_DATABASE', 'ERP_Zoro')

print("\n" + "="*70)
print("🔧 CREAR TABLA ERP_HR_VACATION_REQUEST (SQLAlchemy)")
print("="*70 + "\n")

print(f"📍 Servidor: {HOST}:{PORT}")
print(f"🗄️  Base de datos: {DATABASE}")
print(f"👤 Usuario: {USER}\n")

# Construir URL de conexión
from urllib.parse import quote_plus
password_quoted = quote_plus(PASSWORD)

# Intentar con diferentes drivers
drivers_to_try = [
    'ODBC Driver 18 for SQL Server',
    'ODBC Driver 17 for SQL Server',
    'SQL Server Native Client 11.0'
]

connection_url = None
for driver in drivers_to_try:
    driver_quoted = quote_plus(driver)
    url = (
        f'mssql+pyodbc://{USER}:{password_quoted}@{HOST}:{PORT}/{DATABASE}'
        f'?driver={driver_quoted}&Encrypt=yes&TrustServerCertificate=yes'
    )
    
    try:
        print(f"⏳ Intentando conexión con: {driver}...")
        engine = create_engine(url, echo=False)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        connection_url = url
        print(f"✅ Conexión exitosa con {driver}\n")
        break
    except Exception as e:
        print(f"❌ {driver}: {str(e)[:60]}")

if not connection_url:
    print("\n❌ ERROR: No se pudo conectar con ningún driver ODBC")
    print("\nSoluciones:")
    print("1. Instala ODBC Driver 18 para SQL Server")
    print("2. O ejecuta el script SQL manualmente en SQL Server Management Studio")
    print("3. Archivo: erp_zoro_python/sql/create_vacation_request_table.sql\n")
    sys.exit(1)

try:
    # Crear engine
    engine = create_engine(connection_url, echo=False)
    
    # Inspector para verificar tablas
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    print(f"📋 Tablas existentes: {len(existing_tables)}")
    
    if 'ERP_HR_VACATION_REQUEST' in existing_tables:
        print("⚠️  La tabla ERP_HR_VACATION_REQUEST ya existe\n")
        response = input("¿Deseas eliminarla y recrearla? (s/n): ").strip().lower()
        
        if response != 's':
            print("❌ Operación cancelada")
            sys.exit(0)
        
        with engine.begin() as conn:
            print("🗑️  Eliminando tabla...")
            conn.execute(text("DROP TABLE ERP_HR_VACATION_REQUEST"))
            print("✅ Tabla eliminada\n")
    
    # Crear tabla
    print("📝 Creando tabla ERP_HR_VACATION_REQUEST...\n")
    
    sql_statements = [
        """
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
        """,
        "CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id)",
        "CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus)",
        "CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin)",
        "CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC)"
    ]
    
    with engine.begin() as conn:
        for i, sql in enumerate(sql_statements, 1):
            conn.execute(text(sql))
            print(f"  ✅ Statement {i}/{len(sql_statements)} completado")
    
    print("\n✅ TABLA CREADA CORRECTAMENTE\n")
    
    # Verificar estructura
    print("📊 Verificando estructura...\n")
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST'
            ORDER BY ORDINAL_POSITION
        """))
        
        print(f"{'Columna':<25} {'Tipo':<20} {'Nulo?':<8}")
        print("-" * 53)
        
        columns = []
        for row in result:
            col_name, data_type, is_nullable = row
            columns.append(row)
            nullable = "Sí" if is_nullable == "YES" else "No"
            print(f"{col_name:<25} {data_type:<20} {nullable:<8}")
        
        print(f"\nTotal de columnas: {len(columns)}")
        
        # Contar registros
        result = conn.execute(text("SELECT COUNT(*) FROM ERP_HR_VACATION_REQUEST"))
        count = result.scalar()
        print(f"Registros: {count}")
    
    print("\n" + "="*70)
    print("✅ TABLA ERP_HR_VACATION_REQUEST CREADA EXITOSAMENTE")
    print("="*70 + "\n")
    
    print("🎉 El módulo de vacaciones está listo para usar!")
    print("\n📝 Próximos pasos:")
    print("  1. Reinicia el frontend: npm run dev")
    print("  2. Navega a RH → Selecciona un empleado")
    print("  3. Click en la pestaña '📅 Vacaciones'\n")

except SQLAlchemyError as e:
    print(f"\n❌ ERROR DE BASE DE DATOS:\n{e}\n")
    print("Alternativa: Ejecuta el script SQL manualmente:")
    print("  erp_zoro_python/sql/create_vacation_request_table.sql\n")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ ERROR:\n{e}\n")
    sys.exit(1)
