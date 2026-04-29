"""
Setup script para crear tablas de tipos de licencia, saldo y festivos
Ejecutar desde: erp_zoro_python/setup_leave_tables.py
"""

import sys
from pathlib import Path
from sqlalchemy import text

# Agregar ruta al path
sys.path.insert(0, str(Path(__file__).parent / 'erp_zoro_python'))

from app.db.session import engine

SQL_STATEMENTS = [
    # ============================================================================
    # 1. CREAR TABLA ERP_HR_LEAVE_TYPES
    # ============================================================================
    """
    IF OBJECT_ID('ERP_HR_LEAVE_TYPES', 'U') IS NOT NULL
    BEGIN
        DROP TABLE ERP_HR_LEAVE_TYPES
        PRINT '⚠️  Tabla ERP_HR_LEAVE_TYPES eliminada'
    END
    
    CREATE TABLE ERP_HR_LEAVE_TYPES (
        LeaveType_Id INT PRIMARY KEY IDENTITY(1,1),
        Company_Id INT NOT NULL,
        Name NVARCHAR(100) NOT NULL UNIQUE,
        Description NVARCHAR(MAX) NULL,
        Color NVARCHAR(7) NOT NULL DEFAULT '#0066CC',
        DefaultDays INT NOT NULL DEFAULT 5,
        Requires_Document BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_LEAVE_TYPE_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id),
        CONSTRAINT CK_LEAVE_TYPE_DAYS CHECK (DefaultDays > 0)
    )
    
    CREATE INDEX IX_LEAVE_TYPE_COMPANY ON ERP_HR_LEAVE_TYPES(Company_Id)
    CREATE INDEX IX_LEAVE_TYPE_ACTIVE ON ERP_HR_LEAVE_TYPES(IsActive)
    
    PRINT '✅ Tabla ERP_HR_LEAVE_TYPES creada'
    """,
    
    # ============================================================================
    # 2. CREAR TABLA ERP_HR_LEAVE_BALANCE
    # ============================================================================
    """
    IF OBJECT_ID('ERP_HR_LEAVE_BALANCE', 'U') IS NOT NULL
    BEGIN
        DROP TABLE ERP_HR_LEAVE_BALANCE
        PRINT '⚠️  Tabla ERP_HR_LEAVE_BALANCE eliminada'
    END
    
    CREATE TABLE ERP_HR_LEAVE_BALANCE (
        Balance_Id INT PRIMARY KEY IDENTITY(1,1),
        User_Id INT NOT NULL,
        LeaveType_Id INT NOT NULL,
        Year INT NOT NULL,
        AvailableDays DECIMAL(10,2) NOT NULL DEFAULT 0,
        UsedDays DECIMAL(10,2) NOT NULL DEFAULT 0,
        PlannedDays DECIMAL(10,2) NOT NULL DEFAULT 0,
        CarryOverDays DECIMAL(10,2) NOT NULL DEFAULT 0,
        NegativeBalanceAllowed DECIMAL(10,2) NOT NULL DEFAULT 0,
        LastAccrualDate DATETIME NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_BALANCE_USER FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id),
        CONSTRAINT FK_BALANCE_LEAVE_TYPE FOREIGN KEY (LeaveType_Id) REFERENCES ERP_HR_LEAVE_TYPES(LeaveType_Id),
        CONSTRAINT UQ_BALANCE_USER_TYPE_YEAR UNIQUE (User_Id, LeaveType_Id, Year),
        CONSTRAINT CK_BALANCE_AVAILABLE CHECK (AvailableDays >= 0),
        CONSTRAINT CK_BALANCE_USED CHECK (UsedDays >= 0),
        CONSTRAINT CK_BALANCE_PLANNED CHECK (PlannedDays >= 0)
    )
    
    CREATE INDEX IX_BALANCE_USER ON ERP_HR_LEAVE_BALANCE(User_Id)
    CREATE INDEX IX_BALANCE_LEAVE_TYPE ON ERP_HR_LEAVE_BALANCE(LeaveType_Id)
    CREATE INDEX IX_BALANCE_YEAR ON ERP_HR_LEAVE_BALANCE(Year)
    CREATE INDEX IX_BALANCE_USER_YEAR ON ERP_HR_LEAVE_BALANCE(User_Id, Year)
    
    PRINT '✅ Tabla ERP_HR_LEAVE_BALANCE creada'
    """,
    
    # ============================================================================
    # 3. CREAR TABLA ERP_COMPANY_PUBLIC_HOLIDAYS
    # ============================================================================
    """
    IF OBJECT_ID('ERP_COMPANY_PUBLIC_HOLIDAYS', 'U') IS NOT NULL
    BEGIN
        DROP TABLE ERP_COMPANY_PUBLIC_HOLIDAYS
        PRINT '⚠️  Tabla ERP_COMPANY_PUBLIC_HOLIDAYS eliminada'
    END
    
    CREATE TABLE ERP_COMPANY_PUBLIC_HOLIDAYS (
        Holiday_Id INT PRIMARY KEY IDENTITY(1,1),
        Company_Id INT NOT NULL,
        HolidayDate DATETIME NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        IsObligatory BIT NOT NULL DEFAULT 1,
        IsRecurring BIT NOT NULL DEFAULT 0,
        RecurringMonth INT NULL,
        RecurringDay INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_HOLIDAY_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id),
        CONSTRAINT CK_HOLIDAY_MONTH CHECK (RecurringMonth IS NULL OR (RecurringMonth >= 1 AND RecurringMonth <= 12)),
        CONSTRAINT CK_HOLIDAY_DAY CHECK (RecurringDay IS NULL OR (RecurringDay >= 1 AND RecurringDay <= 31))
    )
    
    CREATE INDEX IX_HOLIDAY_COMPANY ON ERP_COMPANY_PUBLIC_HOLIDAYS(Company_Id)
    CREATE INDEX IX_HOLIDAY_DATE ON ERP_COMPANY_PUBLIC_HOLIDAYS(HolidayDate)
    CREATE INDEX IX_HOLIDAY_COMPANY_DATE ON ERP_COMPANY_PUBLIC_HOLIDAYS(Company_Id, HolidayDate)
    
    PRINT '✅ Tabla ERP_COMPANY_PUBLIC_HOLIDAYS creada'
    """,
    
    # ============================================================================
    # 4. ALTERAR TABLA ERP_HR_VACATION_REQUEST
    # ============================================================================
    """
    -- Agregar columnas a tabla existente
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST' 
                   AND COLUMN_NAME = 'LeaveType_Id')
    BEGIN
        ALTER TABLE ERP_HR_VACATION_REQUEST 
        ADD LeaveType_Id INT NULL
        PRINT '✅ Columna LeaveType_Id agregada'
    END
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST' 
                   AND COLUMN_NAME = 'Duration')
    BEGIN
        ALTER TABLE ERP_HR_VACATION_REQUEST 
        ADD Duration DECIMAL(10,2) NULL
        PRINT '✅ Columna Duration agregada'
    END
    
    -- Agregar constraint si no existe
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
                   WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST'
                   AND CONSTRAINT_NAME = 'FK_VACATION_LEAVE_TYPE')
    BEGIN
        ALTER TABLE ERP_HR_VACATION_REQUEST
        ADD CONSTRAINT FK_VACATION_LEAVE_TYPE FOREIGN KEY (LeaveType_Id) 
        REFERENCES ERP_HR_LEAVE_TYPES(LeaveType_Id)
        PRINT '✅ FK LeaveType_Id agregada'
    END
    """
]

