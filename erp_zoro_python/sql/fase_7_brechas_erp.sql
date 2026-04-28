-- ============================================================
-- FASE 7 — Brechas ERP/CRM estilo Odoo
-- ERP Zoro — SQL Server
-- Ejecutar una sola vez en la BD ERP_Zoro
-- ============================================================

-- ============================================================
-- 7.1 — Ciclo de vida: Requisiciones de compra
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_REQUISICION_COMPRA')
BEGIN
    CREATE TABLE ERP_REQUISICION_COMPRA (
        Req_Id            INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id        INT NOT NULL,
        Solicitante_Id    INT NOT NULL,        -- FK ERP_USERS
        NumeroReq         NVARCHAR(50) NULL,   -- Numero correlativo legible
        FechaSolicitud    DATETIME DEFAULT GETDATE(),
        FechaRequerida    DATE NULL,
        Estatus           NVARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
            -- BORRADOR | PENDIENTE_APROBACION | APROBADA | RECHAZADA | CONVERTIDA | CANCELADA
        Notas             NVARCHAR(1000) NULL,
        OC_Id             INT NULL,            -- FK ERP_COMPRA_ORDEN (al convertir)
        AprobadoPor       INT NULL,            -- FK ERP_USERS
        FechaAprobacion   DATETIME NULL,
        ComentarioRechazo NVARCHAR(500) NULL,
        CreatedAt         DATETIME DEFAULT GETDATE(),
        UpdatedAt         DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_REQUISICION_COMPRA creada.';
END
ELSE
    PRINT 'Tabla ERP_REQUISICION_COMPRA ya existe — omitida.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_REQUISICION_DETALLE')
BEGIN
    CREATE TABLE ERP_REQUISICION_DETALLE (
        ReqDet_Id          INT IDENTITY(1,1) PRIMARY KEY,
        Req_Id             INT NOT NULL,
        Producto_Id        INT NULL,           -- FK ERP_PRODUCTOS
        MateriaPrima_Id    INT NULL,           -- FK ERP_MATERIA_PRIMA
        Descripcion        NVARCHAR(500) NULL, -- Descripcion libre si no hay producto
        CantidadSolicitada DECIMAL(18,4) NOT NULL DEFAULT 1,
        UnidadMedida       NVARCHAR(50) NULL,
        CostoEstimado      DECIMAL(18,2) NULL,
        CONSTRAINT FK_ReqDet_Req FOREIGN KEY (Req_Id)
            REFERENCES ERP_REQUISICION_COMPRA(Req_Id)
    );
    PRINT 'Tabla ERP_REQUISICION_DETALLE creada.';
END
ELSE
    PRINT 'Tabla ERP_REQUISICION_DETALLE ya existe — omitida.';
GO

-- ============================================================
-- 7.2 — (Sin DDL nuevo) — ledger_service usa ERP_LEDGER existente
-- ============================================================
-- ERP_LEDGER y ERP_ACCOUNTS ya existen en el schema principal.
-- Solo se requiere el nuevo servicio Python ledger_service.py.
PRINT 'Fase 7.2: usa ERP_LEDGER existente — sin DDL nuevo.';
GO

-- ============================================================
-- 7.3 — Motor de aprobaciones generico
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_APROBACION_REGLAS')
BEGIN
    CREATE TABLE ERP_APROBACION_REGLAS (
        Regla_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id    INT NOT NULL,
        Modulo        NVARCHAR(50) NOT NULL,  -- COTIZACION | REQUISICION | DESCUENTO
        MontoMinimo   DECIMAL(18,2) NULL,     -- NULL = aplica siempre
        NivelesReq    INT NOT NULL DEFAULT 1, -- 1 o 2
        Aprobador1_Id INT NULL,               -- FK ERP_USERS
        Aprobador2_Id INT NULL,               -- FK ERP_USERS
        Activo        BIT NOT NULL DEFAULT 1,
        CreatedAt     DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_APROBACION_REGLAS creada.';
END
ELSE
    PRINT 'Tabla ERP_APROBACION_REGLAS ya existe — omitida.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_APROBACIONES')
BEGIN
    CREATE TABLE ERP_APROBACIONES (
        Aprobacion_Id  INT IDENTITY(1,1) PRIMARY KEY,
        Modulo         NVARCHAR(50) NOT NULL,  -- COTIZACION | REQUISICION | DESCUENTO
        Documento_Id   INT NOT NULL,           -- ID en su tabla origen
        Company_Id     INT NOT NULL,
        Nivel          INT NOT NULL DEFAULT 1,
        Aprobador_Id   INT NULL,               -- FK ERP_USERS (aprobador asignado)
        DecisionBy     INT NULL,               -- FK ERP_USERS (quien decidio)
        Estatus        NVARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
            -- PENDIENTE | APROBADO | RECHAZADO
        Comentarios    NVARCHAR(500) NULL,
        FechaSolicitud DATETIME DEFAULT GETDATE(),
        FechaDecision  DATETIME NULL
    );
    CREATE INDEX IX_Aprobaciones_Doc ON ERP_APROBACIONES (Modulo, Documento_Id);
    CREATE INDEX IX_Aprobaciones_Aprobador ON ERP_APROBACIONES (Aprobador_Id, Estatus);
    PRINT 'Tabla ERP_APROBACIONES creada.';
