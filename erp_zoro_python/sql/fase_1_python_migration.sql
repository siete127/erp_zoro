/*
  Complementa ERP_Zoro con columnas y tablas usadas por el backend Python.
  El script es idempotente: solo agrega lo que aun no existe.
*/

IF COL_LENGTH('dbo.ERP_FACTURAS', 'FechaVencimiento') IS NULL
BEGIN
    ALTER TABLE [dbo].[ERP_FACTURAS]
        ADD [FechaVencimiento] DATETIME NULL;
END
GO

IF COL_LENGTH('dbo.ERP_VENTA_DETALLE', 'CostoUnitario') IS NULL
BEGIN
    ALTER TABLE [dbo].[ERP_VENTA_DETALLE]
        ADD [CostoUnitario] DECIMAL(18, 6) NULL;
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_TAREAS] (
        [Tarea_Id] INT IDENTITY(1,1) NOT NULL,
        [Company_Id] INT NOT NULL,
        [Titulo] NVARCHAR(200) NOT NULL,
        [Descripcion] NVARCHAR(MAX) NULL,
        [AsignadoA] INT NULL,
        [CreadoPor] INT NOT NULL,
        [FechaLimite] DATETIME NULL,
        [Estado] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ERP_TAREAS_Estado] DEFAULT ('pendiente'),
        [Prioridad] NVARCHAR(20) NOT NULL CONSTRAINT [DF_ERP_TAREAS_Prioridad] DEFAULT ('media'),
        [Modulo] NVARCHAR(50) NULL,
        [Referencia_Id] INT NULL,
        [FechaCreacion] DATETIME NOT NULL CONSTRAINT [DF_ERP_TAREAS_FechaCreacion] DEFAULT (GETDATE()),
        [FechaActualizacion] DATETIME NOT NULL CONSTRAINT [DF_ERP_TAREAS_FechaActualizacion] DEFAULT (GETDATE()),
        CONSTRAINT [PK_ERP_TAREAS] PRIMARY KEY CLUSTERED ([Tarea_Id] ASC)
    );
END
GO

IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_IMAGENES]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_PRODUCTO_IMAGENES] (
        [Imagen_Id] INT IDENTITY(1,1) NOT NULL,
        [Producto_Id] INT NOT NULL,
        [Url] NVARCHAR(500) NOT NULL,
        [NombreArchivo] NVARCHAR(255) NOT NULL,
        [EsPrincipal] BIT NOT NULL CONSTRAINT [DF_ERP_PRODUCTO_IMAGENES_EsPrincipal] DEFAULT ((0)),
        [Orden] INT NOT NULL CONSTRAINT [DF_ERP_PRODUCTO_IMAGENES_Orden] DEFAULT ((1)),
        [FechaCarga] DATETIME NOT NULL CONSTRAINT [DF_ERP_PRODUCTO_IMAGENES_FechaCarga] DEFAULT (GETDATE()),
        [CargadoPor] INT NULL,
        CONSTRAINT [PK_ERP_PRODUCTO_IMAGENES] PRIMARY KEY CLUSTERED ([Imagen_Id] ASC)
    );
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CLIENT_DOCUMENTOS]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_CLIENT_DOCUMENTOS] (
        [Doc_Id] INT IDENTITY(1,1) NOT NULL,
        [Cliente_Id] INT NOT NULL,
        [TipoDocumento] NVARCHAR(50) NOT NULL,
        [NombreArchivo] NVARCHAR(255) NOT NULL,
        [ArchivoUrl] NVARCHAR(500) NOT NULL,
        [MimeType] NVARCHAR(150) NULL,
        [SizeBytes] BIGINT NULL,
        [Descripcion] NVARCHAR(500) NULL,
        [FechaCarga] DATETIME NOT NULL CONSTRAINT [DF_ERP_CLIENT_DOCUMENTOS_FechaCarga] DEFAULT (GETDATE()),
        [CargadoPor] INT NULL,
        CONSTRAINT [PK_ERP_CLIENT_DOCUMENTOS] PRIMARY KEY CLUSTERED ([Doc_Id] ASC)
    );
END
GO

-- Agregar columna CargadoPor a ERP_PRODUCTO_IMAGENES si no existe
IF COL_LENGTH('dbo.ERP_PRODUCTO_IMAGENES', 'CargadoPor') IS NULL
BEGIN
    ALTER TABLE [dbo].[ERP_PRODUCTO_IMAGENES]
        ADD [CargadoPor] INT NULL;
