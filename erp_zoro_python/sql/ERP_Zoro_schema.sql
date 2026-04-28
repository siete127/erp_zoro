IF DB_ID(N'ERP_Zoro') IS NULL CREATE DATABASE [ERP_Zoro];
GO
USE [ERP_Zoro];
GO
IF OBJECT_ID(N'[dbo].[ERP_ACCOUNTS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ACCOUNTS];
CREATE TABLE [dbo].[ERP_ACCOUNTS] (
    [Account_Id] INT IDENTITY(1,1) NOT NULL,
    [AccountCode] VARCHAR(50) NOT NULL,
    [Name] VARCHAR(255) NOT NULL,
    [Type] VARCHAR(50) NULL,
    [ParentAccount] VARCHAR(50) NULL,
    [Company_Id] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_ALMACENES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ALMACENES];
CREATE TABLE [dbo].[ERP_ALMACENES] (
    [Almacen_Id] INT IDENTITY(1,1) NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Codigo] VARCHAR(50) NULL,
    [Direccion] VARCHAR(255) NULL,
    [Activo] BIT DEFAULT ((1)) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL,
    [Company_Id] INT NULL,
    [clave_producto] VARCHAR(50) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_AUDIT_LOGS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_AUDIT_LOGS];
CREATE TABLE [dbo].[ERP_AUDIT_LOGS] (
    [id] BIGINT IDENTITY(1,1) NOT NULL,
    [usuario_id] INT NULL,
    [empresa_id] INT NULL,
    [accion] VARCHAR(50) NOT NULL,
    [modulo] VARCHAR(100) NOT NULL,
    [fecha] DATETIME DEFAULT (getdate()) NOT NULL,
    [detalle] NVARCHAR(MAX) NULL,
    [ip] VARCHAR(50) NULL,
    [user_agent] NVARCHAR(500) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_BOM]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_BOM];
CREATE TABLE [dbo].[ERP_BOM] (
    [BOM_Id] INT IDENTITY(1,1) NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [CodigoBOM] NVARCHAR(50) NOT NULL,
    [Descripcion] NVARCHAR(255) NULL,
    [Version] INT DEFAULT ((1)) NOT NULL,
    [Vigente] BIT DEFAULT ((1)) NOT NULL,
    [MermaPct] DECIMAL(5, 2) DEFAULT ((0)) NOT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_BOM_MATERIALES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_BOM_MATERIALES];
CREATE TABLE [dbo].[ERP_BOM_MATERIALES] (
    [BOM_Material_Id] INT IDENTITY(1,1) NOT NULL,
    [BOM_Id] INT NOT NULL,
    [MateriaPrima_Id] INT NOT NULL,
    [CantidadTeorica] DECIMAL(18, 6) NOT NULL,
    [TipoComponente] NVARCHAR(50) NOT NULL,
    [MermaPct] DECIMAL(5, 2) DEFAULT ((0)) NOT NULL,
    [Notas] NVARCHAR(255) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_BOM_OPERACIONES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_BOM_OPERACIONES];
CREATE TABLE [dbo].[ERP_BOM_OPERACIONES] (
    [BOM_Operacion_Id] INT IDENTITY(1,1) NOT NULL,
    [BOM_Id] INT NOT NULL,
    [TipoCosto] NVARCHAR(50) NOT NULL,
    [CostoPorUnidad] DECIMAL(18, 6) DEFAULT ((0)) NOT NULL,
    [MinutosPorUnidad] DECIMAL(18, 6) NULL,
    [CostoHoraReferencia] DECIMAL(18, 6) NULL,
    [Notas] NVARCHAR(255) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CALIDAD_ALERTA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CALIDAD_ALERTA];
CREATE TABLE [dbo].[ERP_CALIDAD_ALERTA] (
    [CalidadAlerta_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Motivo] NVARCHAR(200) NOT NULL,
    [Severidad] NVARCHAR(20) DEFAULT ('MEDIA') NOT NULL,
    [CantidadSugerida] DECIMAL(18, 2) NULL,
    [RequiereOP] BIT DEFAULT ((1)) NOT NULL,
    [OP_Generada_Id] INT NULL,
    [Estatus] NVARCHAR(20) DEFAULT ('ABIERTA') NOT NULL,
    [FechaAlerta] DATETIME DEFAULT (getdate()) NOT NULL,
    [FechaCierre] DATETIME NULL,
    [Observaciones] NVARCHAR(1000) NULL,
    [CreatedBy] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CATALOGO_FORMA_PAGO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CATALOGO_FORMA_PAGO];
CREATE TABLE [dbo].[ERP_CATALOGO_FORMA_PAGO] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [clave] VARCHAR(10) NOT NULL,
    [descripcion] NVARCHAR(150) NOT NULL,
    [activo] BIT DEFAULT ((1)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CATALOGO_MOTIVO_CANCELACION]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CATALOGO_MOTIVO_CANCELACION];
CREATE TABLE [dbo].[ERP_CATALOGO_MOTIVO_CANCELACION] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [clave] VARCHAR(5) NOT NULL,
    [descripcion] NVARCHAR(255) NOT NULL,
    [activo] BIT DEFAULT ((1)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENT]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENT];
CREATE TABLE [dbo].[ERP_CLIENT] (
    [Client_Id] INT IDENTITY(1,1) NOT NULL,
    [LegalName] VARCHAR(255) NOT NULL,
    [CommercialName] VARCHAR(255) NULL,
    [RFC] VARCHAR(20) NOT NULL,
    [TaxRegime] VARCHAR(100) NULL,
    [ClientType] VARCHAR(20) NOT NULL,
    [Status] VARCHAR(20) DEFAULT ('ACTIVO') NOT NULL,
    [CreatedAt] DATETIME2(7) DEFAULT (sysdatetime()) NOT NULL,
    [UpdatedAt] DATETIME2(7) NULL,
    [rfc_validado] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENT_RECURRING_PRODUCTS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS];
CREATE TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS] (
    [RecurringProduct_Id] INT IDENTITY(1,1) NOT NULL,
    [Client_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENTADRESSES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENTADRESSES];
CREATE TABLE [dbo].[ERP_CLIENTADRESSES] (
    [Address_Id] INT IDENTITY(1,1) NOT NULL,
    [Client_Id] INT NOT NULL,
    [AddressType] VARCHAR(20) NOT NULL,
    [Street] VARCHAR(255) NOT NULL,
    [City] VARCHAR(150) NOT NULL,
    [State] VARCHAR(150) NOT NULL,
    [PostalCode] VARCHAR(10) NOT NULL,
    [Country] VARCHAR(150) DEFAULT ('MEXICO') NOT NULL,
    [IsPrimary] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENTCOMPANIES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENTCOMPANIES];
CREATE TABLE [dbo].[ERP_CLIENTCOMPANIES] (
    [ClientCompany_Id] INT IDENTITY(1,1) NOT NULL,
    [Client_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENTCONTACTS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENTCONTACTS];
CREATE TABLE [dbo].[ERP_CLIENTCONTACTS] (
    [Contact_Id] INT IDENTITY(1,1) NOT NULL,
    [Client_Id] INT NOT NULL,
    [FullName] VARCHAR(150) NOT NULL,
    [PhoneNumber] VARCHAR(25) NULL,
    [MobileNumber] VARCHAR(25) NULL,
    [Email] VARCHAR(150) NULL,
    [SecondaryEmail] VARCHAR(150) NULL,
    [IsPrimary] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CLIENTFINANCIALSETTINGS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CLIENTFINANCIALSETTINGS];
CREATE TABLE [dbo].[ERP_CLIENTFINANCIALSETTINGS] (
    [Client_Id] INT NOT NULL,
    [HasCredit] BIT DEFAULT ((0)) NOT NULL,
    [CreditLimit] DECIMAL(18, 2) NULL,
    [CreditDays] INT NULL,
    [Currency] VARCHAR(10) DEFAULT ('MXN') NOT NULL,
    [PaymentMethod] VARCHAR(50) NULL,
    [PaymentForm] VARCHAR(50) NULL,
    [CreditStatus] VARCHAR(20) DEFAULT ('AL_CORRIENTE') NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COI_CATALOGO_FISCAL]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COI_CATALOGO_FISCAL];
CREATE TABLE [dbo].[ERP_COI_CATALOGO_FISCAL] (
    [CatalogoFiscal_Id] INT IDENTITY(1,1) NOT NULL,
    [Cuenta_Id] INT NOT NULL,
    [CodigoAgrupador] NVARCHAR(20) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COI_CUENTAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COI_CUENTAS];
CREATE TABLE [dbo].[ERP_COI_CUENTAS] (
    [Cuenta_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Codigo] NVARCHAR(50) NOT NULL,
    [Nombre] NVARCHAR(200) NOT NULL,
    [Tipo] NVARCHAR(30) NOT NULL,
    [Nivel] INT NOT NULL,
    [Padre_Id] INT NULL,
    [Activa] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COI_PERIODOS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COI_PERIODOS];
CREATE TABLE [dbo].[ERP_COI_PERIODOS] (
    [Periodo_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Anio] INT NOT NULL,
    [Mes] INT NOT NULL,
    [Cerrado] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COI_POLIZA_LINEAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COI_POLIZA_LINEAS];
CREATE TABLE [dbo].[ERP_COI_POLIZA_LINEAS] (
    [PolizaLinea_Id] INT IDENTITY(1,1) NOT NULL,
    [Poliza_Id] INT NOT NULL,
    [Cuenta_Id] INT NOT NULL,
    [Descripcion] NVARCHAR(300) NULL,
    [Debe] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Haber] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Referencia] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COI_POLIZAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COI_POLIZAS];
CREATE TABLE [dbo].[ERP_COI_POLIZAS] (
    [Poliza_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Tipo] NVARCHAR(30) NOT NULL,
    [Fecha] DATE NOT NULL,
    [Concepto] NVARCHAR(500) NOT NULL,
    [Estatus] NVARCHAR(20) DEFAULT ('BORRADOR') NOT NULL,
    [CreatedBy] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPANY]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPANY];
CREATE TABLE [dbo].[ERP_COMPANY] (
    [Company_Id] INT IDENTITY(1,1) NOT NULL,
    [NameCompany] VARCHAR(255) NOT NULL,
    [Status] VARCHAR(50) NOT NULL,
    [RFC] VARCHAR(13) NULL,
    [LegalName] VARCHAR(255) NULL,
    [FiscalRegime] VARCHAR(10) NULL,
    [TaxZipCode] VARCHAR(5) NULL,
    [EmailAprobacion1] VARCHAR(250) NULL,
    [EmailAprobacion2] VARCHAR(250) NULL,
    [CsdCargado] BIT DEFAULT ((0)) NOT NULL,
    [Email] NVARCHAR(200) NULL,
    [CsdPassword] NVARCHAR(100) NULL,
    [LogoUrl] VARCHAR(500) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPLEMENTO_FACTURA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPLEMENTO_FACTURA];
CREATE TABLE [dbo].[ERP_COMPLEMENTO_FACTURA] (
    [Relacion_Id] INT IDENTITY(1,1) NOT NULL,
    [ComplementoPago_Id] INT NOT NULL,
    [Factura_Id] INT NOT NULL,
    [MontoPagado] DECIMAL(18, 2) NOT NULL,
    [NumParcialidad] INT DEFAULT ((1)) NULL,
    [SaldoAnterior] DECIMAL(18, 2) NULL,
    [SaldoInsoluto] DECIMAL(18, 2) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPLEMENTOS_PAGO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPLEMENTOS_PAGO];
