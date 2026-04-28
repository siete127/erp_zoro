-- ============================================================
-- FASE 8 — Brechas Odoo: Mantenimiento + Portal Cliente + API Keys
-- Ejecutar contra base de datos ERP_Zoro
-- ============================================================

-- 1. MÓDULO MANTENIMIENTO

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_MANTENIMIENTO_EQUIPO' AND xtype='U')
BEGIN
    CREATE TABLE ERP_MANTENIMIENTO_EQUIPO (
        Equipo_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id       INT NOT NULL,
        Nombre           NVARCHAR(200) NOT NULL,
        Categoria        NVARCHAR(100),
        NumeroSerie      NVARCHAR(100),
        Ubicacion        NVARCHAR(200),
        Activo_Id        INT NULL,
        Responsable_Id   INT NULL,
        FechaInstalacion DATE NULL,
        Estatus          NVARCHAR(30) NOT NULL DEFAULT 'OPERATIVO',
        Notas            NVARCHAR(MAX),
        CreatedAt        DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt        DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_MANTENIMIENTO_EQUIPO creada';
END
ELSE
    PRINT 'Tabla ERP_MANTENIMIENTO_EQUIPO ya existe';

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_MANTENIMIENTO_ORDEN' AND xtype='U')
BEGIN
    CREATE TABLE ERP_MANTENIMIENTO_ORDEN (
        Orden_Id         INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id       INT NOT NULL,
        Equipo_Id        INT NOT NULL,
        Tipo             NVARCHAR(20) NOT NULL,   -- PREVENTIVO | CORRECTIVO
        Titulo           NVARCHAR(200) NOT NULL,
        Descripcion      NVARCHAR(MAX),
        Tecnico_Id       INT NULL,
        FechaProgramada  DATE NULL,
        FechaInicio      DATETIME NULL,
        FechaFin         DATETIME NULL,
        Estatus          NVARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        Costo            DECIMAL(18,2) NULL,
        CreadoPor        INT NULL,
        CreatedAt        DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt        DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_MANTENIMIENTO_ORDEN creada';
END
ELSE
    PRINT 'Tabla ERP_MANTENIMIENTO_ORDEN ya existe';

-- 2. PORTAL DE CLIENTE — token público por cliente

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_CLIENT' AND COLUMN_NAME = 'TokenPortal'
)
BEGIN
    ALTER TABLE ERP_CLIENT ADD TokenPortal UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
    PRINT 'Columna TokenPortal agregada a ERP_CLIENT';
END
ELSE
    PRINT 'Columna TokenPortal ya existe en ERP_CLIENT';

-- 3. API KEYS PARA TERCEROS

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_API_KEYS' AND xtype='U')
BEGIN
    CREATE TABLE ERP_API_KEYS (
        Key_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id  INT NOT NULL,
        Name        NVARCHAR(100) NOT NULL,
        ApiKey      NVARCHAR(100) NOT NULL,
        Scopes      NVARCHAR(500),
        IsActive    BIT NOT NULL DEFAULT 1,
        LastUsed    DATETIME NULL,
        CreatedBy   INT NULL,
        CreatedAt   DATETIME NOT NULL DEFAULT GETDATE(),
        ExpiresAt   DATETIME NULL,
        CONSTRAINT UQ_ERP_API_KEYS_ApiKey UNIQUE (ApiKey)
    );
    PRINT 'Tabla ERP_API_KEYS creada';
END
ELSE
    PRINT 'Tabla ERP_API_KEYS ya existe';

PRINT 'Fase 8 completada';