END
ELSE
    PRINT 'Tabla ERP_APROBACIONES ya existe — omitida.';
GO

-- ============================================================
-- 7.4 — CRM: Leads y Equipos de venta
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_CRM_EQUIPOS')
BEGIN
    CREATE TABLE ERP_CRM_EQUIPOS (
        Equipo_Id  INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id INT NOT NULL,
        Nombre     NVARCHAR(100) NOT NULL,
        Lider_Id   INT NULL,            -- FK ERP_USERS
        Activo     BIT NOT NULL DEFAULT 1,
        CreatedAt  DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_CRM_EQUIPOS creada.';
END
ELSE
    PRINT 'Tabla ERP_CRM_EQUIPOS ya existe — omitida.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_CRM_EQUIPO_MIEMBROS')
BEGIN
    CREATE TABLE ERP_CRM_EQUIPO_MIEMBROS (
        Equipo_Id INT NOT NULL,
        User_Id   INT NOT NULL,
        PRIMARY KEY (Equipo_Id, User_Id),
        CONSTRAINT FK_EquipoMiembro_Equipo FOREIGN KEY (Equipo_Id)
            REFERENCES ERP_CRM_EQUIPOS(Equipo_Id)
    );
    PRINT 'Tabla ERP_CRM_EQUIPO_MIEMBROS creada.';
END
ELSE
    PRINT 'Tabla ERP_CRM_EQUIPO_MIEMBROS ya existe — omitida.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_CRM_LEADS')
BEGIN
    CREATE TABLE ERP_CRM_LEADS (
        Lead_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id     INT NOT NULL,
        Nombre         NVARCHAR(200) NOT NULL,
        Email          NVARCHAR(200) NULL,
        Telefono       NVARCHAR(50) NULL,
        Empresa        NVARCHAR(200) NULL,
        Cargo          NVARCHAR(100) NULL,
        Origen         NVARCHAR(100) NULL,  -- Web | Llamada | Referido | Evento | Otro
        Status         NVARCHAR(30) NOT NULL DEFAULT 'NUEVO',
            -- NUEVO | CONTACTADO | CALIFICADO | DESCARTADO | CONVERTIDO
        Asignado_Id    INT NULL,            -- FK ERP_USERS
        Equipo_Id      INT NULL,            -- FK ERP_CRM_EQUIPOS
        Oportunidad_Id INT NULL,            -- FK ERP_CRM_OPORTUNIDADES (al convertir)
        FechaCreacion  DATETIME DEFAULT GETDATE(),
        FechaUltimoContacto DATETIME NULL,
        Notas          NVARCHAR(MAX) NULL,
        CreadoPor      NVARCHAR(100) NULL,
        UpdatedAt      DATETIME DEFAULT GETDATE()
    );
    CREATE INDEX IX_Leads_Company ON ERP_CRM_LEADS (Company_Id, Status);
    CREATE INDEX IX_Leads_Asignado ON ERP_CRM_LEADS (Asignado_Id);
    PRINT 'Tabla ERP_CRM_LEADS creada.';
END
ELSE
    PRINT 'Tabla ERP_CRM_LEADS ya existe — omitida.';
GO

-- Agregar Equipo_Id a oportunidades si no existe
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ERP_CRM_OPORTUNIDADES') AND name = 'Equipo_Id'
)
BEGIN
    ALTER TABLE ERP_CRM_OPORTUNIDADES ADD Equipo_Id INT NULL;
    PRINT 'Columna Equipo_Id agregada a ERP_CRM_OPORTUNIDADES.';
END
ELSE
    PRINT 'Columna Equipo_Id ya existe en ERP_CRM_OPORTUNIDADES — omitida.';
GO

-- Agregar Lead_Id a oportunidades para trazar el origen
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ERP_CRM_OPORTUNIDADES') AND name = 'Lead_Id'
)
BEGIN
    ALTER TABLE ERP_CRM_OPORTUNIDADES ADD Lead_Id INT NULL;
    PRINT 'Columna Lead_Id agregada a ERP_CRM_OPORTUNIDADES.';
END
ELSE
    PRINT 'Columna Lead_Id ya existe en ERP_CRM_OPORTUNIDADES — omitida.';
GO

