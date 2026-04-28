IF OBJECT_ID(N'[dbo].[ERP_LICENCIAS]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ERP_LICENCIAS] (
        [Licencia_Id] INT IDENTITY(1,1) NOT NULL,
        [Company_Id] INT NOT NULL,
        [Tipo] NVARCHAR(100) NOT NULL,
        [FechaInicio] DATETIME NOT NULL,
        [FechaVencimiento] DATETIME NULL,
        [Activa] BIT NOT NULL CONSTRAINT [DF_ERP_LICENCIAS_Activa] DEFAULT ((1)),
        [MaxUsuarios] INT NULL,
        [Observaciones] NVARCHAR(500) NULL,
        [FechaCreacion] DATETIME NOT NULL CONSTRAINT [DF_ERP_LICENCIAS_FechaCreacion] DEFAULT (GETDATE()),
        [FechaActualizacion] DATETIME NOT NULL CONSTRAINT [DF_ERP_LICENCIAS_FechaActualizacion] DEFAULT (GETDATE()),
        CONSTRAINT [PK_ERP_LICENCIAS] PRIMARY KEY CLUSTERED ([Licencia_Id] ASC)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ERP_LICENCIAS_CompanyTipoVencimiento'
      AND object_id = OBJECT_ID(N'[dbo].[ERP_LICENCIAS]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ERP_LICENCIAS_CompanyTipoVencimiento]
        ON [dbo].[ERP_LICENCIAS] ([Company_Id] ASC, [Tipo] ASC, [FechaVencimiento] ASC);
END
GO
