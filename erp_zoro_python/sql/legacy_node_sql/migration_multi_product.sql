-- Migración para soportar solicitudes de cambio de precio con múltiples productos
-- Mantiene compatibilidad con solicitudes individuales existentes

-- 1. Crear tabla de detalles de productos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_SOLICITUD_PRECIO_DETALLE' AND xtype='U')
BEGIN
  CREATE TABLE ERP_SOLICITUD_PRECIO_DETALLE (
    Detalle_Id INT IDENTITY(1,1) PRIMARY KEY,
    Solicitud_Id INT NOT NULL,
    Producto_Id INT NOT NULL,
    PrecioActual DECIMAL(18,2),
    PrecioNuevo DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_DetalleSolicitud_Solicitud FOREIGN KEY (Solicitud_Id) REFERENCES ERP_SOLICITUDES_CAMBIO_PRECIO(Solicitud_Id) ON DELETE CASCADE,
    CONSTRAINT FK_DetalleSolicitud_Producto FOREIGN KEY (Producto_Id) REFERENCES ERP_PRODUCTOS(Producto_Id)
  );
  
  PRINT 'Tabla ERP_SOLICITUD_PRECIO_DETALLE creada exitosamente';
END
ELSE
BEGIN
  PRINT 'Tabla ERP_SOLICITUD_PRECIO_DETALLE ya existe';
END
GO

-- 2. Migrar datos existentes a la nueva tabla de detalles
-- Solo si hay solicitudes existentes con Producto_Id no nulo
IF EXISTS (SELECT * FROM ERP_SOLICITUDES_CAMBIO_PRECIO WHERE Producto_Id IS NOT NULL)
BEGIN
  INSERT INTO ERP_SOLICITUD_PRECIO_DETALLE (Solicitud_Id, Producto_Id, PrecioActual, PrecioNuevo)
  SELECT 
    Solicitud_Id,
    Producto_Id,
    PrecioActual,
    PrecioNuevo
  FROM ERP_SOLICITUDES_CAMBIO_PRECIO
  WHERE Producto_Id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ERP_SOLICITUD_PRECIO_DETALLE d 
      WHERE d.Solicitud_Id = ERP_SOLICITUDES_CAMBIO_PRECIO.Solicitud_Id
    );
  
  PRINT 'Datos migrados a ERP_SOLICITUD_PRECIO_DETALLE';
END
GO

-- 3. Hacer opcionales las columnas de producto en la tabla principal
-- (Mantener por compatibilidad, pero ahora son opcionales)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'ERP_SOLICITUDES_CAMBIO_PRECIO' 
           AND COLUMN_NAME = 'Producto_Id' 
           AND IS_NULLABLE = 'NO')
BEGIN
  -- Primero eliminar la constraint de foreign key si existe
  DECLARE @ConstraintName nvarchar(200)
  SELECT @ConstraintName = CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE
  WHERE TABLE_NAME = 'ERP_SOLICITUDES_CAMBIO_PRECIO' 
    AND COLUMN_NAME = 'Producto_Id'
    AND CONSTRAINT_NAME LIKE 'FK_%'
  
  IF @ConstraintName IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO DROP CONSTRAINT ' + @ConstraintName)
    PRINT 'Foreign key constraint eliminada: ' + @ConstraintName
  END
  
  -- Hacer la columna nullable
  ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
  ALTER COLUMN Producto_Id INT NULL;
  
  ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
  ALTER COLUMN PrecioActual DECIMAL(18,2) NULL;
  
  ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO 
  ALTER COLUMN PrecioNuevo DECIMAL(18,2) NULL;
  
  PRINT 'Columnas Producto_Id, PrecioActual y PrecioNuevo ahora son opcionales';
END
GO

PRINT 'Migración completada exitosamente';
PRINT 'El sistema ahora soporta solicitudes con múltiples productos';
PRINT 'Las solicitudes existentes se mantienen compatibles';
