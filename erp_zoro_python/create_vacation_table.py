#!/usr/bin/env python3
"""
Script para crear la tabla ERP_HR_VACATION_REQUEST en SQL Server
Uso: python create_vacation_table.py
"""

import os
import sys
from dotenv import load_dotenv
import pyodbc

# Cargar variables de entorno
load_dotenv()

# Configuración de conexión
HOST = os.getenv('ERP_SQLSERVER_HOST', '74.208.195.73')
PORT = int(os.getenv('ERP_SQLSERVER_PORT', '1433'))
USER = os.getenv('ERP_SQLSERVER_USER', 'sa')
PASSWORD = os.getenv('ERP_SQLSERVER_PASSWORD', '')
DATABASE = os.getenv('ERP_SQLSERVER_DATABASE', 'ERP_Zoro')
DRIVER = os.getenv('ERP_SQLSERVER_DRIVER', 'ODBC Driver 18 for SQL Server')

print("\n" + "="*70)
print("🔧 CREAR TABLA ERP_HR_VACATION_REQUEST")
print("="*70 + "\n")

print(f"📍 Conexión: {HOST}:{PORT}")
print(f"🗄️  Base de datos: {DATABASE}")
print(f"👤 Usuario: {USER}")
print(f"🔌 Driver: {DRIVER}\n")

# SQL para crear la tabla
SQL_CREATE_TABLE = """
-- Crear tabla de solicitudes de vacaciones
CREATE TABLE ERP_HR_VACATION_REQUEST (
    Vacaciones_Id INT PRIMARY KEY IDENTITY(1,1),
    
    -- Relación
    User_Id INT NOT NULL,
    
    -- Fechas de la solicitud
    FechaInicio DATETIME NOT NULL,
    FechaFin DATETIME NOT NULL,
    Cantidad INT NOT NULL,
    
    -- Información
    Razon NVARCHAR(255) NULL,
    Observaciones NVARCHAR(MAX) NULL,
    
    -- Aprobación
    Estatus NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    AprobadoPor INT NULL,
    FechaAprobacion DATETIME NULL,
    
    -- Control
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy INT NULL,
    UpdatedBy INT NULL,
    
    -- Constraints
    CONSTRAINT FK_VACATION_USER FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id),
    CONSTRAINT FK_VACATION_APPROVED_BY FOREIGN KEY (AprobadoPor) REFERENCES ERP_USERS(User_Id),
    CONSTRAINT CK_VACATION_STATUS CHECK (Estatus IN ('Pendiente', 'Aprobado', 'Rechazado')),
    CONSTRAINT CK_VACATION_DATES CHECK (FechaFin >= FechaInicio),
    CONSTRAINT CK_VACATION_CANTIDAD CHECK (Cantidad > 0)
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id);
CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus);
CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin);
CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC);
"""

try:
    # Conectar a SQL Server
    print("⏳ Conectando a SQL Server...")
    conn = pyodbc.connect(
        f'Driver={{{DRIVER}}}; '
        f'Server={HOST},{PORT}; '
        f'Database={DATABASE}; '
        f'UID={USER}; '
        f'PWD={PASSWORD}; '
        f'Encrypt=yes; '
        f'TrustServerCertificate=yes;'
    )
    print("✅ Conexión exitosa\n")
    
    cursor = conn.cursor()
    
    # Verificar si la tabla ya existe
    print("🔍 Verificando si la tabla ya existe...")
    cursor.execute("""
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST' 
        AND TABLE_SCHEMA = 'dbo'
    """)
    
    if cursor.fetchone():
        print("⚠️  La tabla ERP_HR_VACATION_REQUEST ya existe\n")
        print("¿Deseas eliminarla y recrearla? (s/n): ", end="")
        response = input().strip().lower()
        
        if response == 's':
            print("🗑️  Eliminando tabla existente...")
            cursor.execute("DROP TABLE ERP_HR_VACATION_REQUEST")
            conn.commit()
            print("✅ Tabla eliminada\n")
        else:
            print("❌ Operación cancelada")
            cursor.close()
            conn.close()
            sys.exit(0)
    
    # Crear la tabla
    print("📝 Creando tabla ERP_HR_VACATION_REQUEST...")
    
    # Ejecutar el SQL (dividido en statements)
    statements = [
        # Crear tabla
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
        # Índices
        "CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id)",
        "CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus)",
        "CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin)",
        "CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC)"
    ]
    
    for i, statement in enumerate(statements, 1):
        cursor.execute(statement)
        print(f"  ✅ Statement {i}/{len(statements)} completado")
    
    conn.commit()
    print("\n✅ TABLA CREADA CORRECTAMENTE\n")
    
    # Verificar estructura
    print("📊 Verificando estructura de la tabla...")
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST'
        ORDER BY ORDINAL_POSITION
    """)
    
    columns = cursor.fetchall()
    print(f"\n{'Columna':<25} {'Tipo':<20} {'Nulo?':<8}")
    print("-" * 53)
    for col_name, data_type, is_nullable in columns:
        nullable = "Sí" if is_nullable == "YES" else "No"
        print(f"{col_name:<25} {data_type:<20} {nullable:<8}")
    
    print(f"\nTotal de columnas: {len(columns)}")
    
    # Contar filas
    cursor.execute("SELECT COUNT(*) FROM ERP_HR_VACATION_REQUEST")
    row_count = cursor.fetchone()[0]
    print(f"Registros actualmente: {row_count}")
    
    print("\n" + "="*70)
    print("✅ TABLA ERP_HR_VACATION_REQUEST CREADA EXITOSAMENTE")
    print("="*70 + "\n")
    
    cursor.close()
    conn.close()
    
except pyodbc.Error as e:
    print(f"\n❌ ERROR DE BASE DE DATOS:\n{e}\n")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ ERROR:\n{e}\n")
    sys.exit(1)
