-- FASE 4 — Logística y Ubicaciones de Almacén
-- Ejecutar en SQL Server (ERP_Zoro)

-- Tabla de ubicaciones físicas dentro de cada almacén (pasillo / estante / posición)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'ERP_ALMACEN_UBICACIONES'
)
BEGIN
    CREATE TABLE [dbo].[ERP_ALMACEN_UBICACIONES] (
        [Ubicacion_Id]  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [Almacen_Id]    INT NOT NULL REFERENCES [dbo].[ERP_ALMACENES]([Almacen_Id]),
        [Pasillo]       NVARCHAR(50)  NOT NULL,
        [Estante]       NVARCHAR(50)  NOT NULL,
        [Posicion]      NVARCHAR(50)  NULL,
        [Codigo]        NVARCHAR(100) NULL,  -- código único de la ubicación (ej. A-01-P3)
        [Activo]        BIT NOT NULL DEFAULT 1,
        [FechaCreacion] DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_ALMACEN_UBICACIONES creada.';
END
ELSE
    PRINT 'Tabla ERP_ALMACEN_UBICACIONES ya existe.';
GO

-- Columna Ubicacion en ERP_STOCK para asignar ubicación al stock
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_STOCK' AND COLUMN_NAME = 'Ubicacion_Id'
)
BEGIN
    ALTER TABLE [dbo].[ERP_STOCK]
        ADD [Ubicacion_Id] INT NULL REFERENCES [dbo].[ERP_ALMACEN_UBICACIONES]([Ubicacion_Id]);
    PRINT 'Columna Ubicacion_Id agregada a ERP_STOCK.';
END
ELSE
    PRINT 'Columna Ubicacion_Id ya existe en ERP_STOCK.';
GO