CREATE TABLE [dbo].[ERP_COMPLEMENTOS_PAGO] (
    [ComplementoPago_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [UUID] VARCHAR(50) NULL,
    [FacturamaId] VARCHAR(50) NULL,
    [Serie] VARCHAR(10) NULL,
    [Folio] VARCHAR(20) NULL,
    [FechaPago] DATETIME NOT NULL,
    [FormaPago] VARCHAR(10) NOT NULL,
    [Moneda] VARCHAR(3) DEFAULT ('MXN') NULL,
    [TipoCambio] DECIMAL(18, 6) DEFAULT ((1)) NULL,
    [Monto] DECIMAL(18, 2) NOT NULL,
    [NumOperacion] VARCHAR(100) NULL,
    [RfcEmisorCtaOrd] VARCHAR(13) NULL,
    [NomBancoOrdExt] VARCHAR(300) NULL,
    [CtaOrdenante] VARCHAR(50) NULL,
    [RfcEmisorCtaBen] VARCHAR(13) NULL,
    [CtaBeneficiario] VARCHAR(50) NULL,
    [Status] VARCHAR(20) DEFAULT ('Vigente') NULL,
    [FechaTimbrado] DATETIME NULL,
    [CreadoPor] VARCHAR(50) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL,
    [UUIDFacturaExt] VARCHAR(50) NULL,
    [EsExterno] BIT DEFAULT ((0)) NOT NULL,
    [SerieFacturaExt] VARCHAR(10) NULL,
    [FolioFacturaExt] VARCHAR(20) NULL,
    [TotalFacturaExt] DECIMAL(18, 2) NULL,
    [NumParcialidad] INT NULL,
    [SaldoAnterior] DECIMAL(18, 2) NULL,
    [SaldoInsoluto] DECIMAL(18, 2) NULL,
    [RfcReceptorExt] VARCHAR(13) NULL,
    [NombreReceptorExt] VARCHAR(300) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPRA_AUTORIZACION]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPRA_AUTORIZACION];
CREATE TABLE [dbo].[ERP_COMPRA_AUTORIZACION] (
    [OC_Autorizacion_Id] INT IDENTITY(1,1) NOT NULL,
    [OC_Id] INT NOT NULL,
    [Nivel] INT NOT NULL,
    [User_Id] INT NULL,
    [Aprobado] BIT NOT NULL,
    [FechaDecision] DATETIME DEFAULT (getdate()) NOT NULL,
    [Comentarios] NVARCHAR(500) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPRA_ORDEN]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPRA_ORDEN];
CREATE TABLE [dbo].[ERP_COMPRA_ORDEN] (
    [OC_Id] INT IDENTITY(1,1) NOT NULL,
    [NumeroOC] NVARCHAR(50) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Proveedor_Id] INT NOT NULL,
    [FechaOC] DATETIME DEFAULT (getdate()) NOT NULL,
    [FechaRequerida] DATETIME NULL,
    [Moneda] NVARCHAR(3) DEFAULT ('MXN') NOT NULL,
    [Subtotal] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [IVA] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Total] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Estatus] NVARCHAR(30) DEFAULT ('BORRADOR') NOT NULL,
    [RequiereDobleAutorizacion] BIT DEFAULT ((1)) NOT NULL,
    [FacturaReferencia] NVARCHAR(100) NULL,
    [PDFUrl] NVARCHAR(500) NULL,
    [Observaciones] NVARCHAR(1000) NULL,
    [CreatedBy] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [FacturaArchivoUrl] NVARCHAR(500) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPRA_ORDEN_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE];
CREATE TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE] (
    [OC_Detalle_Id] INT IDENTITY(1,1) NOT NULL,
    [OC_Id] INT NOT NULL,
    [Producto_Id] INT NULL,
    [MateriaPrima_Id] INT NULL,
    [Descripcion] NVARCHAR(300) NOT NULL,
    [Cantidad] DECIMAL(18, 4) NOT NULL,
    [PrecioCompra] DECIMAL(18, 6) NOT NULL,
    [Subtotal] DECIMAL(18, 2) NOT NULL,
    [IVA] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Total] DECIMAL(18, 2) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPRA_RECEPCION]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPRA_RECEPCION];
CREATE TABLE [dbo].[ERP_COMPRA_RECEPCION] (
    [Recepcion_Id] INT IDENTITY(1,1) NOT NULL,
    [OC_Id] INT NOT NULL,
    [FechaRecepcion] DATETIME DEFAULT (getdate()) NOT NULL,
    [Almacen_Id] INT NOT NULL,
    [Observaciones] NVARCHAR(500) NULL,
    [RecibidoPor] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COMPRA_RECEPCION_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE];
CREATE TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] (
    [RecepcionDetalle_Id] INT IDENTITY(1,1) NOT NULL,
    [Recepcion_Id] INT NOT NULL,
    [OC_Detalle_Id] INT NOT NULL,
    [Producto_Id] INT NULL,
    [MateriaPrima_Id] INT NULL,
    [Descripcion] NVARCHAR(300) NOT NULL,
    [CantidadOrdenada] DECIMAL(18, 4) NOT NULL,
    [CantidadRecibida] DECIMAL(18, 4) NOT NULL,
    [PrecioCompra] DECIMAL(18, 6) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CONFIG_COSTOS_PTC]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CONFIG_COSTOS_PTC];
CREATE TABLE [dbo].[ERP_CONFIG_COSTOS_PTC] (
    [Config_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [MermaPctDefault] DECIMAL(5, 2) DEFAULT ((0)) NOT NULL,
    [CostoHoraManoObra] DECIMAL(18, 6) NULL,
    [CostoHoraMaquina] DECIMAL(18, 6) NULL,
    [PorcentajeIndirectos] DECIMAL(5, 2) NULL,
    [MargenVerdeMin] DECIMAL(5, 2) DEFAULT ((25)) NOT NULL,
    [MargenAmarilloMin] DECIMAL(5, 2) DEFAULT ((15)) NOT NULL,
    [MargenRojoMax] DECIMAL(5, 2) DEFAULT ((15)) NOT NULL,
    [DiasVigenciaDefault] INT DEFAULT ((15)) NOT NULL,
    [RequiereOverrideBajoMargen] BIT DEFAULT ((1)) NOT NULL,
    [HabilitarBloqueoMorosidad] BIT DEFAULT ((0)) NOT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COSTEO_MENSUAL]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COSTEO_MENSUAL];
CREATE TABLE [dbo].[ERP_COSTEO_MENSUAL] (
    [CosteoMensual_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Anio] INT NOT NULL,
    [Mes] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [CostoMaterial] DECIMAL(18, 4) DEFAULT ((0)) NOT NULL,
    [CostoOperacion] DECIMAL(18, 4) DEFAULT ((0)) NOT NULL,
    [FactorDesperdicio] DECIMAL(18, 6) DEFAULT ((0)) NOT NULL,
    [FactorProductividad] DECIMAL(18, 6) DEFAULT ((1)) NOT NULL,
    [MermaPctReal] DECIMAL(18, 6) DEFAULT ((0)) NOT NULL,
    [CostoUnitarioFinal] DECIMAL(18, 4) DEFAULT ((0)) NOT NULL,
    [Notas] NVARCHAR(500) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreatedBy] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COTIZACION_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COTIZACION_DETALLE];
CREATE TABLE [dbo].[ERP_COTIZACION_DETALLE] (
    [ID_DETALLE] INT IDENTITY(1,1) NOT NULL,
    [ID_COTIZACION] INT NOT NULL,
    [ID_PRODUCTO] INT NOT NULL,
    [CANTIDAD] INT NOT NULL,
    [PRECIO_UNITARIO] DECIMAL(18, 2) NOT NULL,
    [SUBTOTAL] DECIMAL(18, 2) NOT NULL,
    [TipoProducto] NVARCHAR(20) NULL,
    [SKU] NVARCHAR(50) NULL,
    [Descripcion] NVARCHAR(500) NULL,
    [UnidadVenta] NVARCHAR(20) NULL,
    [COSTO_UNITARIO] DECIMAL(18, 6) NULL,
    [IVA] DECIMAL(18, 2) NULL,
    [TOTAL] DECIMAL(18, 2) NULL,
    [UTILIDAD] DECIMAL(18, 2) NULL,
    [MARGEN_PCT] DECIMAL(5, 2) NULL,
    [DatosPTC_JSON] NVARCHAR(MAX) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COTIZACION_STATUS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COTIZACION_STATUS];
CREATE TABLE [dbo].[ERP_COTIZACION_STATUS] (
    [Id_Status] INT IDENTITY(1,1) NOT NULL,
    [Nombre] VARCHAR(50) NOT NULL,
    [Descripcion] VARCHAR(250) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_COTIZACIONES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_COTIZACIONES];
CREATE TABLE [dbo].[ERP_COTIZACIONES] (
    [ID_COTIZACION] INT IDENTITY(1,1) NOT NULL,
    [Client_Id] INT NULL,
    [FECHA] DATETIME NULL,
    [MONEDA] VARCHAR(10) NULL,
    [CONDICIONES_PAGO] VARCHAR(100) NULL,
    [ESTATUS] VARCHAR(50) NULL,
    [TOTAL] DECIMAL(18, 2) NULL,
    [Company_Id] INT NULL,
    [ClienteRFC] NVARCHAR(20) NULL,
    [ClienteNombre] NVARCHAR(255) NULL,
    [EmpresaCodigo] NVARCHAR(20) NULL,
    [Subtotal] DECIMAL(18, 2) NULL,
    [IVA] DECIMAL(18, 2) NULL,
    [CostoTotal] DECIMAL(18, 2) NULL,
    [UtilidadBruta] DECIMAL(18, 2) NULL,
    [MargenPorc] DECIMAL(5, 2) NULL,
    [Status] NVARCHAR(50) NULL,
    [Vendedor] NVARCHAR(200) NULL,
    [CondicionesPago] NVARCHAR(200) NULL,
    [ComentarioDescuento] NVARCHAR(500) NULL,
    [FechaCreacion] DATETIME NULL,
    [FechaVigencia] DATETIME NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CRM_ACTIVIDADES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CRM_ACTIVIDADES];
CREATE TABLE [dbo].[ERP_CRM_ACTIVIDADES] (
    [Actividad_Id] INT IDENTITY(1,1) NOT NULL,
    [Oportunidad_Id] INT NOT NULL,
    [Tipo] NVARCHAR(50) NOT NULL,
    [Titulo] NVARCHAR(200) NOT NULL,
    [Descripcion] NVARCHAR(MAX) NULL,
    [FechaProgramada] DATETIME NULL,
    [FechaReal] DATETIME NULL,
    [Resultado] NVARCHAR(255) NULL,
    [Usuario_Id] INT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [Completada] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CRM_ETAPA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CRM_ETAPA];
CREATE TABLE [dbo].[ERP_CRM_ETAPA] (
    [Etapa_Id] INT IDENTITY(1,1) NOT NULL,
    [Nombre] NVARCHAR(100) NOT NULL,
    [Descripcion] NVARCHAR(255) NULL,
    [Orden] INT NOT NULL,
    [Activo] BIT DEFAULT ((1)) NOT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_CRM_OPORTUNIDADES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_CRM_OPORTUNIDADES];
CREATE TABLE [dbo].[ERP_CRM_OPORTUNIDADES] (
    [Oportunidad_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Client_Id] INT NULL,
    [Etapa_Id] INT NOT NULL,
    [NombreOportunidad] NVARCHAR(200) NOT NULL,
    [MontoEstimado] DECIMAL(18, 2) NULL,
    [Moneda] NVARCHAR(3) DEFAULT ('MXN') NOT NULL,
    [Probabilidad] INT NULL,
    [Origen] NVARCHAR(100) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [FechaCierreEstimada] DATETIME NULL,
    [FechaCierreReal] DATETIME NULL,
    [Status] NVARCHAR(50) DEFAULT ('Abierta') NOT NULL,
    [ID_COTIZACION] INT NULL,
    [Venta_Id] INT NULL,
    [Notas] NVARCHAR(MAX) NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_FACTURA_STATUS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_FACTURA_STATUS];
