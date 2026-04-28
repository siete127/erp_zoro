-- ============================================================================
-- Script para crear tabla ERP_HR_VACATION_REQUEST
-- Sistema: ERP ZORO
-- Módulo: Recursos Humanos
-- Descripción: Gestión de solicitudes de vacaciones y descansos
-- ============================================================================

-- Si la tabla ya existe, la eliminamos (comentado por defecto para seguridad)
-- DROP TABLE IF EXISTS ERP_HR_VACATION_REQUEST;

-- Crear tabla de solicitudes de vacaciones
CREATE TABLE ERP_HR_VACATION_REQUEST (
    Vacaciones_Id INT PRIMARY KEY IDENTITY(1,1),
    
    -- Relación
    User_Id INT NOT NULL,
    
    -- Fechas de la solicitud
    FechaInicio DATETIME NOT NULL,
    FechaFin DATETIME NOT NULL,
    Cantidad INT NOT NULL,  -- Número de días
    
    -- Información
    Razon NVARCHAR(255) NULL,  -- Razón del descanso (vacaciones, asuntos personales, etc.)
    Observaciones NVARCHAR(MAX) NULL,  -- Observaciones adicionales
    
    -- Aprobación
    Estatus NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',  -- Pendiente, Aprobado, Rechazado
    AprobadoPor INT NULL,  -- User_Id del que aprobó
    FechaAprobacion DATETIME NULL,  -- Fecha de aprobación/rechazo
    
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
    CONSTRAINT CK_VACATION_CANTIDAD CHECK (Cantidad > 0),
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IX_VACATION_USER_ID ON ERP_HR_VACATION_REQUEST(User_Id);
CREATE INDEX IX_VACATION_STATUS ON ERP_HR_VACATION_REQUEST(Estatus);
CREATE INDEX IX_VACATION_DATE_RANGE ON ERP_HR_VACATION_REQUEST(FechaInicio, FechaFin);
CREATE INDEX IX_VACATION_CREATED_AT ON ERP_HR_VACATION_REQUEST(CreatedAt DESC);

-- ============================================================================
-- Datos de prueba (COMENTADO - descomentar solo para desarrollo)
-- ============================================================================

/*
-- Insertar solicitud de prueba
INSERT INTO ERP_HR_VACATION_REQUEST 
(User_Id, FechaInicio, FechaFin, Cantidad, Razon, Observaciones, Estatus, CreatedBy)
VALUES 
(1, '2026-05-01', '2026-05-10', 10, 'Vacaciones de verano', 'Viajando con familia', 'Pendiente', 1);

-- Ver solicitudes
SELECT * FROM ERP_HR_VACATION_REQUEST ORDER BY CreatedAt DESC;

-- Ver con detalles del usuario
SELECT 
    v.Vacaciones_Id, 
    v.User_Id, 
    u.Name, 
    u.Lastname, 
    v.FechaInicio, 
    v.FechaFin, 
    v.Cantidad,
    v.Razon,
    v.Estatus,
    v.CreatedAt
FROM ERP_HR_VACATION_REQUEST v
LEFT JOIN ERP_USERS u ON v.User_Id = u.User_Id
ORDER BY v.CreatedAt DESC;
*/

-- ============================================================================
-- Verificar estructura
-- ============================================================================

-- Mostrar la estructura de la tabla
-- sp_help 'ERP_HR_VACATION_REQUEST';

-- ============================================================================
-- Fin del script
-- ============================================================================