-- ============================================================
-- 7.5 — Ficha completa de Proveedor
-- ============================================================

-- Columnas adicionales en ERP_CLIENT para proveedores
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ERP_CLIENT') AND name = 'LeadTimeEntrega'
)
BEGIN
    ALTER TABLE ERP_CLIENT ADD
        LeadTimeEntrega       INT NULL,            -- Dias promedio de entrega
        CalificacionProveedor DECIMAL(3,1) NULL,   -- 1.0 a 5.0
        TerminosPago          NVARCHAR(100) NULL,  -- "30 dias", "contado", etc.
        NotasProveedor        NVARCHAR(MAX) NULL;
    PRINT 'Columnas de proveedor agregadas a ERP_CLIENT.';
END
ELSE
    PRINT 'Columnas de proveedor ya existen en ERP_CLIENT — omitidas.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_PROVEEDOR_PRECIOS')
BEGIN
    CREATE TABLE ERP_PROVEEDOR_PRECIOS (
        PrecioP_Id      INT IDENTITY(1,1) PRIMARY KEY,
        Proveedor_Id    INT NOT NULL,       -- FK ERP_CLIENT
        Producto_Id     INT NULL,           -- FK ERP_PRODUCTOS
        MateriaPrima_Id INT NULL,           -- FK ERP_MATERIA_PRIMA
        Descripcion     NVARCHAR(300) NULL, -- Si no hay producto/MP
        PrecioUnitario  DECIMAL(18,4) NOT NULL,
        Moneda          NVARCHAR(3) NOT NULL DEFAULT 'MXN',
        Vigencia        DATE NULL,          -- NULL = sin vencimiento
        Company_Id      INT NOT NULL,
        Activo          BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_PROVEEDOR_PRECIOS creada.';
END
ELSE
    PRINT 'Tabla ERP_PROVEEDOR_PRECIOS ya existe — omitida.';
GO

-- ============================================================
-- 7.6 — Proyectos con Timesheets
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_PROYECTOS')
BEGIN
    CREATE TABLE ERP_PROYECTOS (
        Proyecto_Id       INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id        INT NOT NULL,
        Nombre            NVARCHAR(200) NOT NULL,
        Client_Id         INT NULL,             -- FK ERP_CLIENT
        Responsable_Id    INT NULL,             -- FK ERP_USERS
        FechaInicio       DATE NULL,
        FechaFin          DATE NULL,
        PresupuestoHoras  DECIMAL(10,2) NULL,
        PresupuestoCosto  DECIMAL(18,2) NULL,
        HorasReales       DECIMAL(10,2) NOT NULL DEFAULT 0,  -- calculado
        CostoReal         DECIMAL(18,2) NOT NULL DEFAULT 0,  -- calculado
        Status            NVARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
            -- ACTIVO | PAUSADO | CERRADO | CANCELADO
        Descripcion       NVARCHAR(MAX) NULL,
        CreatedAt         DATETIME DEFAULT GETDATE(),
        UpdatedAt         DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_PROYECTOS creada.';
END
ELSE
    PRINT 'Tabla ERP_PROYECTOS ya existe — omitida.';
GO

-- Extender ERP_TAREAS con campos de proyecto
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ERP_TAREAS') AND name = 'Proyecto_Id'
)
BEGIN
    ALTER TABLE ERP_TAREAS ADD
        Proyecto_Id    INT NULL,          -- FK ERP_PROYECTOS
        HorasEstimadas DECIMAL(8,2) NULL,
        HorasReales    DECIMAL(8,2) NULL DEFAULT 0;
    PRINT 'Columnas de proyecto agregadas a ERP_TAREAS.';
END
ELSE
    PRINT 'Columnas de proyecto ya existen en ERP_TAREAS — omitidas.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_TIMESHEETS')
BEGIN
    CREATE TABLE ERP_TIMESHEETS (
        Timesheet_Id      INT IDENTITY(1,1) PRIMARY KEY,
        User_Id           INT NOT NULL,         -- FK ERP_USERS
        Tarea_Id          INT NULL,             -- FK ERP_TAREAS
        Proyecto_Id       INT NULL,             -- FK ERP_PROYECTOS
        Fecha             DATE NOT NULL,
        HorasRegistradas  DECIMAL(6,2) NOT NULL,
        Descripcion       NVARCHAR(500) NULL,
        Facturable        BIT NOT NULL DEFAULT 1,
        CreatedAt         DATETIME DEFAULT GETDATE()
    );
    CREATE INDEX IX_Timesheets_Proyecto ON ERP_TIMESHEETS (Proyecto_Id, Fecha);
    CREATE INDEX IX_Timesheets_User ON ERP_TIMESHEETS (User_Id, Fecha);
    PRINT 'Tabla ERP_TIMESHEETS creada.';