CREATE TABLE [dbo].[ERP_FACTURA_STATUS] (
    [Id_Status] INT IDENTITY(1,1) NOT NULL,
    [Nombre] VARCHAR(50) NOT NULL,
    [Descripcion] VARCHAR(250) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_FACTURAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_FACTURAS];
CREATE TABLE [dbo].[ERP_FACTURAS] (
    [Factura_Id] INT IDENTITY(1,1) NOT NULL,
    [Venta_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [UUID] VARCHAR(100) NOT NULL,
    [Serie] VARCHAR(10) NULL,
    [Folio] INT NULL,
    [EmisorRFC] VARCHAR(13) NOT NULL,
    [ReceptorRFC] VARCHAR(13) NOT NULL,
    [ReceptorNombre] VARCHAR(255) NOT NULL,
    [Subtotal] DECIMAL(18, 2) NOT NULL,
    [IVA] DECIMAL(18, 2) NOT NULL,
    [Total] DECIMAL(18, 2) NOT NULL,
    [Moneda] VARCHAR(10) DEFAULT ('MXN') NULL,
    [TipoCambio] DECIMAL(18, 6) DEFAULT ((1)) NULL,
    [MetodoPago] VARCHAR(5) NOT NULL,
    [FormaPago] VARCHAR(5) NOT NULL,
    [Status] VARCHAR(50) DEFAULT ('Vigente') NULL,
    [XML] VARBINARY(MAX) NULL,
    [PDF] VARBINARY(MAX) NULL,
    [FechaTimbrado] DATETIME NOT NULL,
    [FechaCancelacion] DATETIME NULL,
    [CreadoPor] VARCHAR(100) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL,
    [FacturamaId] VARCHAR(50) NULL,
    [motivo_cancelacion_clave] VARCHAR(10) NULL,
    [motivo_cancelacion_descripcion] NVARCHAR(255) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_GUIA_EMBARQUE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_GUIA_EMBARQUE];
CREATE TABLE [dbo].[ERP_GUIA_EMBARQUE] (
    [Guia_Id] INT IDENTITY(1,1) NOT NULL,
    [Venta_Id] INT NULL,
    [FechaSalida] DATETIME NULL,
    [Transportista] VARCHAR(200) NULL,
    [NumeroGuia] VARCHAR(100) NULL,
    [Status] VARCHAR(50) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_HR_BANK_ACCOUNT]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_HR_BANK_ACCOUNT];
CREATE TABLE [dbo].[ERP_HR_BANK_ACCOUNT] (
    [CuentaBancaria_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [Banco] VARCHAR(100) NOT NULL,
    [NumeroCuenta] VARCHAR(50) NOT NULL,
    [CLABE] VARCHAR(30) NULL,
    [NumeroTarjeta] VARCHAR(30) NULL,
    [Moneda] VARCHAR(10) DEFAULT ('MXN') NOT NULL,
    [EsPrincipal] BIT DEFAULT ((0)) NOT NULL,
    [NombreTitular] VARCHAR(120) NULL,
    [IsActive] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreatedBy] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_HR_DOCUMENT]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_HR_DOCUMENT];
CREATE TABLE [dbo].[ERP_HR_DOCUMENT] (
    [Documento_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [TipoDocumento] VARCHAR(80) NULL,
    [NombreArchivo] VARCHAR(260) NOT NULL,
    [ArchivoUrl] VARCHAR(350) NOT NULL,
    [MimeType] VARCHAR(120) NULL,
    [SizeBytes] BIGINT NULL,
    [Descripcion] VARCHAR(250) NULL,
    [IsActive] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreatedBy] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_HR_EMERGENCY_CONTACT]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_HR_EMERGENCY_CONTACT];
CREATE TABLE [dbo].[ERP_HR_EMERGENCY_CONTACT] (
    [ContactoEmergencia_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [Nombre] VARCHAR(120) NOT NULL,
    [Parentesco] VARCHAR(80) NULL,
    [Telefono] VARCHAR(30) NOT NULL,
    [TelefonoAlterno] VARCHAR(30) NULL,
    [Direccion] VARCHAR(250) NULL,
    [EsPrincipal] BIT DEFAULT ((0)) NOT NULL,
    [Notas] VARCHAR(250) NULL,
    [IsActive] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreatedBy] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_HR_PROFILE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_HR_PROFILE];
CREATE TABLE [dbo].[ERP_HR_PROFILE] (
    [User_Id] INT NOT NULL,
    [FechaNacimiento] DATE NULL,
    [CURP] VARCHAR(30) NULL,
    [RFC] VARCHAR(20) NULL,
    [NSS] VARCHAR(30) NULL,
    [EstadoCivil] VARCHAR(30) NULL,
    [Genero] VARCHAR(30) NULL,
    [Direccion] VARCHAR(250) NULL,
    [Ciudad] VARCHAR(100) NULL,
    [Estado] VARCHAR(100) NULL,
    [CodigoPostal] VARCHAR(15) NULL,
    [Pais] VARCHAR(60) NULL,
    [NumeroEmpleado] VARCHAR(50) NULL,
    [FechaIngreso] DATE NULL,
    [Puesto] VARCHAR(100) NULL,
    [Departamento] VARCHAR(100) NULL,
    [SalarioMensual] DECIMAL(18, 2) NULL,
    [TipoContrato] VARCHAR(50) NULL,
    [BancoPrincipal] VARCHAR(100) NULL,
    [NumeroCuentaPrincipal] VARCHAR(50) NULL,
    [CLABE] VARCHAR(30) NULL,
    [NombreTitularCuenta] VARCHAR(120) NULL,
    [ContactoEmergenciaPrincipal] VARCHAR(120) NULL,
    [TelefonoEmergenciaPrincipal] VARCHAR(30) NULL,
    [Alergias] VARCHAR(250) NULL,
    [TipoSangre] VARCHAR(10) NULL,
    [NotasMedicas] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedBy] INT NULL,
    [FotoPerfilUrl] VARCHAR(300) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_IMPORTACIONES_LOG]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_IMPORTACIONES_LOG];
CREATE TABLE [dbo].[ERP_IMPORTACIONES_LOG] (
    [Log_Id] INT IDENTITY(1,1) NOT NULL,
    [NombreArchivo] VARCHAR(255) NULL,
    [TotalFilas] INT NULL,
    [FilasExitosas] INT NULL,
    [FilasConError] INT NULL,
    [FechaImportacion] DATETIME DEFAULT (getdate()) NULL,
    [Usuario_Id] INT NULL,
    [Errores] VARCHAR(MAX) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO];
CREATE TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO] (
    [InventarioEstado_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Almacen_Id] INT NULL,
    [CantidadAlmacen] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [CantidadEnMaquina] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [CantidadEntregadaProduccion] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [CantidadEnProceso] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [FechaCorte] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_KARDEX]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_KARDEX];
CREATE TABLE [dbo].[ERP_KARDEX] (
    [Kardex_Id] INT IDENTITY(1,1) NOT NULL,
    [Producto_Id] INT NULL,
    [Almacen_Id] INT NULL,
    [TipoMovimiento] VARCHAR(20) NULL,
    [Cantidad] DECIMAL(18, 2) NULL,
    [Stock_Anterior] DECIMAL(18, 2) NULL,
    [Stock_Actual] DECIMAL(18, 2) NULL,
    [Referencia] VARCHAR(100) NULL,
    [Usuario] VARCHAR(100) NULL,
    [FechaMovimiento] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_LEDGER]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_LEDGER];
CREATE TABLE [dbo].[ERP_LEDGER] (
    [Ledger_Id] INT IDENTITY(1,1) NOT NULL,
    [Date] DATETIME NOT NULL,
    [AccountCode] VARCHAR(100) NULL,
    [Debit] DECIMAL(18, 2) NULL,
    [Credit] DECIMAL(18, 2) NULL,
    [Reference_Id] INT NULL,
    [Company_Id] INT NULL,
    [Description] VARCHAR(500) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_MATERIA_PRIMA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_MATERIA_PRIMA];
CREATE TABLE [dbo].[ERP_MATERIA_PRIMA] (
    [MateriaPrima_Id] INT IDENTITY(1,1) NOT NULL,
    [Codigo] NVARCHAR(50) NOT NULL,
    [Nombre] NVARCHAR(200) NOT NULL,
    [Descripcion] NVARCHAR(500) NULL,
    [Tipo] NVARCHAR(50) NOT NULL,
    [UnidadCompra] NVARCHAR(20) NOT NULL,
    [UnidadConsumo] NVARCHAR(20) NOT NULL,
    [FactorConversion] DECIMAL(18, 6) DEFAULT ((1)) NOT NULL,
    [Gramaje] DECIMAL(18, 4) NULL,
    [CostoUnitario] DECIMAL(18, 6) DEFAULT ((0)) NOT NULL,
    [Moneda] NVARCHAR(3) DEFAULT ('MXN') NOT NULL,
    [Activo] BIT DEFAULT ((1)) NOT NULL,
    [FechaUltimoCosto] DATETIME NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_MODULES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_MODULES];
CREATE TABLE [dbo].[ERP_MODULES] (
    [Module_Id] INT IDENTITY(1,1) NOT NULL,
    [ModuleKey] VARCHAR(100) NOT NULL,
    [ModuleName] VARCHAR(255) NOT NULL,
    [Description] VARCHAR(500) NULL,
    [IsActive] BIT DEFAULT ((1)) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_MP_MAQUINA_DIARIO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_MP_MAQUINA_DIARIO];
CREATE TABLE [dbo].[ERP_MP_MAQUINA_DIARIO] (
    [Registro_Id] INT IDENTITY(1,1) NOT NULL,
    [FechaRegistro] DATE NOT NULL,
    [TipoMaquina] VARCHAR(30) NOT NULL,
    [MateriaPrima_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [Almacen_Id] INT NULL,
    [Cantidad] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Observaciones] NVARCHAR(500) NULL,
    [CreadoPor] VARCHAR(100) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [ActualizadoPor] VARCHAR(100) NULL,
    [FechaActualizacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOI_CONCEPTOS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOI_CONCEPTOS];
CREATE TABLE [dbo].[ERP_NOI_CONCEPTOS] (
    [Concepto_Id] INT IDENTITY(1,1) NOT NULL,
    [Tipo] NVARCHAR(20) NOT NULL,
    [Clave] NVARCHAR(20) NOT NULL,
    [Descripcion] NVARCHAR(200) NOT NULL,
    [EsGravado] BIT DEFAULT ((1)) NOT NULL,
    [EsExento] BIT DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOI_EMPLEADOS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOI_EMPLEADOS];
CREATE TABLE [dbo].[ERP_NOI_EMPLEADOS] (
    [Empleado_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Nombre] NVARCHAR(200) NOT NULL,
    [RFC] NVARCHAR(20) NOT NULL,
    [NSS] NVARCHAR(20) NULL,
    [CURP] NVARCHAR(20) NULL,
    [FechaIngreso] DATE NOT NULL,
    [Activo] BIT DEFAULT ((1)) NOT NULL,
    [Puesto] NVARCHAR(100) NULL,
    [Departamento] NVARCHAR(100) NULL,
    [TipoContrato] NVARCHAR(50) NULL,
    [TipoJornada] NVARCHAR(50) NULL,
    [SalarioBase] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [SalarioDiarioIntegrado] DECIMAL(18, 2) NULL,
    [Banco] NVARCHAR(50) NULL,
    [CuentaBancaria] NVARCHAR(50) NULL,
    [Clabe] NVARCHAR(20) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOI_NOMINA_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOI_NOMINA_DETALLE];
CREATE TABLE [dbo].[ERP_NOI_NOMINA_DETALLE] (
    [NominaDetalle_Id] INT IDENTITY(1,1) NOT NULL,
    [NominaLinea_Id] INT NOT NULL,
    [Concepto_Id] INT NOT NULL,
    [Importe] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Gravado] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Exento] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOI_NOMINA_LINEAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOI_NOMINA_LINEAS];
