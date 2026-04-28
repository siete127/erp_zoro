-- Tabla de precios personalizados por cliente
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_PRECIOS_CLIENTE_PRODUCTO' AND xtype='U')
CREATE TABLE ERP_PRECIOS_CLIENTE_PRODUCTO (
  PrecioCliente_Id INT IDENTITY(1,1) PRIMARY KEY,
  Cliente_Id INT NOT NULL,
  Producto_Id INT NOT NULL,
  PrecioPersonalizado DECIMAL(18,2) NOT NULL,
  Activo BIT DEFAULT 1,
  CreadoPor INT,
  FechaCreacion DATETIME DEFAULT GETDATE(),
  FechaActualizacion DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_PrecioCliente_Cliente FOREIGN KEY (Cliente_Id) REFERENCES ERP_CLIENT(Client_Id) ON DELETE CASCADE,
  CONSTRAINT FK_PrecioCliente_Producto FOREIGN KEY (Producto_Id) REFERENCES ERP_PRODUCTOS(Producto_Id) ON DELETE CASCADE,
  CONSTRAINT UK_Cliente_Producto UNIQUE (Cliente_Id, Producto_Id)
);

-- Tabla de solicitudes de cambio de precio (requiere doble aprobación)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_SOLICITUDES_CAMBIO_PRECIO' AND xtype='U')
CREATE TABLE ERP_SOLICITUDES_CAMBIO_PRECIO (
  Solicitud_Id INT IDENTITY(1,1) PRIMARY KEY,
  Cliente_Id INT NOT NULL,
  Producto_Id INT NOT NULL,
  PrecioActual DECIMAL(18,2),
  PrecioNuevo DECIMAL(18,2) NOT NULL,
  SolicitadoPor INT NOT NULL,
  EmailAprobador1 VARCHAR(255) NOT NULL,
  EmailAprobador2 VARCHAR(255) NOT NULL,
  EstadoAprobador1 VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
  EstadoAprobador2 VARCHAR(20) DEFAULT 'pendiente',
  FechaAprobador1 DATETIME,
  FechaAprobador2 DATETIME,
  Estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado, completado
  Razon VARCHAR(500),
  Venta_Id INT, -- ID de venta asociada (si aplica)
  FechaCreacion DATETIME DEFAULT GETDATE(),
  FechaCompletado DATETIME,
  CONSTRAINT FK_SolicitudPrecio_Cliente_ES FOREIGN KEY (Cliente_Id) REFERENCES ERP_CLIENT(Client_Id),
  CONSTRAINT FK_SolicitudPrecio_Producto_ES FOREIGN KEY (Producto_Id) REFERENCES ERP_PRODUCTOS(Producto_Id),
  CONSTRAINT FK_SolicitudPrecio_Usuario_ES FOREIGN KEY (SolicitadoPor) REFERENCES ERP_USERS(User_Id)
);