def main():
    print("\n" + "="*80)
    print("🔧 CREAR TABLAS DE TIPOS DE LICENCIA Y SALDO DE VACACIONES")
    print("="*80 + "\n")
    
    try:
        with engine.begin() as connection:
            for i, sql_statement in enumerate(SQL_STATEMENTS, 1):
                print(f"\n📝 Ejecutando statement {i}/{len(SQL_STATEMENTS)}...")
                connection.execute(text(sql_statement))
                print(f"   ✅ Completado")
        
        # Verificar tablas creadas
        print("\n" + "="*80)
        print("📊 VERIFICANDO TABLAS CREADAS")
        print("="*80 + "\n")
        
        with engine.connect() as connection:
            # Verificar ERP_HR_LEAVE_TYPES
            result = connection.execute(text("""
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME IN ('ERP_HR_LEAVE_TYPES', 'ERP_HR_LEAVE_BALANCE', 'ERP_COMPANY_PUBLIC_HOLIDAYS')
            """))
            tables = [row[0] for row in result]
            
            print(f"✅ Tablas creadas: {', '.join(tables)}\n")
            
            # Mostrar estructura de ERP_HR_LEAVE_TYPES
            print("📋 Estructura ERP_HR_LEAVE_TYPES:")
            result = connection.execute(text("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ERP_HR_LEAVE_TYPES'
                ORDER BY ORDINAL_POSITION
            """))
            for col in result:
                nullable = "✓" if col[2] == 'YES' else "✗"
                print(f"  • {col[0]:<25} {col[1]:<20} NULL:{nullable}")
            
            print("\n📋 Estructura ERP_HR_LEAVE_BALANCE:")
            result = connection.execute(text("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ERP_HR_LEAVE_BALANCE'
                ORDER BY ORDINAL_POSITION
            """))
            for col in result:
                nullable = "✓" if col[2] == 'YES' else "✗"
                print(f"  • {col[0]:<25} {col[1]:<20} NULL:{nullable}")
            
            print("\n📋 Estructura ERP_COMPANY_PUBLIC_HOLIDAYS:")
            result = connection.execute(text("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'ERP_COMPANY_PUBLIC_HOLIDAYS'
                ORDER BY ORDINAL_POSITION
            """))
            for col in result:
                nullable = "✓" if col[2] == 'YES' else "✗"
                print(f"  • {col[0]:<25} {col[1]:<20} NULL:{nullable}")
        
        print("\n" + "="*80)
        print("✅ TODAS LAS TABLAS CREADAS EXITOSAMENTE")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print(f"Detalles: {type(e).__name__}")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
