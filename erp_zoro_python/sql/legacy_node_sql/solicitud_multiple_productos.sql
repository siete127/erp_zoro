-- Tabla para detalles de productos en solicitudes de cambio de precio
-- Permite que una solicitud agrupe múltiples productos
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_SOLICITUD_PRECIO_DETALLE' AND xtype='U')
CREATE TABLE ERP_SOLICITUD_PRECIO_DETALLE (
  Detalle_Id INT IDENTITY(1,1) PRIMARY KEY,
  Solicitud_Id INT NOT NULL,
  Producto_Id INT NOT NULL,
  PrecioActual DECIMAL(18,2),
  PrecioNuevo DECIMAL(18,2) NOT NULL,
  CONSTRAINT FK_DetalleSolicitud_Solicitud FOREIGN KEY (Solicitud_Id) REFERENCES ERP_SOLICITUDES_CAMBIO_PRECIO(Solicitud_Id) ON DELETE CASCADE,
  CONSTRAINT FK_DetalleSolicitud_Producto FOREIGN KEY (Producto_Id) REFERENCES ERP_PRODUCTOS(Producto_Id)
);

-- Modificar tabla de solicitudes para hacerla más genérica (quitar campos específicos de producto)
-- NOTA: Ejecutar solo si la tabla ya existe y quieres migrar
-- ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO DROP COLUMN Producto_Id;
-- ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO DROP COLUMN PrecioActual;
-- ALTER TABLE ERP_SOLICITUDES_CAMBIO_PRECIO DROP COLUMN PrecioNuevo;
