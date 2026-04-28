-- Tabla de Notas de Crédito
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_NOTAS_CREDITO' AND xtype='U')
CREATE TABLE ERP_NOTAS_CREDITO (
  NotaCredito_Id INT IDENTITY(1,1) PRIMARY KEY,
  Factura_Id INT NOT NULL,
  Company_Id INT NOT NULL,
  UUID VARCHAR(50),
  FacturamaId VARCHAR(50),
  Serie VARCHAR(10),
  Folio VARCHAR(20),
  Motivo VARCHAR(500),
  Subtotal DECIMAL(18,2) DEFAULT 0,
  IVA DECIMAL(18,2) DEFAULT 0,
  Total DECIMAL(18,2) DEFAULT 0,
  Moneda VARCHAR(3) DEFAULT 'MXN',
  Status VARCHAR(20) DEFAULT 'Vigente',
  FechaTimbrado DATETIME,
  CreadoPor VARCHAR(50),
  FechaCreacion DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_NotaCredito_Factura FOREIGN KEY (Factura_Id) REFERENCES ERP_FACTURAS(Factura_Id),
  CONSTRAINT FK_NotaCredito_Company FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
);

-- Tabla de Detalle de Notas de Crédito
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_NOTA_CREDITO_DETALLE' AND xtype='U')
CREATE TABLE ERP_NOTA_CREDITO_DETALLE (
  Detalle_Id INT IDENTITY(1,1) PRIMARY KEY,
  NotaCredito_Id INT NOT NULL,
  Producto_Id INT,
  Descripcion VARCHAR(500),
  Cantidad DECIMAL(18,2),
  PrecioUnitario DECIMAL(18,2),
  Subtotal DECIMAL(18,2),
  IVA DECIMAL(18,2),
  Total DECIMAL(18,2),
  CONSTRAINT FK_NotaCreditoDetalle_NotaCredito FOREIGN KEY (NotaCredito_Id) REFERENCES ERP_NOTAS_CREDITO(NotaCredito_Id) ON DELETE CASCADE
);

-- Tabla de Complementos de Pago
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_COMPLEMENTOS_PAGO' AND xtype='U')
CREATE TABLE ERP_COMPLEMENTOS_PAGO (
  ComplementoPago_Id INT IDENTITY(1,1) PRIMARY KEY,
  Company_Id INT NOT NULL,
  UUID VARCHAR(50),
  FacturamaId VARCHAR(50),
  Serie VARCHAR(10),
  Folio VARCHAR(20),
  FechaPago DATETIME NOT NULL,
  FormaPago VARCHAR(10) NOT NULL, -- 01=Efectivo, 02=Cheque, 03=Transferencia, etc
  Moneda VARCHAR(3) DEFAULT 'MXN',
  TipoCambio DECIMAL(18,6) DEFAULT 1,
  Monto DECIMAL(18,2) NOT NULL,
  NumOperacion VARCHAR(100),
  RfcEmisorCtaOrd VARCHAR(13),
  NomBancoOrdExt VARCHAR(300),
  CtaOrdenante VARCHAR(50),
  RfcEmisorCtaBen VARCHAR(13),
  CtaBeneficiario VARCHAR(50),
  Status VARCHAR(20) DEFAULT 'Vigente',
  FechaTimbrado DATETIME,
  CreadoPor VARCHAR(50),
  FechaCreacion DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_ComplementoPago_Company FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
);

-- Tabla de Relación Complemento-Factura (un complemento puede pagar varias facturas)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_COMPLEMENTO_FACTURA' AND xtype='U')
CREATE TABLE ERP_COMPLEMENTO_FACTURA (
  Relacion_Id INT IDENTITY(1,1) PRIMARY KEY,
  ComplementoPago_Id INT NOT NULL,
  Factura_Id INT NOT NULL,
  MontoPagado DECIMAL(18,2) NOT NULL,
  NumParcialidad INT DEFAULT 1,
  SaldoAnterior DECIMAL(18,2),
  SaldoInsoluto DECIMAL(18,2),
  CONSTRAINT FK_ComplementoFactura_Complemento FOREIGN KEY (ComplementoPago_Id) REFERENCES ERP_COMPLEMENTOS_PAGO(ComplementoPago_Id) ON DELETE CASCADE,
  CONSTRAINT FK_ComplementoFactura_Factura FOREIGN KEY (Factura_Id) REFERENCES ERP_FACTURAS(Factura_Id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IX_NotasCredito_Factura ON ERP_NOTAS_CREDITO(Factura_Id);
CREATE INDEX IX_NotasCredito_Status ON ERP_NOTAS_CREDITO(Status);
CREATE INDEX IX_ComplementosPago_Status ON ERP_COMPLEMENTOS_PAGO(Status);
CREATE INDEX IX_ComplementoFactura_Factura ON ERP_COMPLEMENTO_FACTURA(Factura_Id);

PRINT 'Esquema de Notas de Crédito y Complementos de Pago creado exitosamente';