CREATE TABLE [dbo].[ERP_NOI_NOMINA_LINEAS] (
    [NominaLinea_Id] INT IDENTITY(1,1) NOT NULL,
    [Nomina_Id] INT NOT NULL,
    [Empleado_Id] INT NOT NULL,
    [Percepciones] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Deducciones] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Neto] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [UUID] VARCHAR(50) NULL,
    [FacturamaId] VARCHAR(100) NULL,
    [Serie] VARCHAR(25) NULL,
    [Folio] VARCHAR(25) NULL,
    [FechaTimbrado] DATETIME NULL,
    [XmlTimbrado] NVARCHAR(MAX) NULL,
    [TimbradoJson] NVARCHAR(MAX) NULL,
    [EstadoTimbrado] NVARCHAR(20) NULL,
    [ErrorTimbrado] NVARCHAR(MAX) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOI_NOMINAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOI_NOMINAS];
CREATE TABLE [dbo].[ERP_NOI_NOMINAS] (
    [Nomina_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [PeriodoInicio] DATE NOT NULL,
    [PeriodoFin] DATE NOT NULL,
    [Tipo] NVARCHAR(30) NOT NULL,
    [Estatus] NVARCHAR(20) DEFAULT ('BORRADOR') NOT NULL,
    [TotalPercepciones] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [TotalDeducciones] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [TotalNeto] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [CreatedBy] NVARCHAR(100) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [FechaTimbrado] DATETIME NULL,
    [TimbradoResumenJson] NVARCHAR(MAX) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOTA_CREDITO_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOTA_CREDITO_DETALLE];
CREATE TABLE [dbo].[ERP_NOTA_CREDITO_DETALLE] (
    [Detalle_Id] INT IDENTITY(1,1) NOT NULL,
    [NotaCredito_Id] INT NOT NULL,
    [Producto_Id] INT NULL,
    [Descripcion] VARCHAR(500) NULL,
    [Cantidad] DECIMAL(18, 2) NULL,
    [PrecioUnitario] DECIMAL(18, 2) NULL,
    [Subtotal] DECIMAL(18, 2) NULL,
    [IVA] DECIMAL(18, 2) NULL,
    [Total] DECIMAL(18, 2) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_NOTAS_CREDITO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_NOTAS_CREDITO];
CREATE TABLE [dbo].[ERP_NOTAS_CREDITO] (
    [NotaCredito_Id] INT IDENTITY(1,1) NOT NULL,
    [Factura_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [UUID] VARCHAR(50) NULL,
    [FacturamaId] VARCHAR(50) NULL,
    [Serie] VARCHAR(10) NULL,
    [Folio] VARCHAR(20) NULL,
    [Motivo] VARCHAR(500) NULL,
    [Subtotal] DECIMAL(18, 2) DEFAULT ((0)) NULL,
    [IVA] DECIMAL(18, 2) DEFAULT ((0)) NULL,
    [Total] DECIMAL(18, 2) DEFAULT ((0)) NULL,
    [Moneda] VARCHAR(3) DEFAULT ('MXN') NULL,
    [Status] VARCHAR(20) DEFAULT ('Vigente') NULL,
    [FechaTimbrado] DATETIME NULL,
    [CreadoPor] VARCHAR(50) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_AVANCE_PIEZAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_AVANCE_PIEZAS];
CREATE TABLE [dbo].[ERP_OP_AVANCE_PIEZAS] (
    [OP_Avance_Id] INT IDENTITY(1,1) NOT NULL,
    [OP_Id] INT NOT NULL,
    [FechaRegistro] DATETIME DEFAULT (getdate()) NOT NULL,
    [PiezasBuenas] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [PiezasMerma] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [EnProceso] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [EsCierreParcial] BIT DEFAULT ((0)) NOT NULL,
    [Comentarios] NVARCHAR(500) NULL,
    [RegistradoPor] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_CONSUMO_MATERIAL]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_CONSUMO_MATERIAL];
CREATE TABLE [dbo].[ERP_OP_CONSUMO_MATERIAL] (
    [OP_Consumo_Id] INT IDENTITY(1,1) NOT NULL,
    [OP_Id] INT NOT NULL,
    [MateriaPrima_Id] INT NOT NULL,
    [CantidadTeorica] DECIMAL(18, 6) NOT NULL,
    [CantidadReal] DECIMAL(18, 6) NULL,
    [UnidadConsumo] NVARCHAR(20) NOT NULL,
    [MermaCantidad] DECIMAL(18, 6) NULL,
    [FechaRegistro] DATETIME DEFAULT (getdate()) NOT NULL,
    [RegistradoPor] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_LOGISTICA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_LOGISTICA];
CREATE TABLE [dbo].[ERP_OP_LOGISTICA] (
    [OP_Id] INT NOT NULL,
    [FechaEmbarque] DATETIME NULL,
    [CantidadReservada] DECIMAL(18, 2) NULL,
    [OrdenTrabajo] NVARCHAR(100) NULL,
    [MaquinaAsignada] NVARCHAR(100) NULL,
    [PrioridadMaquina] INT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedBy] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_PLAN_MAQUINA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_PLAN_MAQUINA];
CREATE TABLE [dbo].[ERP_OP_PLAN_MAQUINA] (
    [OP_PlanMaquina_Id] INT IDENTITY(1,1) NOT NULL,
    [OP_Id] INT NOT NULL,
    [Maquina_Id] INT NOT NULL,
    [Prioridad] INT NOT NULL,
    [Secuencia] INT NULL,
    [FechaInicioPlan] DATETIME NULL,
    [FechaFinPlan] DATETIME NULL,
    [Estatus] NVARCHAR(30) DEFAULT ('PENDIENTE') NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_PRODUCCION]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_PRODUCCION];
CREATE TABLE [dbo].[ERP_OP_PRODUCCION] (
    [OP_Id] INT IDENTITY(1,1) NOT NULL,
    [NumeroOP] NVARCHAR(50) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Venta_Id] INT NULL,
    [ID_COTIZACION] INT NULL,
    [Producto_Id] INT NOT NULL,
    [BOM_Id] INT NULL,
    [CantidadPlanificada] DECIMAL(18, 2) NOT NULL,
    [CantidadProducida] DECIMAL(18, 2) NULL,
    [MermaUnidades] DECIMAL(18, 2) NULL,
    [Estado] NVARCHAR(50) DEFAULT ('EN_ESPERA') NOT NULL,
    [Prioridad] NVARCHAR(20) DEFAULT ('NORMAL') NOT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [FechaInicio] DATETIME NULL,
    [FechaFin] DATETIME NULL,
    [FechaEntregaCompromiso] DATETIME NULL,
    [OperadorPrincipal] NVARCHAR(200) NULL,
    [Notas] NVARCHAR(500) NULL,
    [CompanySolicitante_Id] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_OP_RESULTADO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_OP_RESULTADO];
CREATE TABLE [dbo].[ERP_OP_RESULTADO] (
    [OP_Result_Id] INT IDENTITY(1,1) NOT NULL,
    [OP_Id] INT NOT NULL,
    [PiezasBuenas] DECIMAL(18, 2) NOT NULL,
    [PiezasMerma] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [Comentarios] NVARCHAR(500) NULL,
    [OperadorCierre] NVARCHAR(200) NULL,
    [FechaCierre] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_ORDEN_PRODUCCION]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ORDEN_PRODUCCION];
CREATE TABLE [dbo].[ERP_ORDEN_PRODUCCION] (
    [Orden_Id] INT IDENTITY(1,1) NOT NULL,
    [Venta_Id] INT NULL,
    [FechaProgramada] DATE NULL,
    [FechaInicio] DATE NULL,
    [FechaFin] DATE NULL,
    [Status] VARCHAR(50) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_ORDEN_PRODUCCION_STATUS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ORDEN_PRODUCCION_STATUS];
CREATE TABLE [dbo].[ERP_ORDEN_PRODUCCION_STATUS] (
    [Id_Status] INT IDENTITY(1,1) NOT NULL,
    [Nombre] VARCHAR(50) NOT NULL,
    [Descripcion] VARCHAR(250) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PAGOS_CLIENTE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PAGOS_CLIENTE];
CREATE TABLE [dbo].[ERP_PAGOS_CLIENTE] (
    [Pago_Id] INT IDENTITY(1,1) NOT NULL,
    [Factura_Id] INT NOT NULL,
    [Cliente_Id] INT NOT NULL,
    [Monto] DECIMAL(18, 2) NOT NULL,
    [FechaPago] DATETIME DEFAULT (getdate()) NOT NULL,
    [MetodoPago] VARCHAR(20) NULL,
    [Referencia] VARCHAR(100) NULL,
    [Observaciones] VARCHAR(255) NULL,
    [CreadoPor] VARCHAR(50) NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PEDIDO_VENTA_STATUS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PEDIDO_VENTA_STATUS];
CREATE TABLE [dbo].[ERP_PEDIDO_VENTA_STATUS] (
    [Id_Status] INT IDENTITY(1,1) NOT NULL,
    [Nombre] VARCHAR(50) NOT NULL,
    [Descripcion] VARCHAR(250) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO];
CREATE TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO] (
    [PrecioCliente_Id] INT IDENTITY(1,1) NOT NULL,
    [Cliente_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [PrecioPersonalizado] DECIMAL(18, 2) NOT NULL,
    [Activo] BIT DEFAULT ((1)) NULL,
    [CreadoPor] INT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL,
    [FechaActualizacion] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PROD_MAQUINA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PROD_MAQUINA];
CREATE TABLE [dbo].[ERP_PROD_MAQUINA] (
    [Maquina_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NOT NULL,
    [Codigo] NVARCHAR(50) NOT NULL,
    [Nombre] NVARCHAR(150) NOT NULL,
    [CapacidadPiezasHora] DECIMAL(18, 2) NULL,
    [Activa] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_ALMACEN_CONFIG]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG];
CREATE TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] (
    [ProductoAlmacenConfig_Id] INT IDENTITY(1,1) NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [Almacen_Id] INT NULL,
    [ClasificacionInventario] NVARCHAR(30) DEFAULT ('PRODUCTO_TERMINADO') NOT NULL,
    [Activo] BIT DEFAULT ((1)) NOT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [UpdatedBy] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_EMPRESA]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PRODUCTO_EMPRESA];
CREATE TABLE [dbo].[ERP_PRODUCTO_EMPRESA] (
    [Producto_Empresa_Id] INT IDENTITY(1,1) NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [FechaAsignacion] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_PTC]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PRODUCTO_PTC];
CREATE TABLE [dbo].[ERP_PRODUCTO_PTC] (
    [Producto_Id] INT NOT NULL,
    [SKU_Tecnico] NVARCHAR(50) NOT NULL,
    [TipoProducto] NVARCHAR(50) NOT NULL,
    [LargoMM] DECIMAL(18, 2) NULL,
    [Ala1MM] DECIMAL(18, 2) NULL,
    [Ala2MM] DECIMAL(18, 2) NULL,
    [DiametroMM] DECIMAL(18, 2) NULL,
    [EspesorMM] DECIMAL(18, 3) NULL,
    [PesoTeoricoKG] DECIMAL(18, 6) NULL,
    [BOM_Id_Vigente] INT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreadoPor] NVARCHAR(100) NULL,
    [ModificadoPor] NVARCHAR(100) NULL,
    [FechaModificacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_PRODUCTOS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_PRODUCTOS];