END
ELSE
    PRINT 'Tabla ERP_TIMESHEETS ya existe — omitida.';
GO

-- ============================================================
-- 7.7 — Activos Fijos y Depreciacion
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_ACTIVOS_FIJOS')
BEGIN
    CREATE TABLE ERP_ACTIVOS_FIJOS (
        Activo_Id        INT IDENTITY(1,1) PRIMARY KEY,
        Company_Id       INT NOT NULL,
        Nombre           NVARCHAR(200) NOT NULL,
        Categoria        NVARCHAR(100) NULL,
            -- Maquinaria | Vehiculo | Equipo de Computo | Mobiliario | Inmueble | Otro
        NumeroSerie      NVARCHAR(100) NULL,
        NumeroEconomico  NVARCHAR(50) NULL,
        FechaAdquisicion DATE NOT NULL,
        ValorAdquisicion DECIMAL(18,2) NOT NULL,
        VidaUtilMeses    INT NOT NULL,           -- Para calculo linea recta
        MetodoDeprec     NVARCHAR(50) NOT NULL DEFAULT 'LINEA_RECTA',
        ValorResidual    DECIMAL(18,2) NOT NULL DEFAULT 0,
        ValorActual      DECIMAL(18,2) NULL,     -- Se actualiza al aplicar depreciacion
        DepreciacionAcum DECIMAL(18,2) NOT NULL DEFAULT 0,
        Estatus          NVARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
            -- ACTIVO | BAJA | VENDIDO
        Responsable_Id   INT NULL,               -- FK ERP_USERS
        Almacen_Id       INT NULL,               -- FK ERP_ALMACENES (ubicacion fisica)
        Notas            NVARCHAR(MAX) NULL,
        CuentaDeprec     NVARCHAR(50) NULL,      -- AccountCode en ERP_ACCOUNTS
        CuentaActivo     NVARCHAR(50) NULL,      -- AccountCode en ERP_ACCOUNTS
        CreatedAt        DATETIME DEFAULT GETDATE(),
        UpdatedAt        DATETIME DEFAULT GETDATE()
    );
    PRINT 'Tabla ERP_ACTIVOS_FIJOS creada.';
END
ELSE
    PRINT 'Tabla ERP_ACTIVOS_FIJOS ya existe — omitida.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_DEPRECIACIONES')
BEGIN
    CREATE TABLE ERP_DEPRECIACIONES (
        Deprec_Id    INT IDENTITY(1,1) PRIMARY KEY,
        Activo_Id    INT NOT NULL,              -- FK ERP_ACTIVOS_FIJOS
        Periodo      DATE NOT NULL,             -- Primer dia del mes: 2025-03-01
        Monto        DECIMAL(18,2) NOT NULL,
        ValorLibros  DECIMAL(18,2) NOT NULL,    -- Valor despues de esta depreciacion
        Aplicada     BIT NOT NULL DEFAULT 0,    -- Si ya genero asiento en ERP_LEDGER
        Ledger_Id    INT NULL,                  -- FK ERP_LEDGER (cuando se aplica)
        CreatedAt    DATETIME DEFAULT GETDATE(),
        CONSTRAINT UK_Deprec_ActivoPeriodo UNIQUE (Activo_Id, Periodo)
    );
    PRINT 'Tabla ERP_DEPRECIACIONES creada.';
END
ELSE
    PRINT 'Tabla ERP_DEPRECIACIONES ya existe — omitida.';
GO

-- ============================================================
-- FIN — Fase 7 ejecutada correctamente
-- ============================================================
PRINT '===================================================';
PRINT 'Fase 7 completada. Tablas creadas / ya existentes:';
PRINT '  ERP_REQUISICION_COMPRA';
PRINT '  ERP_REQUISICION_DETALLE';
PRINT '  ERP_APROBACION_REGLAS';
PRINT '  ERP_APROBACIONES';
PRINT '  ERP_CRM_EQUIPOS';
PRINT '  ERP_CRM_EQUIPO_MIEMBROS';
PRINT '  ERP_CRM_LEADS';
PRINT '  ERP_PROVEEDOR_PRECIOS';
PRINT '  ERP_PROYECTOS';
PRINT '  ERP_TIMESHEETS';
PRINT '  ERP_ACTIVOS_FIJOS';
PRINT '  ERP_DEPRECIACIONES';
PRINT 'ALTER TABLE aplicados a:';
PRINT '  ERP_CRM_OPORTUNIDADES  (+Equipo_Id, +Lead_Id)';
PRINT '  ERP_CLIENT             (+LeadTimeEntrega, +CalificacionProveedor, +TerminosPago, +NotasProveedor)';
PRINT '  ERP_TAREAS             (+Proyecto_Id, +HorasEstimadas, +HorasReales)';
PRINT '===================================================';
GO
