-- Script para agregar columnas faltantes a ERP_VENTAS
USE [ERP]
GO

-- Verificar si las columnas existen antes de agregarlas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ERP_VENTAS]') AND name = 'ClienteRFC')
BEGIN
    ALTER TABLE [dbo].[ERP_VENTAS]
    ADD ClienteRFC VARCHAR(13) NULL;
    PRINT 'Columna ClienteRFC agregada';
END
ELSE
BEGIN
    PRINT 'Columna ClienteRFC ya existe';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ERP_VENTAS]') AND name = 'ClienteNombre')
BEGIN
    ALTER TABLE [dbo].[ERP_VENTAS]
    ADD ClienteNombre VARCHAR(255) NULL;
    PRINT 'Columna ClienteNombre agregada';
END
ELSE
BEGIN
    PRINT 'Columna ClienteNombre ya existe';
END
GO

-- Verificar estructura final
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ERP_VENTAS'
ORDER BY ORDINAL_POSITION;
GO
