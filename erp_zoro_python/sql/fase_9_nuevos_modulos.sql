-- ============================================================
-- FASE 9 — Nuevos módulos: Solicitud Permisos, Helpdesk, Gastos, Website
-- Ejecutar contra base de datos ERP_Zoro
-- ============================================================

-- 1. SOLICITUDES DE PERMISOS (SuperAdmin)

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_PERMISO_SOLICITUD' AND xtype='U')
BEGIN
    CREATE TABLE ERP_PERMISO_SOLICITUD (
        Solicitud_Id    INT IDENTITY(1,1) PRIMARY KEY,
        NombreEmpresa   NVARCHAR(200) NOT NULL,
        NombreSolicitante NVARCHAR(200) NOT NULL,
        Email           NVARCHAR(200) NOT NULL,
        Telefono        NVARCHAR(50),
        Descripcion     NVARCHAR(MAX),
        Estado          NVARCHAR(50) NOT NULL DEFAULT 'pendiente', -- pendiente | aprobada | rechazada
        FechaSolicitud  DATETIME NOT NULL DEFAULT GETDATE(),
        FechaResolucion DATETIME,
        Notas           NVARCHAR(MAX)
    );
    PRINT 'Tabla ERP_PERMISO_SOLICITUD creada.';
END
ELSE
    PRINT 'Tabla ERP_PERMISO_SOLICITUD ya existe.';


-- 2. HELPDESK — Tickets de soporte

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_HELPDESK_TICKET' AND xtype='U')
BEGIN
    CREATE TABLE ERP_HELPDESK_TICKET (
        Ticket_Id       INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Client_Id       INT,                      -- cliente que genera el ticket (puede ser NULL si es interno)
        Titulo          NVARCHAR(300) NOT NULL,
        Descripcion     NVARCHAR(MAX),
        Prioridad       NVARCHAR(20) NOT NULL DEFAULT 'media',  -- baja | media | alta | critica
        Estado          NVARCHAR(50) NOT NULL DEFAULT 'abierto', -- abierto | en_progreso | resuelto | cerrado
        Categoria       NVARCHAR(100),
        AsignadoA       INT,                      -- User_Id del agente
        FechaCreacion   DATETIME NOT NULL DEFAULT GETDATE(),
        FechaActualizacion DATETIME NOT NULL DEFAULT GETDATE(),
        FechaResolucion DATETIME,
        CreadoPor       INT,                      -- User_Id
        VentaRef        INT,                      -- referencia a venta (opcional)
        FacturaRef      NVARCHAR(100),
        CONSTRAINT FK_TICKET_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
    PRINT 'Tabla ERP_HELPDESK_TICKET creada.';
END
ELSE
    PRINT 'Tabla ERP_HELPDESK_TICKET ya existe.';

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_HELPDESK_COMENTARIO' AND xtype='U')
BEGIN
    CREATE TABLE ERP_HELPDESK_COMENTARIO (
        Comentario_Id   INT IDENTITY(1,1) PRIMARY KEY,
        Ticket_Id       INT NOT NULL,
        User_Id         INT,
        Texto           NVARCHAR(MAX) NOT NULL,
        EsInterno       BIT NOT NULL DEFAULT 0,   -- nota interna vs respuesta al cliente
        FechaCreacion   DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_COMENTARIO_TICKET FOREIGN KEY (Ticket_Id) REFERENCES ERP_HELPDESK_TICKET(Ticket_Id)
    );
    PRINT 'Tabla ERP_HELPDESK_COMENTARIO creada.';
END
ELSE
    PRINT 'Tabla ERP_HELPDESK_COMENTARIO ya existe.';


-- 3. GASTOS DE EMPLEADOS

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_GASTO' AND xtype='U')
BEGIN
    CREATE TABLE ERP_GASTO (
        Gasto_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        User_Id         INT NOT NULL,             -- empleado que registra el gasto
        Categoria       NVARCHAR(100) NOT NULL,   -- viaje | alimentacion | papeleria | otro
        Descripcion     NVARCHAR(300),
        Monto           DECIMAL(18,2) NOT NULL,
        Moneda          NVARCHAR(10) NOT NULL DEFAULT 'MXN',
        FechaGasto      DATE NOT NULL,
        Comprobante     NVARCHAR(500),            -- URL/path del archivo
        Estado          NVARCHAR(50) NOT NULL DEFAULT 'borrador', -- borrador | enviado | aprobado | rechazado
        AprobadoPor     INT,
        FechaAprobacion DATETIME,
        Notas           NVARCHAR(MAX),
        FechaCreacion   DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_GASTO_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
    PRINT 'Tabla ERP_GASTO creada.';
END
ELSE
    PRINT 'Tabla ERP_GASTO ya existe.';


-- 4. WEBSITE — Catálogo público y leads web

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_WEBSITE_CONFIG' AND xtype='U')
BEGIN
    CREATE TABLE ERP_WEBSITE_CONFIG (
        Config_Id       INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL UNIQUE,
        Slug            NVARCHAR(100) NOT NULL UNIQUE,  -- url-friendly company name
        Activo          BIT NOT NULL DEFAULT 1,
        TituloPagina    NVARCHAR(200),
        Descripcion     NVARCHAR(MAX),
        ColorPrimario   NVARCHAR(20) DEFAULT '#092052',
        LogoUrl         NVARCHAR(500),
        MostrarPrecios  BIT NOT NULL DEFAULT 0,
        FechaCreacion   DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WEBSITE_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
    PRINT 'Tabla ERP_WEBSITE_CONFIG creada.';
END
ELSE
    PRINT 'Tabla ERP_WEBSITE_CONFIG ya existe.';

IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='ERP_WEBSITE_LEAD' AND xtype='U')
BEGIN
    CREATE TABLE ERP_WEBSITE_LEAD (
        Lead_Id         INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id      INT NOT NULL,
        Nombre          NVARCHAR(200) NOT NULL,
        Email           NVARCHAR(200) NOT NULL,
        Telefono        NVARCHAR(50),
        Empresa         NVARCHAR(200),
        Mensaje         NVARCHAR(MAX),
        Origen          NVARCHAR(100) DEFAULT 'website',  -- website | catalogo | chat
        Estado          NVARCHAR(50) NOT NULL DEFAULT 'nuevo',  -- nuevo | contactado | convertido
        CrmLead_Id      INT,              -- si se convirtió a lead en CRM
        FechaCreacion   DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WEBLEAD_COMPANY FOREIGN KEY (Company_Id) REFERENCES ERP_COMPANY(Company_Id)
    );
    PRINT 'Tabla ERP_WEBSITE_LEAD creada.';
END
ELSE
    PRINT 'Tabla ERP_WEBSITE_LEAD ya existe.';


-- Permisos de módulos nuevos (si existe la tabla ERP_MODULE_PERMISSIONS)
-- Helpdesk
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'helpdesk')
BEGIN
    INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description)
    VALUES ('helpdesk', 'Helpdesk', 'Gestión de tickets de soporte');
    PRINT 'Módulo helpdesk registrado.';
END

-- Gastos
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'expenses')
BEGIN
    INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description)
    VALUES ('expenses', 'Gastos', 'Gestión de gastos de empleados');
    PRINT 'Módulo expenses registrado.';
END

-- Website
IF NOT EXISTS (SELECT 1 FROM ERP_MODULES WHERE ModuleKey = 'website')
BEGIN
    INSERT INTO ERP_MODULES (ModuleKey, ModuleName, Description)
    VALUES ('website', 'Website', 'Configuración de página web pública');
    PRINT 'Módulo website registrado.';
END
