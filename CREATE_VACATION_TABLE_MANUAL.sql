-- ============================================================================
-- CREAR TABLA ERP_HR_VACATION_REQUEST
-- ============================================================================
-- Instrucciones:
-- 1. Abre SQL Server Management Studio
-- 2. Conecta a tu servidor SQL Server (74.208.195.73)
-- 3. Selecciona la base de datos: ERP_Zoro
-- 4. Copia y pega TODO el contenido de este archivo
-- 5. Haz clic en "Execute" (F5)
-- ============================================================================

-- Verificar si la tabla existe
IF OBJECT_ID('ERP_HR_VACATION_REQUEST', 'U') IS NOT NULL
BEGIN
    PRINT 'La tabla ERP_HR_VACATION_REQUEST ya existe'
    PRINT 'Si deseas recrearla, ejecuta primero: DROP TABLE ERP_HR_VACATION_REQUEST'
    PRINT 'Abortando...'
    RETURN
END

PRINT 'Creando tabla ERP_HR_VACATION_REQUEST...'

-- Crear tabla principal
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
)

PRINT '✅ Tabla creada'

-- Crear índices para mejorar rendimiento
PRINT 'Creando índices...'

CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id)
CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus)
CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin)
CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC)

PRINT '✅ Índices creados'

-- Verificar que se creó correctamente
IF OBJECT_ID('ERP_HR_VACATION_REQUEST', 'U') IS NOT NULL
BEGIN
    PRINT ''
    PRINT '========================================================================'
    PRINT '✅ TABLA ERP_HR_VACATION_REQUEST CREADA EXITOSAMENTE'
    PRINT '========================================================================'
    PRINT ''
    
    -- Mostrar estructura
    PRINT 'Estructura de la tabla:'
    PRINT '----------------------------------------------'
    
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CASE WHEN IS_NULLABLE = 'YES' THEN 'Sí' ELSE 'No' END AS 'Permite NULL'
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_HR_VACATION_REQUEST'
    ORDER BY ORDINAL_POSITION
    
    PRINT ''
    PRINT 'Registros actuales: 0'
    PRINT ''
    PRINT 'Estado: ✅ LISTO PARA USAR'
    PRINT ''
END
ELSE
BEGIN
    PRINT '❌ ERROR: No se pudo crear la tabla'
END

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