END
GO

-- Agregar columna CargadoPor a ERP_CLIENT_DOCUMENTOS si no existe
IF COL_LENGTH('dbo.ERP_CLIENT_DOCUMENTOS', 'CargadoPor') IS NULL
BEGIN
    ALTER TABLE [dbo].[ERP_CLIENT_DOCUMENTOS]
        ADD [CargadoPor] INT NULL;
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_ERP_TAREAS_CompanyEstado'
         AND object_id = OBJECT_ID(N'[dbo].[ERP_TAREAS]')
   )
BEGIN
    CREATE INDEX [IX_ERP_TAREAS_CompanyEstado]
        ON [dbo].[ERP_TAREAS] ([Company_Id], [Estado], [Prioridad], [FechaLimite]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_ERP_TAREAS_AsignadoA'
         AND object_id = OBJECT_ID(N'[dbo].[ERP_TAREAS]')
   )
BEGIN
    CREATE INDEX [IX_ERP_TAREAS_AsignadoA]
        ON [dbo].[ERP_TAREAS] ([AsignadoA], [FechaLimite]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_IMAGENES]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_ERP_PRODUCTO_IMAGENES_Producto'
         AND object_id = OBJECT_ID(N'[dbo].[ERP_PRODUCTO_IMAGENES]')
   )
BEGIN
    CREATE INDEX [IX_ERP_PRODUCTO_IMAGENES_Producto]
        ON [dbo].[ERP_PRODUCTO_IMAGENES] ([Producto_Id], [EsPrincipal], [Orden]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CLIENT_DOCUMENTOS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_ERP_CLIENT_DOCUMENTOS_Cliente'
         AND object_id = OBJECT_ID(N'[dbo].[ERP_CLIENT_DOCUMENTOS]')
   )
BEGIN
    CREATE INDEX [IX_ERP_CLIENT_DOCUMENTOS_Cliente]
        ON [dbo].[ERP_CLIENT_DOCUMENTOS] ([Cliente_Id], [TipoDocumento], [FechaCarga]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_COMPANY]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_TAREAS_COMPANY'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_TAREAS]
        ADD CONSTRAINT [FK_ERP_TAREAS_COMPANY]
        FOREIGN KEY ([Company_Id]) REFERENCES [dbo].[ERP_COMPANY] ([Company_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_USERS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_TAREAS_ASIGNADO'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_TAREAS]
        ADD CONSTRAINT [FK_ERP_TAREAS_ASIGNADO]
        FOREIGN KEY ([AsignadoA]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_TAREAS]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_USERS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_TAREAS_CREADO'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_TAREAS]
        ADD CONSTRAINT [FK_ERP_TAREAS_CREADO]
        FOREIGN KEY ([CreadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_IMAGENES]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_PRODUCTOS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_PRODUCTO_IMAGENES_PRODUCTO'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_PRODUCTO_IMAGENES]
        ADD CONSTRAINT [FK_ERP_PRODUCTO_IMAGENES_PRODUCTO]
        FOREIGN KEY ([Producto_Id]) REFERENCES [dbo].[ERP_PRODUCTOS] ([Producto_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_PRODUCTO_IMAGENES]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_USERS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_PRODUCTO_IMAGENES_CARGADO'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_PRODUCTO_IMAGENES]
        ADD CONSTRAINT [FK_ERP_PRODUCTO_IMAGENES_CARGADO]
        FOREIGN KEY ([CargadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CLIENT_DOCUMENTOS]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_CLIENT]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_CLIENT_DOCUMENTOS_CLIENTE'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_CLIENT_DOCUMENTOS]
        ADD CONSTRAINT [FK_ERP_CLIENT_DOCUMENTOS_CLIENTE]
        FOREIGN KEY ([Cliente_Id]) REFERENCES [dbo].[ERP_CLIENT] ([Client_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CLIENT_DOCUMENTOS]', 'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ERP_USERS]', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ERP_CLIENT_DOCUMENTOS_CARGADO'
   )
BEGIN
    ALTER TABLE [dbo].[ERP_CLIENT_DOCUMENTOS]
        ADD CONSTRAINT [FK_ERP_CLIENT_DOCUMENTOS_CARGADO]
        FOREIGN KEY ([CargadoPor]) REFERENCES [dbo].[ERP_USERS] ([User_Id]);
END
GO