CREATE TABLE [dbo].[ERP_PRODUCTOS] (
    [Producto_Id] INT IDENTITY(1,1) NOT NULL,
    [SKU] VARCHAR(100) NOT NULL,
    [Nombre] VARCHAR(255) NOT NULL,
    [Descripcion] VARCHAR(1000) NULL,
    [Precio] DECIMAL(18, 2) DEFAULT ((0)) NOT NULL,
    [TipoMoneda] VARCHAR(255) NULL,
    [ClaveProdServSAT] VARCHAR(20) NOT NULL,
    [ClaveUnidadSAT] VARCHAR(10) NOT NULL,
    [ImpuestoIVA] DECIMAL(5, 2) DEFAULT ((16.00)) NOT NULL,
    [Activo] BIT DEFAULT ((1)) NOT NULL,
    [CreadoPor] INT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NOT NULL,
    [ActualizadoPor] INT NULL,
    [FechaActualizacion] DATETIME NULL,
    [empresa_id] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO];
CREATE TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] (
    [RecepcionPT_Id] INT IDENTITY(1,1) NOT NULL,
    [OP_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [Almacen_Id] INT NULL,
    [CantidadRecibida] DECIMAL(18, 2) NOT NULL,
    [ClasificacionInventario] NVARCHAR(30) DEFAULT ('PRODUCTO_TERMINADO') NOT NULL,
    [Referencia] NVARCHAR(100) NOT NULL,
    [Observaciones] NVARCHAR(1000) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NOT NULL,
    [CreatedBy] NVARCHAR(100) NULL,
    [Estatus] NVARCHAR(20) DEFAULT ('RECIBIDA') NOT NULL,
    [MotivoCancelacion] NVARCHAR(1000) NULL,
    [FechaCancelacion] DATETIME NULL,
    [CanceladoBy] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_ROL]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ROL];
CREATE TABLE [dbo].[ERP_ROL] (
    [Rol_Id] INT IDENTITY(1,1) NOT NULL,
    [Name] VARCHAR(255) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_ROLE_MODULES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_ROLE_MODULES];
CREATE TABLE [dbo].[ERP_ROLE_MODULES] (
    [RoleModule_Id] INT IDENTITY(1,1) NOT NULL,
    [Role_Id] INT NOT NULL,
    [ModuleKey] VARCHAR(100) NOT NULL,
    [IsEnabled] BIT DEFAULT ((1)) NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_SOLICITUD_CAMBIO_PRECIO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO];
CREATE TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO] (
    [Solicitud_Id] INT IDENTITY(1,1) NOT NULL,
    [Producto_Id] INT NOT NULL,
    [PrecioActual] DECIMAL(18, 2) NOT NULL,
    [PrecioNuevo] DECIMAL(18, 2) NOT NULL,
    [Motivo] VARCHAR(500) NULL,
    [Estado] VARCHAR(50) DEFAULT ('PENDIENTE') NULL,
    [CodigoAprobacion] VARCHAR(10) NULL,
    [SolicitadoPor] INT NULL,
    [FechaSolicitud] DATETIME DEFAULT (getdate()) NULL,
    [AprobadoPor] INT NULL,
    [FechaAprobacion] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_SOLICITUD_PRECIO_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_SOLICITUD_PRECIO_DETALLE];
CREATE TABLE [dbo].[ERP_SOLICITUD_PRECIO_DETALLE] (
    [Detalle_Id] INT IDENTITY(1,1) NOT NULL,
    [Solicitud_Id] INT NOT NULL,
    [Producto_Id] INT NOT NULL,
    [PrecioActual] DECIMAL(18, 2) NULL,
    [PrecioNuevo] DECIMAL(18, 2) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO];
CREATE TABLE [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO] (
    [Solicitud_Id] INT IDENTITY(1,1) NOT NULL,
    [Cliente_Id] INT NOT NULL,
    [Producto_Id] INT NULL,
    [PrecioActual] DECIMAL(18, 2) NULL,
    [PrecioNuevo] DECIMAL(18, 2) NULL,
    [SolicitadoPor] INT NOT NULL,
    [EmailAprobador1] VARCHAR(255) NOT NULL,
    [EmailAprobador2] VARCHAR(255) NOT NULL,
    [EstadoAprobador1] VARCHAR(20) DEFAULT ('pendiente') NULL,
    [EstadoAprobador2] VARCHAR(20) DEFAULT ('pendiente') NULL,
    [FechaAprobador1] DATETIME NULL,
    [FechaAprobador2] DATETIME NULL,
    [Estado] VARCHAR(20) DEFAULT ('pendiente') NULL,
    [Razon] VARCHAR(500) NULL,
    [Venta_Id] INT NULL,
    [FechaCreacion] DATETIME DEFAULT (getdate()) NULL,
    [FechaCompletado] DATETIME NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_STOCK]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_STOCK];
CREATE TABLE [dbo].[ERP_STOCK] (
    [Producto_Id] INT NOT NULL,
    [Almacen_Id] INT NOT NULL,
    [Cantidad] DECIMAL(18, 2) DEFAULT ((0)) NULL,
    [Stock_Minimo] DECIMAL(18, 2) DEFAULT ((0)) NULL,
    [stock_actual] DECIMAL(10, 2) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_STOCK_MP]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_STOCK_MP];
CREATE TABLE [dbo].[ERP_STOCK_MP] (
    [StockMP_Id] INT IDENTITY(1,1) NOT NULL,
    [MateriaPrima_Id] INT NOT NULL,
    [Almacen_Id] INT NOT NULL,
    [Cantidad] DECIMAL(18, 4) DEFAULT ((0)) NOT NULL,
    [Stock_Minimo] DECIMAL(18, 4) DEFAULT ((0)) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_TAXREGIMES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_TAXREGIMES];
CREATE TABLE [dbo].[ERP_TAXREGIMES] (
    [TaxRegime_Id] INT IDENTITY(1,1) NOT NULL,
    [Code] VARCHAR(10) NOT NULL,
    [Description] VARCHAR(255) NOT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_USER_PERMISSIONS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_USER_PERMISSIONS];
