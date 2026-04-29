-- ============================================================================
-- CREAR TABLA ERP_PAYROLL_LEAVE_MAPPING
-- ============================================================================
-- Propósito: Mapear vacaciones aprobadas a entradas de nómina
-- Permite sincronizar automáticamente cuando se aprueba una solicitud
-- ============================================================================

-- Verificar si la tabla existe
IF OBJECT_ID('ERP_PAYROLL_LEAVE_MAPPING', 'U') IS NOT NULL
BEGIN
    PRINT 'La tabla ERP_PAYROLL_LEAVE_MAPPING ya existe'
    RETURN
END

PRINT 'Creando tabla ERP_PAYROLL_LEAVE_MAPPING...'

-- Crear tabla
CREATE TABLE ERP_PAYROLL_LEAVE_MAPPING (
    Mapping_Id INT PRIMARY KEY IDENTITY(1,1),
    
    -- Relaciones
    VacacionesId INT NOT NULL,
    NominaLineaId INT NULL,
    NominaDetalleId INT NULL,
    
    -- Información de la sincronización
    ConceptoId INT NULL,  -- FK a ERP_NOI_CONCEPTOS
    Importe DECIMAL(12, 2) NULL,  -- Monto de la vacación
    FechaImporte DATETIME NULL,  -- Cuándo se calculó
    
    -- Estado
    EstadoSincronizacion NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',  -- Pendiente, Sincronizado, Error
    FechaSincronizacion DATETIME NULL,
    MensajeError NVARCHAR(MAX) NULL,
    
    -- Control
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    
    -- Constraints
    CONSTRAINT FK_MAPPING_VACATION FOREIGN KEY (VacacionesId) REFERENCES ERP_HR_VACATION_REQUEST(Vacaciones_Id),
    CONSTRAINT FK_MAPPING_NOMINA_LINEA FOREIGN KEY (NominaLineaId) REFERENCES ERP_NOI_NOMINA_LINEAS(NominaLinea_Id),
    CONSTRAINT FK_MAPPING_NOMINA_DETALLE FOREIGN KEY (NominaDetalleId) REFERENCES ERP_NOI_NOMINA_DETALLE(ID),
    CONSTRAINT FK_MAPPING_CONCEPTO FOREIGN KEY (ConceptoId) REFERENCES ERP_NOI_CONCEPTOS(Concepto_Id),
    CONSTRAINT CK_MAPPING_STATUS CHECK (EstadoSincronizacion IN ('Pendiente', 'Sincronizado', 'Error', 'Cancelado'))
)

PRINT '✅ Tabla creada'

-- Crear índices para búsquedas rápidas
PRINT 'Creando índices...'

CREATE INDEX IX_MAPPING_VACATION_ID ON ERP_PAYROLL_LEAVE_MAPPING(VacacionesId)
CREATE INDEX IX_MAPPING_NOMINA_LINEA_ID ON ERP_PAYROLL_LEAVE_MAPPING(NominaLineaId)
CREATE INDEX IX_MAPPING_STATE ON ERP_PAYROLL_LEAVE_MAPPING(EstadoSincronizacion)
CREATE INDEX IX_MAPPING_FECHA_SYNC ON ERP_PAYROLL_LEAVE_MAPPING(FechaSincronizacion DESC)

PRINT '✅ Índices creados'

-- Crear índice compuesto para búsquedas comunes
CREATE INDEX IX_MAPPING_VACATION_STATE ON ERP_PAYROLL_LEAVE_MAPPING(VacacionesId, EstadoSincronizacion)

PRINT '✅ Índice compuesto creado'

-- Verificación final
IF OBJECT_ID('ERP_PAYROLL_LEAVE_MAPPING', 'U') IS NOT NULL
BEGIN
    PRINT ''
    PRINT '========================================================================'
    PRINT '✅ TABLA ERP_PAYROLL_LEAVE_MAPPING CREADA EXITOSAMENTE'
    PRINT '========================================================================'
    PRINT ''
    
    PRINT 'Estructura de la tabla:'
    PRINT '----------------------------------------------'
    
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CASE WHEN IS_NULLABLE = 'YES' THEN 'Sí' ELSE 'No' END AS 'Permite NULL'
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_PAYROLL_LEAVE_MAPPING'
    ORDER BY ORDINAL_POSITION
    
    PRINT ''
    PRINT '✅ Estado: LISTO PARA USAR'
    PRINT ''
END
ELSE
BEGIN
    PRINT '❌ ERROR: No se pudo crear la tabla'
END

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
