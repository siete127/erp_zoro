/*
  Fase 2 — Chat interno ERP Zoro
  Script idempotente: solo crea lo que no existe.
*/

-- ============================================================
-- ERP_CHAT_CANALES
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_CANALES]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_CHAT_CANALES] (
        [Canal_Id]      INT IDENTITY(1,1) NOT NULL,
        [Nombre]        NVARCHAR(120)     NOT NULL,
        [Tipo]          NVARCHAR(20)      NOT NULL  -- 'directo' | 'grupo' | 'empresa'
            CONSTRAINT [CK_CHAT_CANALES_Tipo] CHECK ([Tipo] IN ('directo','grupo','empresa')),
        [Company_Id]    INT               NOT NULL,
        [CreadoPor]     INT               NOT NULL,
        [FechaCreacion] DATETIME          NOT NULL CONSTRAINT [DF_CHAT_CANALES_Fecha] DEFAULT (GETDATE()),
        [Activo]        BIT               NOT NULL CONSTRAINT [DF_CHAT_CANALES_Activo] DEFAULT (1),
        CONSTRAINT [PK_ERP_CHAT_CANALES] PRIMARY KEY CLUSTERED ([Canal_Id] ASC)
    );
END
GO

-- ============================================================
-- ERP_CHAT_MIEMBROS
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_MIEMBROS]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_CHAT_MIEMBROS] (
        [Miembro_Id]       INT IDENTITY(1,1) NOT NULL,
        [Canal_Id]         INT               NOT NULL,
        [User_Id]          INT               NOT NULL,
        [Rol]              NVARCHAR(20)      NOT NULL  -- 'admin' | 'miembro'
            CONSTRAINT [CK_CHAT_MIEMBROS_Rol] CHECK ([Rol] IN ('admin','miembro')),
        [Aceptado]         BIT               NOT NULL CONSTRAINT [DF_CHAT_MIEMBROS_Aceptado] DEFAULT (0),
        [FechaInvitacion]  DATETIME          NOT NULL CONSTRAINT [DF_CHAT_MIEMBROS_FechaInv] DEFAULT (GETDATE()),
        [FechaAceptacion]  DATETIME          NULL,
        CONSTRAINT [PK_ERP_CHAT_MIEMBROS] PRIMARY KEY CLUSTERED ([Miembro_Id] ASC),
        CONSTRAINT [UQ_CHAT_MIEMBROS_Canal_User] UNIQUE ([Canal_Id], [User_Id])
    );
END
GO

-- ============================================================
-- ERP_CHAT_MENSAJES
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_MENSAJES]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_CHAT_MENSAJES] (
        [Mensaje_Id]     INT IDENTITY(1,1) NOT NULL,
        [Canal_Id]       INT               NOT NULL,
        [User_Id]        INT               NOT NULL,
        [Contenido]      NVARCHAR(MAX)     NULL,
        [TipoContenido]  NVARCHAR(20)      NOT NULL  -- 'texto' | 'imagen' | 'archivo'
            CONSTRAINT [CK_CHAT_MENSAJES_Tipo] CHECK ([TipoContenido] IN ('texto','imagen','archivo'))
            CONSTRAINT [DF_CHAT_MENSAJES_Tipo] DEFAULT ('texto'),
        [ArchivoUrl]     NVARCHAR(500)     NULL,
        [ArchivoNombre]  NVARCHAR(255)     NULL,
        [ArchivoMime]    NVARCHAR(100)     NULL,
        [Editado]        BIT               NOT NULL CONSTRAINT [DF_CHAT_MENSAJES_Editado] DEFAULT (0),
        [FechaEdicion]   DATETIME          NULL,
        [FechaEnvio]     DATETIME          NOT NULL CONSTRAINT [DF_CHAT_MENSAJES_FechaEnvio] DEFAULT (GETDATE()),
        CONSTRAINT [PK_ERP_CHAT_MENSAJES] PRIMARY KEY CLUSTERED ([Mensaje_Id] ASC)
    );
END
GO

-- ============================================================
-- ERP_CHAT_LECTURAS
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_LECTURAS]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_CHAT_LECTURAS] (
        [Lectura_Id]          INT IDENTITY(1,1) NOT NULL,
        [Canal_Id]            INT               NOT NULL,
        [User_Id]             INT               NOT NULL,
        [UltimoMensajeLeido]  DATETIME          NOT NULL CONSTRAINT [DF_CHAT_LECTURAS_Ultimo] DEFAULT ('2000-01-01'),
        [FechaLectura]        DATETIME          NOT NULL CONSTRAINT [DF_CHAT_LECTURAS_Fecha] DEFAULT (GETDATE()),
        CONSTRAINT [PK_ERP_CHAT_LECTURAS] PRIMARY KEY CLUSTERED ([Lectura_Id] ASC),
        CONSTRAINT [UQ_CHAT_LECTURAS_Canal_User] UNIQUE ([Canal_Id], [User_Id])
    );
END
GO

-- ============================================================
-- Índices
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_MENSAJES]', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CHAT_MENSAJES_Canal' AND object_id=OBJECT_ID(N'[dbo].[ERP_CHAT_MENSAJES]'))
BEGIN
    CREATE INDEX [IX_CHAT_MENSAJES_Canal]
        ON [dbo].[ERP_CHAT_MENSAJES] ([Canal_Id], [FechaEnvio] DESC);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CHAT_MIEMBROS]', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CHAT_MIEMBROS_User' AND object_id=OBJECT_ID(N'[dbo].[ERP_CHAT_MIEMBROS]'))
BEGIN
    CREATE INDEX [IX_CHAT_MIEMBROS_User]
        ON [dbo].[ERP_CHAT_MIEMBROS] ([User_Id], [Aceptado]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CHAT_CANALES]', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CHAT_CANALES_Company' AND object_id=OBJECT_ID(N'[dbo].[ERP_CHAT_CANALES]'))
BEGIN
    CREATE INDEX [IX_CHAT_CANALES_Company]
        ON [dbo].[ERP_CHAT_CANALES] ([Company_Id], [Tipo], [Activo]);
END
GO

-- ============================================================
-- Foreign Keys
-- ============================================================
IF OBJECT_ID(N'[dbo].[ERP_CHAT_MIEMBROS]','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CHAT_MIEMBROS_CANAL')
BEGIN
    ALTER TABLE [dbo].[ERP_CHAT_MIEMBROS]
        ADD CONSTRAINT [FK_CHAT_MIEMBROS_CANAL]
        FOREIGN KEY ([Canal_Id]) REFERENCES [dbo].[ERP_CHAT_CANALES]([Canal_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CHAT_MENSAJES]','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CHAT_MENSAJES_CANAL')
BEGIN
    ALTER TABLE [dbo].[ERP_CHAT_MENSAJES]
        ADD CONSTRAINT [FK_CHAT_MENSAJES_CANAL]
        FOREIGN KEY ([Canal_Id]) REFERENCES [dbo].[ERP_CHAT_CANALES]([Canal_Id]);
END
GO

IF OBJECT_ID(N'[dbo].[ERP_CHAT_LECTURAS]','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_CHAT_LECTURAS_CANAL')
BEGIN
    ALTER TABLE [dbo].[ERP_CHAT_LECTURAS]
        ADD CONSTRAINT [FK_CHAT_LECTURAS_CANAL]
        FOREIGN KEY ([Canal_Id]) REFERENCES [dbo].[ERP_CHAT_CANALES]([Canal_Id]);
END
GO