CREATE TABLE [dbo].[ERP_USER_PERMISSIONS] (
    [Permission_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [ModuleKey] VARCHAR(100) NOT NULL,
    [CanAccess] BIT DEFAULT ((1)) NULL,
    [CreatedBy] INT NULL,
    [CreatedAt] DATETIME DEFAULT (getdate()) NULL,
    [UpdatedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_USER_SESSIONS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_USER_SESSIONS];
CREATE TABLE [dbo].[ERP_USER_SESSIONS] (
    [Session_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [LoginTime] DATETIME DEFAULT (getdate()) NOT NULL,
    [LogoutTime] DATETIME NULL,
    [Token] VARCHAR(512) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_USERCOMPANIES]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_USERCOMPANIES];
CREATE TABLE [dbo].[ERP_USERCOMPANIES] (
    [UserCompany_Id] INT IDENTITY(1,1) NOT NULL,
    [User_Id] INT NOT NULL,
    [Company_Id] INT NOT NULL,
    [AssignedAt] DATETIME DEFAULT (getdate()) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_USERS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_USERS];
CREATE TABLE [dbo].[ERP_USERS] (
    [User_Id] INT IDENTITY(1,1) NOT NULL,
    [Name] VARCHAR(255) NOT NULL,
    [Lastname] VARCHAR(255) NOT NULL,
    [Username] VARCHAR(255) NOT NULL,
    [Password] VARCHAR(255) NOT NULL,
    [Email] VARCHAR(255) NOT NULL,
    [PhoneNumber] VARCHAR(50) NULL,
    [Area] VARCHAR(255) NOT NULL,
    [RolId] INT NOT NULL,
    [DateCreate] DATETIME DEFAULT (getdate()) NOT NULL,
    [IsActive] BIT DEFAULT ((1)) NULL,
    [LastLogin] DATETIME NULL,
    [CreatedBy] INT NULL,
    [Company_Id] INT NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_VENTA_DETALLE]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_VENTA_DETALLE];
CREATE TABLE [dbo].[ERP_VENTA_DETALLE] (
    [VentaDetalle_Id] INT IDENTITY(1,1) NOT NULL,
    [Venta_Id] INT NULL,
    [Producto_Id] INT NULL,
    [Cantidad] DECIMAL(18, 2) NULL,
    [PrecioUnitario] DECIMAL(18, 2) NULL,
    [Subtotal] DECIMAL(18, 2) NULL,
    [IVA] DECIMAL(18, 2) NULL,
    [Total] DECIMAL(18, 2) NULL,
    [Dimensiones] VARCHAR(100) NULL,
    [TipoCarton] VARCHAR(100) NULL,
    [ResistenciaECT] VARCHAR(50) NULL,
    [Tintas] VARCHAR(100) NULL,
    [Material] VARCHAR(100) NULL,
    [Acabados] VARCHAR(200) NULL,
    [OrdenCompra] NVARCHAR(100) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_VENTA_STATUS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_VENTA_STATUS];
CREATE TABLE [dbo].[ERP_VENTA_STATUS] (
    [Status_Id] INT NOT NULL,
    [Nombre] VARCHAR(50) NULL,
    [Descripcion] VARCHAR(255) NULL
);
GO
IF OBJECT_ID(N'[dbo].[ERP_VENTAS]', 'U') IS NOT NULL DROP TABLE [dbo].[ERP_VENTAS];
CREATE TABLE [dbo].[ERP_VENTAS] (
    [Venta_Id] INT IDENTITY(1,1) NOT NULL,
    [Company_Id] INT NULL,
    [Total] DECIMAL(18, 2) NULL,
    [IVA] DECIMAL(18, 2) NULL,
    [Subtotal] DECIMAL(18, 2) NULL,
    [Moneda] VARCHAR(10) NULL,
    [Status] VARCHAR(50) NULL,
    [FechaVenta] DATETIME DEFAULT (getdate()) NULL,
    [Status_Id] INT DEFAULT ((1)) NULL,
    [ID_COTIZACION] INT NULL,
    [MetodoEnvio] VARCHAR(100) NULL,
    [CondicionesPago] VARCHAR(100) NULL,
    [DiasCredito] INT NULL,
    [FechaSolicitud] DATE NULL,
    [FechaPrometida] DATE NULL,
    [LimiteCreditoUsado] DECIMAL(18, 2) NULL,
    [Client_Id] INT NULL
);
GO
ALTER TABLE [dbo].[ERP_ACCOUNTS] ADD CONSTRAINT [PK__ERP_ACCO__B19E45E91BED9A78] PRIMARY KEY ([Account_Id]);
GO
ALTER TABLE [dbo].[ERP_ALMACENES] ADD CONSTRAINT [PK__ERP_ALMA__699F0D4EBC62930D] PRIMARY KEY ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_AUDIT_LOGS] ADD CONSTRAINT [PK__ERP_AUDI__3213E83F74C6EA80] PRIMARY KEY ([id]);
GO
ALTER TABLE [dbo].[ERP_BOM] ADD CONSTRAINT [PK__ERP_BOM__033087C5A83DAB11] PRIMARY KEY ([BOM_Id]);
GO
ALTER TABLE [dbo].[ERP_BOM_MATERIALES] ADD CONSTRAINT [PK__ERP_BOM___9BE58D7A7EB7F066] PRIMARY KEY ([BOM_Material_Id]);
GO
ALTER TABLE [dbo].[ERP_BOM_OPERACIONES] ADD CONSTRAINT [PK__ERP_BOM___EFAD93D42EC202AA] PRIMARY KEY ([BOM_Operacion_Id]);
GO
ALTER TABLE [dbo].[ERP_CALIDAD_ALERTA] ADD CONSTRAINT [PK__ERP_CALI__D68BDFB7422E07E1] PRIMARY KEY ([CalidadAlerta_Id]);
GO
ALTER TABLE [dbo].[ERP_CATALOGO_FORMA_PAGO] ADD CONSTRAINT [PK__ERP_CATA__3213E83F9725F141] PRIMARY KEY ([id]);
GO
ALTER TABLE [dbo].[ERP_CATALOGO_MOTIVO_CANCELACION] ADD CONSTRAINT [PK__ERP_CATA__3213E83F11E284CF] PRIMARY KEY ([id]);
GO
ALTER TABLE [dbo].[ERP_CLIENT] ADD CONSTRAINT [PK__ERP_CLIE__75A5D8F83395AB9D] PRIMARY KEY ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS] ADD CONSTRAINT [PK__ERP_CLIE__2693BC8D90B009FA] PRIMARY KEY ([RecurringProduct_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTADRESSES] ADD CONSTRAINT [PK__ERP_CLIE__03BDEBBA68B2F66D] PRIMARY KEY ([Address_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTCOMPANIES] ADD CONSTRAINT [PK__ERP_CLIE__385ECE2535347BA4] PRIMARY KEY ([ClientCompany_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTCONTACTS] ADD CONSTRAINT [PK__ERP_CLIE__82ACC1ED347AEF6F] PRIMARY KEY ([Contact_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTFINANCIALSETTINGS] ADD CONSTRAINT [PK__ERP_CLIE__75A5D8F80715D5F8] PRIMARY KEY ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_CATALOGO_FISCAL] ADD CONSTRAINT [PK__ERP_COI___42B35AB56D8DD0EE] PRIMARY KEY ([CatalogoFiscal_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_CUENTAS] ADD CONSTRAINT [PK__ERP_COI___10E5875533087F7D] PRIMARY KEY ([Cuenta_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_PERIODOS] ADD CONSTRAINT [PK__ERP_COI___42673927D670C61B] PRIMARY KEY ([Periodo_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_POLIZA_LINEAS] ADD CONSTRAINT [PK__ERP_COI___53085DE6C03EAE19] PRIMARY KEY ([PolizaLinea_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_POLIZAS] ADD CONSTRAINT [PK__ERP_COI___5CBA07788B563917] PRIMARY KEY ([Poliza_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPANY] ADD CONSTRAINT [PK__ERP_COMP__5F5D19122A7C35E9] PRIMARY KEY ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPLEMENTO_FACTURA] ADD CONSTRAINT [PK__ERP_COMP__BF6FE0D6058B7E39] PRIMARY KEY ([Relacion_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPLEMENTOS_PAGO] ADD CONSTRAINT [PK__ERP_COMP__B492BC7F7D63E66D] PRIMARY KEY ([ComplementoPago_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_AUTORIZACION] ADD CONSTRAINT [PK__ERP_COMP__9A44A7B8206D0C0E] PRIMARY KEY ([OC_Autorizacion_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN] ADD CONSTRAINT [PK__ERP_COMP__10D5576CAD9E9A92] PRIMARY KEY ([OC_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE] ADD CONSTRAINT [PK__ERP_COMP__D9C215056273BD93] PRIMARY KEY ([OC_Detalle_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION] ADD CONSTRAINT [PK__ERP_COMP__DF3B76C880F19E98] PRIMARY KEY ([Recepcion_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] ADD CONSTRAINT [PK__ERP_COMP__F800CD928A8C2B78] PRIMARY KEY ([RecepcionDetalle_Id]);
GO
ALTER TABLE [dbo].[ERP_CONFIG_COSTOS_PTC] ADD CONSTRAINT [PK__ERP_CONF__622D0475F01AC5AD] PRIMARY KEY ([Config_Id]);
GO
ALTER TABLE [dbo].[ERP_COSTEO_MENSUAL] ADD CONSTRAINT [PK__ERP_COST__A63B45CA50D3D9AE] PRIMARY KEY ([CosteoMensual_Id]);
GO
ALTER TABLE [dbo].[ERP_COTIZACION_DETALLE] ADD CONSTRAINT [PK__ERP_COTI__B4F46A577075CF0D] PRIMARY KEY ([ID_DETALLE]);
GO
ALTER TABLE [dbo].[ERP_COTIZACION_STATUS] ADD CONSTRAINT [PK__ERP_COTI__E39037C6B6F8887B] PRIMARY KEY ([Id_Status]);
GO
ALTER TABLE [dbo].[ERP_COTIZACIONES] ADD CONSTRAINT [PK__ERP_COTI__10E8728F6C29F625] PRIMARY KEY ([ID_COTIZACION]);
GO
ALTER TABLE [dbo].[ERP_CRM_ACTIVIDADES] ADD CONSTRAINT [PK__ERP_CRM___777079A3A0C74F7F] PRIMARY KEY ([Actividad_Id]);
GO
ALTER TABLE [dbo].[ERP_CRM_ETAPA] ADD CONSTRAINT [PK__ERP_CRM___0C803976E8B94FCD] PRIMARY KEY ([Etapa_Id]);
GO
ALTER TABLE [dbo].[ERP_CRM_OPORTUNIDADES] ADD CONSTRAINT [PK__ERP_CRM___F62CD31D7D104DA3] PRIMARY KEY ([Oportunidad_Id]);
GO
ALTER TABLE [dbo].[ERP_FACTURA_STATUS] ADD CONSTRAINT [PK__ERP_FACT__E39037C6219D1AA9] PRIMARY KEY ([Id_Status]);
GO
ALTER TABLE [dbo].[ERP_FACTURAS] ADD CONSTRAINT [PK__ERP_FACT__EC60A3E53FDF4F04] PRIMARY KEY ([Factura_Id]);
GO
ALTER TABLE [dbo].[ERP_GUIA_EMBARQUE] ADD CONSTRAINT [PK__ERP_GUIA__2230B8ADEEC739D1] PRIMARY KEY ([Guia_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_BANK_ACCOUNT] ADD CONSTRAINT [PK__ERP_HR_B__D43E98DE540A0B89] PRIMARY KEY ([CuentaBancaria_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_DOCUMENT] ADD CONSTRAINT [PK__ERP_HR_D__FBEBB44070264A13] PRIMARY KEY ([Documento_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_EMERGENCY_CONTACT] ADD CONSTRAINT [PK__ERP_HR_E__20362A6E11382A73] PRIMARY KEY ([ContactoEmergencia_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_PROFILE] ADD CONSTRAINT [PK__ERP_HR_P__206D9170AA0EF91D] PRIMARY KEY ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_IMPORTACIONES_LOG] ADD CONSTRAINT [PK__ERP_IMPO__2D26E78ECEE9CC00] PRIMARY KEY ([Log_Id]);
GO
ALTER TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO] ADD CONSTRAINT [PK__ERP_INVE__30D1BB68FA092269] PRIMARY KEY ([InventarioEstado_Id]);
GO
ALTER TABLE [dbo].[ERP_KARDEX] ADD CONSTRAINT [PK__ERP_KARD__A6B31C4482EF4936] PRIMARY KEY ([Kardex_Id]);
GO
ALTER TABLE [dbo].[ERP_LEDGER] ADD CONSTRAINT [PK__ERP_LEDG__16FE93D0CA552EB4] PRIMARY KEY ([Ledger_Id]);
GO
ALTER TABLE [dbo].[ERP_MATERIA_PRIMA] ADD CONSTRAINT [PK__ERP_MATE__86E7095D8C8C07D3] PRIMARY KEY ([MateriaPrima_Id]);
GO
ALTER TABLE [dbo].[ERP_MODULES] ADD CONSTRAINT [PK__ERP_MODU__1DE4E0C8CDB4165C] PRIMARY KEY ([Module_Id]);
GO
ALTER TABLE [dbo].[ERP_MP_MAQUINA_DIARIO] ADD CONSTRAINT [PK__ERP_MP_M__4D9BEC30A6C926C2] PRIMARY KEY ([Registro_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_CONCEPTOS] ADD CONSTRAINT [PK__ERP_NOI___8A8A923DCEAA8564] PRIMARY KEY ([Concepto_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_EMPLEADOS] ADD CONSTRAINT [PK__ERP_NOI___B71A1D6B509E8C56] PRIMARY KEY ([Empleado_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_DETALLE] ADD CONSTRAINT [PK__ERP_NOI___6D5A7509BC5164C0] PRIMARY KEY ([NominaDetalle_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_LINEAS] ADD CONSTRAINT [PK__ERP_NOI___868854385B96BD02] PRIMARY KEY ([NominaLinea_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINAS] ADD CONSTRAINT [PK__ERP_NOI___A0EE7D579162411A] PRIMARY KEY ([Nomina_Id]);
GO
ALTER TABLE [dbo].[ERP_NOTA_CREDITO_DETALLE] ADD CONSTRAINT [PK__ERP_NOTA__CECB425F9B5C28A0] PRIMARY KEY ([Detalle_Id]);
GO
ALTER TABLE [dbo].[ERP_NOTAS_CREDITO] ADD CONSTRAINT [PK__ERP_NOTA__9F7C1A116AA747F6] PRIMARY KEY ([NotaCredito_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_AVANCE_PIEZAS] ADD CONSTRAINT [PK__ERP_OP_A__FC7CE88307221348] PRIMARY KEY ([OP_Avance_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_CONSUMO_MATERIAL] ADD CONSTRAINT [PK__ERP_OP_C__0CD0AAD3D3DA6920] PRIMARY KEY ([OP_Consumo_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_LOGISTICA] ADD CONSTRAINT [PK__ERP_OP_L__C7FDFD42D0CCB319] PRIMARY KEY ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_PLAN_MAQUINA] ADD CONSTRAINT [PK__ERP_OP_P__BFFB94E8CB3501EC] PRIMARY KEY ([OP_PlanMaquina_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_PRODUCCION] ADD CONSTRAINT [PK__ERP_OP_P__C7FDFD42EC29D7B8] PRIMARY KEY ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_RESULTADO] ADD CONSTRAINT [PK__ERP_OP_R__2B8BC96BB25FA764] PRIMARY KEY ([OP_Result_Id]);
GO
ALTER TABLE [dbo].[ERP_ORDEN_PRODUCCION] ADD CONSTRAINT [PK__ERP_ORDE__503451CAEB396A1B] PRIMARY KEY ([Orden_Id]);
GO
ALTER TABLE [dbo].[ERP_ORDEN_PRODUCCION_STATUS] ADD CONSTRAINT [PK__ERP_ORDE__E39037C66BAA93EB] PRIMARY KEY ([Id_Status]);
GO
ALTER TABLE [dbo].[ERP_PAGOS_CLIENTE] ADD CONSTRAINT [PK__ERP_PAGO__6A194081D88D6032] PRIMARY KEY ([Pago_Id]);
GO
ALTER TABLE [dbo].[ERP_PEDIDO_VENTA_STATUS] ADD CONSTRAINT [PK__ERP_PEDI__E39037C6F219B26A] PRIMARY KEY ([Id_Status]);
GO
ALTER TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO] ADD CONSTRAINT [PK__ERP_PREC__D8799AF846753BC4] PRIMARY KEY ([PrecioCliente_Id]);
GO
ALTER TABLE [dbo].[ERP_PROD_MAQUINA] ADD CONSTRAINT [PK__ERP_PROD__33267B6CFC610F69] PRIMARY KEY ([Maquina_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] ADD CONSTRAINT [PK__ERP_PROD__9EAC796FAE7529EA] PRIMARY KEY ([ProductoAlmacenConfig_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_EMPRESA] ADD CONSTRAINT [PK__ERP_PROD__1BC6B318275D4F2B] PRIMARY KEY ([Producto_Empresa_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_PTC] ADD CONSTRAINT [PK__ERP_PROD__9F1B14DD0E68D2DD] PRIMARY KEY ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTOS] ADD CONSTRAINT [PK__ERP_PROD__9F1B14DDD6C8F412] PRIMARY KEY ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] ADD CONSTRAINT [PK__ERP_RECE__65154C7C986D5FDA] PRIMARY KEY ([RecepcionPT_Id]);
GO
ALTER TABLE [dbo].[ERP_ROL] ADD CONSTRAINT [PK__ERP_ROL__795EBD49996E810E] PRIMARY KEY ([Rol_Id]);
GO
ALTER TABLE [dbo].[ERP_ROLE_MODULES] ADD CONSTRAINT [PK__ERP_ROLE__D0CC2A2FEAC70260] PRIMARY KEY ([RoleModule_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO] ADD CONSTRAINT [PK__ERP_SOLI__A4797D4046073BFB] PRIMARY KEY ([Solicitud_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_PRECIO_DETALLE] ADD CONSTRAINT [PK__ERP_SOLI__CECB425F73B38A7A] PRIMARY KEY ([Detalle_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO] ADD CONSTRAINT [PK__ERP_SOLI__A4797D40BA26DD1B] PRIMARY KEY ([Solicitud_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK] ADD CONSTRAINT [PK__ERP_STOC__6982E4092DAF180A] PRIMARY KEY ([Producto_Id], [Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK_MP] ADD CONSTRAINT [PK__ERP_STOC__F8AF9290F444FAD4] PRIMARY KEY ([StockMP_Id]);
GO
ALTER TABLE [dbo].[ERP_TAXREGIMES] ADD CONSTRAINT [PK__ERP_TAXR__821767BABE4090FF] PRIMARY KEY ([TaxRegime_Id]);
GO
ALTER TABLE [dbo].[ERP_USER_PERMISSIONS] ADD CONSTRAINT [PK__ERP_USER__89B7448551A19325] PRIMARY KEY ([Permission_Id]);
GO
ALTER TABLE [dbo].[ERP_USER_SESSIONS] ADD CONSTRAINT [PK__ERP_USER__E9CBB3322B5272DC] PRIMARY KEY ([Session_Id]);
GO
ALTER TABLE [dbo].[ERP_USERCOMPANIES] ADD CONSTRAINT [PK__ERP_USER__2AC11CA7DE34B84E] PRIMARY KEY ([UserCompany_Id]);
GO
ALTER TABLE [dbo].[ERP_USERS] ADD CONSTRAINT [PK__ERP_USER__206D91705949B748] PRIMARY KEY ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTA_DETALLE] ADD CONSTRAINT [PK__ERP_VENT__540348DCB9DEA603] PRIMARY KEY ([VentaDetalle_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTA_STATUS] ADD CONSTRAINT [PK__ERP_VENT__5190094CF9C66596] PRIMARY KEY ([Status_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTAS] ADD CONSTRAINT [PK__ERP_VENT__24B1773040ABEC68] PRIMARY KEY ([Venta_Id]);
GO
ALTER TABLE [dbo].[PASSWORD_RESET_TOKENS] ADD CONSTRAINT [PK__PASSWORD__AA16D4A0E8091FD9] PRIMARY KEY ([Token_Id]);
GO
ALTER TABLE [dbo].[SAT_CLAVE_PRODSERV] ADD CONSTRAINT [PK__SAT_CLAV__E8181E1052DFDCC1] PRIMARY KEY ([Clave]);
GO
ALTER TABLE [dbo].[SAT_UNIDADES] ADD CONSTRAINT [PK__SAT_UNID__E8181E10432529FD] PRIMARY KEY ([Clave]);
GO
ALTER TABLE [dbo].[sysdiagrams] ADD CONSTRAINT [PK__sysdiagr__C2B05B61921C2010] PRIMARY KEY ([diagram_id]);
GO
ALTER TABLE [dbo].[ERP_ALMACENES] ADD CONSTRAINT [UQ__ERP_ALMA__06370DACB0184C8A] UNIQUE ([Codigo]);
GO
ALTER TABLE [dbo].[ERP_CATALOGO_FORMA_PAGO] ADD CONSTRAINT [UQ__ERP_CATA__71DCA3DBA52FEE36] UNIQUE ([clave]);
GO
ALTER TABLE [dbo].[ERP_CATALOGO_MOTIVO_CANCELACION] ADD CONSTRAINT [UQ__ERP_CATA__71DCA3DBEADEDDFE] UNIQUE ([clave]);
GO
ALTER TABLE [dbo].[ERP_CLIENT] ADD CONSTRAINT [UQ_Clients_RFC] UNIQUE ([RFC]);
GO
ALTER TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS] ADD CONSTRAINT [UQ_ClientProduct] UNIQUE ([Client_Id], [Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTCOMPANIES] ADD CONSTRAINT [UQ__ERP_CLIE__4050096814668FEA] UNIQUE ([Client_Id], [Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_CUENTAS] ADD CONSTRAINT [UQ_COI_CUENTA_Codigo] UNIQUE ([Company_Id], [Codigo]);
GO
ALTER TABLE [dbo].[ERP_COI_PERIODOS] ADD CONSTRAINT [UQ_COI_PERIODO] UNIQUE ([Company_Id], [Anio], [Mes]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_AUTORIZACION] ADD CONSTRAINT [UQ_ERP_COMPRA_AUTORIZACION_OC_Nivel] UNIQUE ([OC_Id], [Nivel]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN] ADD CONSTRAINT [UQ_ERP_COMPRA_ORDEN_NumeroOC] UNIQUE ([NumeroOC]);
GO
ALTER TABLE [dbo].[ERP_COSTEO_MENSUAL] ADD CONSTRAINT [UQ_ERP_COSTEO_MENSUAL_Periodo] UNIQUE ([Company_Id], [Anio], [Mes], [Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_MODULES] ADD CONSTRAINT [UQ__ERP_MODU__37DD71916D31D4F6] UNIQUE ([ModuleKey]);
GO
ALTER TABLE [dbo].[ERP_NOI_EMPLEADOS] ADD CONSTRAINT [UQ_NOI_EMPLEADO_RFC] UNIQUE ([Company_Id], [RFC]);
GO
ALTER TABLE [dbo].[ERP_OP_PLAN_MAQUINA] ADD CONSTRAINT [UQ_ERP_OP_PLAN_MAQUINA_OP] UNIQUE ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO] ADD CONSTRAINT [UK_Cliente_Producto] UNIQUE ([Cliente_Id], [Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_PROD_MAQUINA] ADD CONSTRAINT [UQ_ERP_PROD_MAQUINA_Company_Codigo] UNIQUE ([Company_Id], [Codigo]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] ADD CONSTRAINT [UQ_ERP_PRODUCTO_ALMACEN_CONFIG] UNIQUE ([Producto_Id], [Company_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_EMPRESA] ADD CONSTRAINT [UQ_Producto_Company] UNIQUE ([Producto_Id], [Company_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTOS] ADD CONSTRAINT [UQ_ERP_PRODUCTOS_SKU] UNIQUE ([SKU]);
GO
ALTER TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] ADD CONSTRAINT [UQ_ERP_RECEPCION_PT_OP] UNIQUE ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_ROLE_MODULES] ADD CONSTRAINT [UK_Role_Module] UNIQUE ([Role_Id], [ModuleKey]);
GO
ALTER TABLE [dbo].[ERP_STOCK_MP] ADD CONSTRAINT [UQ_ERP_STOCK_MP_MP_Almacen] UNIQUE ([MateriaPrima_Id], [Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_USER_PERMISSIONS] ADD CONSTRAINT [UK_User_Module] UNIQUE ([User_Id], [ModuleKey]);
GO
ALTER TABLE [dbo].[ERP_USERCOMPANIES] ADD CONSTRAINT [UQ_USER_COMPANY] UNIQUE ([User_Id], [Company_Id]);
GO
ALTER TABLE [dbo].[sysdiagrams] ADD CONSTRAINT [UK_principal_name] UNIQUE ([principal_id], [name]);
GO
ALTER TABLE [dbo].[ERP_CLIENTCONTACTS] ADD CONSTRAINT [FK__ERP_CLIEN__Clien__52593CB8] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTADRESSES] ADD CONSTRAINT [FK__ERP_CLIEN__Clien__571DF1D5] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTFINANCIALSETTINGS] ADD CONSTRAINT [FK__ERP_CLIEN__Clien__5DCAEF64] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENTCOMPANIES] ADD CONSTRAINT [FK__ERP_CLIEN__Clien__6EF57B66] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_CLIENTCOMPANIES] ADD CONSTRAINT [FK__ERP_CLIEN__Compa__6FE99F9F] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COTIZACIONES] ADD CONSTRAINT [FK__ERP_COTIZ__Clien__5AB9788F] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_COTIZACION_DETALLE] ADD CONSTRAINT [FK__ERP_COTIZ__ID_CO__5D95E53A] FOREIGN KEY ([ID_COTIZACION]) REFERENCES [dbo].[ERP_COTIZACIONES] ([ID_COTIZACION]);
GO
ALTER TABLE [dbo].[ERP_COTIZACION_DETALLE] ADD CONSTRAINT [FK__ERP_COTIZ__ID_PR__5E8A0973] FOREIGN KEY ([ID_PRODUCTO]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_GUIA_EMBARQUE] ADD CONSTRAINT [FK__ERP_GUIA___Venta__662B2B3B] FOREIGN KEY ([Venta_Id]) REFERENCES [dbo].[ERP_VENTAS] ([Venta_Id]);
GO
ALTER TABLE [dbo].[ERP_ORDEN_PRODUCCION] ADD CONSTRAINT [FK__ERP_ORDEN__Venta__634EBE90] FOREIGN KEY ([Venta_Id]) REFERENCES [dbo].[ERP_VENTAS] ([Venta_Id]);
GO
ALTER TABLE [dbo].[ERP_PAGOS_CLIENTE] ADD CONSTRAINT [FK__ERP_PAGOS__Clien__4F9CCB9E] FOREIGN KEY ([Cliente_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_PAGOS_CLIENTE] ADD CONSTRAINT [FK__ERP_PAGOS__Factu__4EA8A765] FOREIGN KEY ([Factura_Id]) REFERENCES [dbo].[ERP_FACTURAS] ([Factura_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK] ADD CONSTRAINT [FK__ERP_STOCK__Almac__2CF2ADDF] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK] ADD CONSTRAINT [FK__ERP_STOCK__Produ__2BFE89A6] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTAS] ADD CONSTRAINT [FK__ERP_VENTA__Clien__607251E5] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTAS] ADD CONSTRAINT [FK__ERP_VENTA__ID_CO__5F7E2DAC] FOREIGN KEY ([ID_COTIZACION]) REFERENCES [dbo].[ERP_COTIZACIONES] ([ID_COTIZACION]);
GO
ALTER TABLE [dbo].[ERP_ALMACENES] ADD CONSTRAINT [FK_Almacenes_Company] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS] ADD CONSTRAINT [FK_ClientRecurringProducts_Client] FOREIGN KEY ([Client_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_CLIENT_RECURRING_PRODUCTS] ADD CONSTRAINT [FK_ClientRecurringProducts_Product] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_COI_CATALOGO_FISCAL] ADD CONSTRAINT [FK_COI_CATALOGO_FISCAL_CUENTA] FOREIGN KEY ([Cuenta_Id]) REFERENCES [dbo].[ERP_COI_CUENTAS] ([Cuenta_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_CUENTAS] ADD CONSTRAINT [FK_COI_CUENTA_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_CUENTAS] ADD CONSTRAINT [FK_COI_CUENTA_PADRE] FOREIGN KEY ([Padre_Id]) REFERENCES [dbo].[ERP_COI_CUENTAS] ([Cuenta_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_PERIODOS] ADD CONSTRAINT [FK_COI_PERIODO_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_POLIZAS] ADD CONSTRAINT [FK_COI_POLIZA_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_POLIZA_LINEAS] ADD CONSTRAINT [FK_COI_POLIZA_LINEA_CUENTA] FOREIGN KEY ([Cuenta_Id]) REFERENCES [dbo].[ERP_COI_CUENTAS] ([Cuenta_Id]);
GO
ALTER TABLE [dbo].[ERP_COI_POLIZA_LINEAS] ADD CONSTRAINT [FK_COI_POLIZA_LINEA_POLIZA] FOREIGN KEY ([Poliza_Id]) REFERENCES [dbo].[ERP_COI_POLIZAS] ([Poliza_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPLEMENTO_FACTURA] ADD CONSTRAINT [FK_ComplementoFactura_Complemento] FOREIGN KEY ([ComplementoPago_Id]) REFERENCES [dbo].[ERP_COMPLEMENTOS_PAGO] ([ComplementoPago_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_COMPLEMENTO_FACTURA] ADD CONSTRAINT [FK_ComplementoFactura_Factura] FOREIGN KEY ([Factura_Id]) REFERENCES [dbo].[ERP_FACTURAS] ([Factura_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPLEMENTOS_PAGO] ADD CONSTRAINT [FK_ComplementoPago_Company] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_PRECIO_DETALLE] ADD CONSTRAINT [FK_DetalleSolicitud_Producto] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_PRECIO_DETALLE] ADD CONSTRAINT [FK_DetalleSolicitud_Solicitud] FOREIGN KEY ([Solicitud_Id]) REFERENCES [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO] ([Solicitud_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_CALIDAD_ALERTA] ADD CONSTRAINT [FK_ERP_CALIDAD_ALERTA_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_CALIDAD_ALERTA] ADD CONSTRAINT [FK_ERP_CALIDAD_ALERTA_OP] FOREIGN KEY ([OP_Generada_Id]) REFERENCES [dbo].[ERP_OP_PRODUCCION] ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_CALIDAD_ALERTA] ADD CONSTRAINT [FK_ERP_CALIDAD_ALERTA_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_AUTORIZACION] ADD CONSTRAINT [FK_ERP_COMPRA_AUTORIZACION_OC] FOREIGN KEY ([OC_Id]) REFERENCES [dbo].[ERP_COMPRA_ORDEN] ([OC_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_AUTORIZACION] ADD CONSTRAINT [FK_ERP_COMPRA_AUTORIZACION_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN] ADD CONSTRAINT [FK_ERP_COMPRA_ORDEN_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_ORDEN_DETALLE_MP] FOREIGN KEY ([MateriaPrima_Id]) REFERENCES [dbo].[ERP_MATERIA_PRIMA] ([MateriaPrima_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_ORDEN_DETALLE_OC] FOREIGN KEY ([OC_Id]) REFERENCES [dbo].[ERP_COMPRA_ORDEN] ([OC_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_ORDEN_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_ORDEN_DETALLE_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_REC_DET_MP] FOREIGN KEY ([MateriaPrima_Id]) REFERENCES [dbo].[ERP_MATERIA_PRIMA] ([MateriaPrima_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_REC_DET_OCDET] FOREIGN KEY ([OC_Detalle_Id]) REFERENCES [dbo].[ERP_COMPRA_ORDEN_DETALLE] ([OC_Detalle_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_REC_DET_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION_DETALLE] ADD CONSTRAINT [FK_ERP_COMPRA_REC_DET_REC] FOREIGN KEY ([Recepcion_Id]) REFERENCES [dbo].[ERP_COMPRA_RECEPCION] ([Recepcion_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION] ADD CONSTRAINT [FK_ERP_COMPRA_RECEPCION_ALMACEN] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_COMPRA_RECEPCION] ADD CONSTRAINT [FK_ERP_COMPRA_RECEPCION_OC] FOREIGN KEY ([OC_Id]) REFERENCES [dbo].[ERP_COMPRA_ORDEN] ([OC_Id]);
GO
ALTER TABLE [dbo].[ERP_COSTEO_MENSUAL] ADD CONSTRAINT [FK_ERP_COSTEO_MENSUAL_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_COSTEO_MENSUAL] ADD CONSTRAINT [FK_ERP_COSTEO_MENSUAL_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_BANK_ACCOUNT] ADD CONSTRAINT [FK_ERP_HR_BANK_ACCOUNT_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_DOCUMENT] ADD CONSTRAINT [FK_ERP_HR_DOCUMENT_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_EMERGENCY_CONTACT] ADD CONSTRAINT [FK_ERP_HR_EMERGENCY_CONTACT_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_HR_PROFILE] ADD CONSTRAINT [FK_ERP_HR_PROFILE_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO] ADD CONSTRAINT [FK_ERP_INV_EST_ALMACEN] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO] ADD CONSTRAINT [FK_ERP_INV_EST_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_INVENTARIO_ESTADO_PRODUCTO] ADD CONSTRAINT [FK_ERP_INV_EST_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_AVANCE_PIEZAS] ADD CONSTRAINT [FK_ERP_OP_AVANCE_PIEZAS_OP] FOREIGN KEY ([OP_Id]) REFERENCES [dbo].[ERP_OP_PRODUCCION] ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_PLAN_MAQUINA] ADD CONSTRAINT [FK_ERP_OP_PLAN_MAQUINA_MAQUINA] FOREIGN KEY ([Maquina_Id]) REFERENCES [dbo].[ERP_PROD_MAQUINA] ([Maquina_Id]);
GO
ALTER TABLE [dbo].[ERP_OP_PLAN_MAQUINA] ADD CONSTRAINT [FK_ERP_OP_PLAN_MAQUINA_OP] FOREIGN KEY ([OP_Id]) REFERENCES [dbo].[ERP_OP_PRODUCCION] ([OP_Id]);
GO
ALTER TABLE [dbo].[ERP_PROD_MAQUINA] ADD CONSTRAINT [FK_ERP_PROD_MAQUINA_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] ADD CONSTRAINT [FK_ERP_PRODUCTO_ALMACEN_CONFIG_ALMACEN] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] ADD CONSTRAINT [FK_ERP_PRODUCTO_ALMACEN_CONFIG_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_ALMACEN_CONFIG] ADD CONSTRAINT [FK_ERP_PRODUCTO_ALMACEN_CONFIG_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] ADD CONSTRAINT [FK_ERP_RECEPCION_PT_ALMACEN] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] ADD CONSTRAINT [FK_ERP_RECEPCION_PT_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_RECEPCION_PRODUCTO_TERMINADO] ADD CONSTRAINT [FK_ERP_RECEPCION_PT_PRODUCTO] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK_MP] ADD CONSTRAINT [FK_ERP_STOCK_MP_ALMACEN] FOREIGN KEY ([Almacen_Id]) REFERENCES [dbo].[ERP_ALMACENES] ([Almacen_Id]);
GO
ALTER TABLE [dbo].[ERP_STOCK_MP] ADD CONSTRAINT [FK_ERP_STOCK_MP_MP] FOREIGN KEY ([MateriaPrima_Id]) REFERENCES [dbo].[ERP_MATERIA_PRIMA] ([MateriaPrima_Id]);
GO
ALTER TABLE [dbo].[ERP_USER_SESSIONS] ADD CONSTRAINT [FK_ERP_USER_SESSIONS_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_USERS] ADD CONSTRAINT [FK_ERP_USERS_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_FACTURAS] ADD CONSTRAINT [FK_Facturas_Ventas] FOREIGN KEY ([Venta_Id]) REFERENCES [dbo].[ERP_VENTAS] ([Venta_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_EMPLEADOS] ADD CONSTRAINT [FK_NOI_EMPLEADO_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINAS] ADD CONSTRAINT [FK_NOI_NOMINA_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_DETALLE] ADD CONSTRAINT [FK_NOI_NOMINA_DETALLE_CONCEPTO] FOREIGN KEY ([Concepto_Id]) REFERENCES [dbo].[ERP_NOI_CONCEPTOS] ([Concepto_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_DETALLE] ADD CONSTRAINT [FK_NOI_NOMINA_DETALLE_LINEA] FOREIGN KEY ([NominaLinea_Id]) REFERENCES [dbo].[ERP_NOI_NOMINA_LINEAS] ([NominaLinea_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_LINEAS] ADD CONSTRAINT [FK_NOI_NOMINA_LINEA_EMPLEADO] FOREIGN KEY ([Empleado_Id]) REFERENCES [dbo].[ERP_NOI_EMPLEADOS] ([Empleado_Id]);
GO
ALTER TABLE [dbo].[ERP_NOI_NOMINA_LINEAS] ADD CONSTRAINT [FK_NOI_NOMINA_LINEA_NOMINA] FOREIGN KEY ([Nomina_Id]) REFERENCES [dbo].[ERP_NOI_NOMINAS] ([Nomina_Id]);
GO
ALTER TABLE [dbo].[ERP_NOTAS_CREDITO] ADD CONSTRAINT [FK_NotaCredito_Company] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
GO
ALTER TABLE [dbo].[ERP_NOTAS_CREDITO] ADD CONSTRAINT [FK_NotaCredito_Factura] FOREIGN KEY ([Factura_Id]) REFERENCES [dbo].[ERP_FACTURAS] ([Factura_Id]);
GO
ALTER TABLE [dbo].[ERP_NOTA_CREDITO_DETALLE] ADD CONSTRAINT [FK_NotaCreditoDetalle_NotaCredito] FOREIGN KEY ([NotaCredito_Id]) REFERENCES [dbo].[ERP_NOTAS_CREDITO] ([NotaCredito_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO] ADD CONSTRAINT [FK_PrecioCliente_Cliente] FOREIGN KEY ([Cliente_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_PRECIOS_CLIENTE_PRODUCTO] ADD CONSTRAINT [FK_PrecioCliente_Producto] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_EMPRESA] ADD CONSTRAINT [FK_ProductoEmpresa_Company] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_PRODUCTO_EMPRESA] ADD CONSTRAINT [FK_ProductoEmpresa_Producto] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_ROLE_MODULES] ADD CONSTRAINT [FK_RoleMod_Role] FOREIGN KEY ([Role_Id]) REFERENCES [dbo].[ERP_ROL] ([Rol_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO] ADD CONSTRAINT [FK_SolicitudPrecio_Aprobador] FOREIGN KEY ([AprobadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO] ADD CONSTRAINT [FK_SolicitudPrecio_Cliente_ES] FOREIGN KEY ([Cliente_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO] ADD CONSTRAINT [FK_SolicitudPrecio_Producto] FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_SOLICITUD_CAMBIO_PRECIO] ADD CONSTRAINT [FK_SolicitudPrecio_Solicitante] FOREIGN KEY ([SolicitadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_SOLICITUDES_CAMBIO_PRECIO] ADD CONSTRAINT [FK_SolicitudPrecio_Usuario_ES] FOREIGN KEY ([SolicitadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
GO
ALTER TABLE [dbo].[ERP_USERCOMPANIES] ADD CONSTRAINT [FK_USERCOMPANIES_COMPANY] FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_USERCOMPANIES] ADD CONSTRAINT [FK_USERCOMPANIES_USER] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_USER_PERMISSIONS] ADD CONSTRAINT [FK_UserPerm_User] FOREIGN KEY ([User_Id]) REFERENCES [dbo].[ERP_USERS] ([User_Id]) ON DELETE CASCADE;
GO
ALTER TABLE [dbo].[ERP_USERS] ADD CONSTRAINT [FK_UserRol] FOREIGN KEY ([RolId]) REFERENCES [dbo].[ERP_ROL] ([Rol_Id]);
GO
ALTER TABLE [dbo].[ERP_VENTAS] ADD CONSTRAINT [FK_Ventas_Status] FOREIGN KEY ([Status_Id]) REFERENCES [dbo].[ERP_VENTA_STATUS] ([Status_Id]);
GO
