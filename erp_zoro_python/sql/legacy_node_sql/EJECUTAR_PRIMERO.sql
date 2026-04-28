-- ============================================
-- EJECUTAR ESTE SCRIPT PRIMERO
-- Script para habilitar solicitudes múltiples
-- ============================================

-- 1. Crear tabla de detalles si no existe
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_SOLICITUD_PRECIO_DETALLE' AND xtype='U')
BEGIN
  CREATE TABLE ERP_SOLICITUD_PRECIO_DETALLE (
    Detalle_Id INT IDENTITY(1,1) PRIMARY KEY,
    Solicitud_Id INT NOT NULL,
    Producto_Id INT NOT NULL,
    PrecioActual DECIMAL(18,2),
    PrecioNuevo DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_DetalleSolicitud_Solicitud FOREIGN KEY (Solicitud_Id) 
      REFERENCES ERP_SOLICITUDES_CAMBIO_PRECIO(Solicitud_Id) ON DELETE CASCADE,
    CONSTRAINT FK_DetalleSolicitud_Producto FOREIGN KEY (Producto_Id) 
      REFERENCES ERP_PRODUCTOS(Producto_Id)
  );
  PRINT '✓ Tabla ERP_SOLICITUD_PRECIO_DETALLE creada';
END
ELSE
BEGIN
  PRINT '✓ Tabla ERP_SOLICITUD_PRECIO_DETALLE ya existe';
END
GO

-- 2. Hacer columnas opcionales en tabla principal
PRINT 'Modificando columnas para soportar solicitudes múltiples...';

-- Eliminar constraint de foreign key si existe
DECLARE @ConstraintName nvarchar(200)
SELECT @ConstraintName = name
FROM sys.foreign_keys
WHERE parent_object_id = OBJECT_ID('ERP_SOLICITUDES_CAMBIO_PRECIO')
  AND referenced_object_id = OBJECT_ID('ERP_PRODUCTOS')

IF @ConstraintName IS NOT NULL
BEGIN
  EXEC('ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO DROP CONSTRAINT ' + @ConstraintName)
  PRINT '✓ Foreign key constraint eliminada'
END

-- Hacer columnas nullable
ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
ALTER COLUMN Producto_Id INT NULL;

ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
ALTER COLUMN PrecioActual DECIMAL(18,2) NULL;

ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
ALTER COLUMN PrecioNuevo DECIMAL(18,2) NULL;

PRINT '✓ Columnas ahora son opcionales';
GO

PRINT '';
PRINT '============================================';
PRINT 'Migración completada exitosamente';
PRINT 'Ahora puedes reiniciar el backend';
PRINT '============================================';
