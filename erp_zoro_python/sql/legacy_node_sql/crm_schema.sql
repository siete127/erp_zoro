-- Esquema CRM para ERP
-- Crear etapas de CRM (pipeline comercial)
IF OBJECT_ID('dbo.ERP_CRM_ETAPA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_CRM_ETAPA (
        Etapa_Id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre          NVARCHAR(100) NOT NULL,
        Descripcion     NVARCHAR(255) NULL,
        Orden           INT NOT NULL,
        Activo          BIT NOT NULL DEFAULT (1),
        FechaCreacion   DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor       NVARCHAR(100) NULL
    );

    INSERT INTO dbo.ERP_CRM_ETAPA (Nombre, Descripcion, Orden)
    VALUES
        ('Prospección', 'Identificación de cliente potencial', 1),
        ('Detección de necesidades', 'Análisis de requerimientos del cliente', 2),
        ('Solicitud de cotización', 'Recepción de solicitud formal de cotización', 3),
        ('Costeo', 'Cálculo de costos de producción', 4),
        ('Envío de cotización', 'Entrega de propuesta económica al cliente', 5),
        ('Negociación', 'Ajuste de condiciones comerciales', 6),
        ('Confirmación de pedido', 'Recepción de orden de compra', 7),
        ('Planeación de producción', 'Programación de orden de trabajo', 8),
        ('Producción', 'Fabricación del producto', 9),
        ('Control de calidad', 'Inspección del producto', 10),
        ('Entrega', 'Envío del producto al cliente', 11),
        ('Facturación', 'Emisión de factura', 12),
        ('Cobranza', 'Seguimiento de pago', 13),
        ('Postventa', 'Atención a cliente posterior a la entrega', 14);
END
GO

-- Tabla de oportunidades comerciales (leads / deals)
IF OBJECT_ID('dbo.ERP_CRM_OPORTUNIDADES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_CRM_OPORTUNIDADES (
        Oportunidad_Id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Company_Id          INT NOT NULL,
        Client_Id           INT NULL,
        Etapa_Id            INT NOT NULL,
        NombreOportunidad   NVARCHAR(200) NOT NULL,
        MontoEstimado       DECIMAL(18,2) NULL,
        Moneda              NVARCHAR(3) NOT NULL DEFAULT ('MXN'),
        Probabilidad        INT NULL, -- 0-100
        Origen              NVARCHAR(100) NULL,
        FechaCreacion       DATETIME NOT NULL DEFAULT (GETDATE()),
        FechaCierreEstimada DATETIME NULL,
        FechaCierreReal     DATETIME NULL,
        Status              NVARCHAR(50) NOT NULL DEFAULT ('Abierta'), -- Abierta / Ganada / Perdida
        ID_COTIZACION       INT NULL,
        Venta_Id            INT NULL,
        Notas               NVARCHAR(MAX) NULL,
        CreadoPor           NVARCHAR(100) NULL,
        ModificadoPor       NVARCHAR(100) NULL,
        FechaModificacion   DATETIME NULL
    );

    CREATE INDEX IX_ERP_CRM_OPORTUNIDADES_Etapa ON dbo.ERP_CRM_OPORTUNIDADES (Etapa_Id);
    CREATE INDEX IX_ERP_CRM_OPORTUNIDADES_Client ON dbo.ERP_CRM_OPORTUNIDADES (Client_Id);
    CREATE INDEX IX_ERP_CRM_OPORTUNIDADES_Venta ON dbo.ERP_CRM_OPORTUNIDADES (Venta_Id);
END
GO

-- Tabla de actividades asociadas a la oportunidad (llamadas, reuniones, tareas)
IF OBJECT_ID('dbo.ERP_CRM_ACTIVIDADES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_CRM_ACTIVIDADES (
        Actividad_Id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Oportunidad_Id      INT NOT NULL,
        Tipo                NVARCHAR(50) NOT NULL, -- Llamada, Visita, Email, Tarea, Postventa, etc.
        Titulo              NVARCHAR(200) NOT NULL,
        Descripcion         NVARCHAR(MAX) NULL,
        FechaProgramada     DATETIME NULL,
        FechaReal           DATETIME NULL,
        Resultado           NVARCHAR(255) NULL,
        Usuario_Id          INT NULL,
        FechaCreacion       DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor           NVARCHAR(100) NULL,
        Completada          BIT NOT NULL DEFAULT (0)
    );

    CREATE INDEX IX_ERP_CRM_ACTIVIDADES_Oportunidad ON dbo.ERP_CRM_ACTIVIDADES (Oportunidad_Id);
END
GO
