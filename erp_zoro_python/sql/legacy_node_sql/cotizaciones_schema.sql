-- Esquema de Cotizaciones ERP (cabecera + detalle)
-- Compatible con el uso actual en crmController (ERP_COTIZACIONES y ERP_COTIZACION_DETALLE)

/*********************************************************************
 1. Cabecera de Cotización
*********************************************************************/
IF OBJECT_ID('dbo.ERP_COTIZACIONES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_COTIZACIONES (
        ID_COTIZACION       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Company_Id          INT NOT NULL,
        Client_Id           INT NULL,
        ClienteRFC          NVARCHAR(20) NULL,
        ClienteNombre       NVARCHAR(255) NULL,
        -- Empresa emisora lógica: CALI / REMA / PTC
        EmpresaCodigo       NVARCHAR(20) NOT NULL,
        Moneda              NVARCHAR(3) NOT NULL DEFAULT ('MXN'),
        Subtotal            DECIMAL(18, 2) NOT NULL DEFAULT (0),
        IVA                 DECIMAL(18, 2) NOT NULL DEFAULT (0),
        TOTAL               DECIMAL(18, 2) NOT NULL DEFAULT (0),
        -- Utilidad y margen globales de la cotización
        CostoTotal          DECIMAL(18, 2) NULL,
        UtilidadBruta       DECIMAL(18, 2) NULL,
        MargenPorc          DECIMAL(5, 2) NULL,
        -- Estado de la cotización: BORRADOR / ENVIADA / APROBADA / RECHAZADA / CONVERTIDA
        Status              NVARCHAR(50) NOT NULL DEFAULT ('BORRADOR'),
        Vendedor            NVARCHAR(200) NULL,
        CondicionesPago     NVARCHAR(200) NULL,
        ComentarioDescuento NVARCHAR(500) NULL,
        -- Vigencia
        FechaCreacion       DATETIME NOT NULL DEFAULT (GETDATE()),
        FechaVigencia       DATETIME NULL,
        -- Datos de trazabilidad
        CreadoPor           NVARCHAR(100) NULL,
        ModificadoPor       NVARCHAR(100) NULL,
        FechaModificacion   DATETIME NULL
    );

    CREATE INDEX IX_ERP_COTIZACIONES_Company ON dbo.ERP_COTIZACIONES (Company_Id, EmpresaCodigo);
    CREATE INDEX IX_ERP_COTIZACIONES_Client ON dbo.ERP_COTIZACIONES (Client_Id);
END
GO

/*********************************************************************
 2. Detalle de Cotización
*********************************************************************/
IF OBJECT_ID('dbo.ERP_COTIZACION_DETALLE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_COTIZACION_DETALLE (
        ID_DETALLE          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ID_COTIZACION       INT NOT NULL,
        -- Producto de catálogo (CALI/REMA) o de fabricación (PTC)
        ID_PRODUCTO         INT NULL,
        TipoProducto        NVARCHAR(20) NOT NULL, -- CATALOGO / PTC
        SKU                 NVARCHAR(50) NULL,
        Descripcion         NVARCHAR(500) NOT NULL,
        UnidadVenta         NVARCHAR(20) NOT NULL,
        CANTIDAD            DECIMAL(18, 2) NOT NULL,
        PRECIO_UNITARIO     DECIMAL(18, 6) NOT NULL,
        -- Costos para cálculo de margen
        COSTO_UNITARIO      DECIMAL(18, 6) NULL,
        SUBTOTAL            DECIMAL(18, 2) NOT NULL,
        IVA                 DECIMAL(18, 2) NOT NULL DEFAULT (0),
        TOTAL               DECIMAL(18, 2) NOT NULL,
        UTILIDAD            DECIMAL(18, 2) NULL,
        MARGEN_PCT          DECIMAL(5, 2) NULL,
        -- Para productos PTC guardamos los parámetros técnicos (dimensiones, calibre, etc.)
        DatosPTC_JSON       NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_ERP_COTIZACION_DETALLE_Cotizacion ON dbo.ERP_COTIZACION_DETALLE (ID_COTIZACION);
END
GO

/*********************************************************************
 3. Migración para esquemas antiguos (agregar columnas faltantes)
    Adapta las tablas simples que sólo tenían FECHA/MONEDA/ESTATUS
    y detalle básico a los nuevos requerimientos de costos y márgenes.
*********************************************************************/

-- Extender cabecera de cotización si ya existe con columnas antiguas
IF OBJECT_ID('dbo.ERP_COTIZACIONES', 'U') IS NOT NULL
BEGIN
    -- Empresa / cliente / trazabilidad
    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'Company_Id') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD Company_Id INT NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'ClienteRFC') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD ClienteRFC NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'ClienteNombre') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD ClienteNombre NVARCHAR(255) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'EmpresaCodigo') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD EmpresaCodigo NVARCHAR(20) NULL;

    -- Totales y margen global
    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'Subtotal') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD Subtotal DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'IVA') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD IVA DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'CostoTotal') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD CostoTotal DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'UtilidadBruta') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD UtilidadBruta DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'MargenPorc') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD MargenPorc DECIMAL(5, 2) NULL;

    -- Campos de estado y condiciones
    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'Status') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD Status NVARCHAR(50) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'Vendedor') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD Vendedor NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'CondicionesPago') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD CondicionesPago NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'ComentarioDescuento') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD ComentarioDescuento NVARCHAR(500) NULL;

    -- Fechas y usuario
    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'FechaCreacion') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD FechaCreacion DATETIME NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'FechaVigencia') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD FechaVigencia DATETIME NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'CreadoPor') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD CreadoPor NVARCHAR(100) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'ModificadoPor') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD ModificadoPor NVARCHAR(100) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'FechaModificacion') IS NULL
        ALTER TABLE dbo.ERP_COTIZACIONES ADD FechaModificacion DATETIME NULL;

    -- Migrar datos básicos desde columnas antiguas si existen (usar SQL dinámico para evitar errores de compilación)
    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'FECHA') IS NOT NULL
       AND COL_LENGTH('dbo.ERP_COTIZACIONES', 'FechaCreacion') IS NOT NULL
    BEGIN
        EXEC('UPDATE dbo.ERP_COTIZACIONES SET FechaCreacion = FECHA WHERE FechaCreacion IS NULL');
    END;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'CONDICIONES_PAGO') IS NOT NULL
       AND COL_LENGTH('dbo.ERP_COTIZACIONES', 'CondicionesPago') IS NOT NULL
    BEGIN
        EXEC('UPDATE dbo.ERP_COTIZACIONES SET CondicionesPago = CONDICIONES_PAGO WHERE CondicionesPago IS NULL');
    END;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'ESTATUS') IS NOT NULL
       AND COL_LENGTH('dbo.ERP_COTIZACIONES', 'Status') IS NOT NULL
    BEGIN
        EXEC('UPDATE dbo.ERP_COTIZACIONES SET Status = ESTATUS WHERE Status IS NULL');
    END;

    IF COL_LENGTH('dbo.ERP_COTIZACIONES', 'MONEDA') IS NOT NULL
       AND COL_LENGTH('dbo.ERP_COTIZACIONES', 'Moneda') IS NOT NULL
    BEGIN
        -- En la mayoría de colaciones, MONEDA/Moneda es el mismo nombre;
        -- este bloque sólo aplica si existiera diferencia real.
        EXEC('UPDATE dbo.ERP_COTIZACIONES SET Moneda = MONEDA WHERE Moneda IS NULL');
    END;

    -- Índices auxiliares (se crean sólo si aún no existen)
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_ERP_COTIZACIONES_Company'
          AND object_id = OBJECT_ID('dbo.ERP_COTIZACIONES')
    )
    BEGIN
        CREATE INDEX IX_ERP_COTIZACIONES_Company ON dbo.ERP_COTIZACIONES (Company_Id, EmpresaCodigo);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_ERP_COTIZACIONES_Client'
          AND object_id = OBJECT_ID('dbo.ERP_COTIZACIONES')
    )
    BEGIN
        CREATE INDEX IX_ERP_COTIZACIONES_Client ON dbo.ERP_COTIZACIONES (Client_Id);
    END;
END
GO

-- Extender detalle de cotización si ya existe con columnas antiguas
IF OBJECT_ID('dbo.ERP_COTIZACION_DETALLE', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'TipoProducto') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD TipoProducto NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'SKU') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD SKU NVARCHAR(50) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'Descripcion') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD Descripcion NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'UnidadVenta') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD UnidadVenta NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'COSTO_UNITARIO') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD COSTO_UNITARIO DECIMAL(18, 6) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'IVA') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD IVA DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'TOTAL') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD TOTAL DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'UTILIDAD') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD UTILIDAD DECIMAL(18, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'MARGEN_PCT') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD MARGEN_PCT DECIMAL(5, 2) NULL;

    IF COL_LENGTH('dbo.ERP_COTIZACION_DETALLE', 'DatosPTC_JSON') IS NULL
        ALTER TABLE dbo.ERP_COTIZACION_DETALLE ADD DatosPTC_JSON NVARCHAR(MAX) NULL;
END
GO

/*********************************************************************
 4. Catálogos de Estatus de Cotización y Pedido de Venta
*********************************************************************/

-- Catálogo de estatus de cotización
IF OBJECT_ID('dbo.ERP_COTIZACION_STATUS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_COTIZACION_STATUS (
        Id_Status   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre      NVARCHAR(50) NOT NULL,
        Descripcion NVARCHAR(255) NULL
    );
END;
GO

-- Semilla básica de estatus de cotización (solo si no existen)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.ERP_COTIZACION_STATUS') AND type = 'U')
    RETURN;

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'BORRADOR')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('BORRADOR', 'Cotización en edición, aún no enviada al cliente');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'ENVIADA')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('ENVIADA', 'Enviada al cliente, en espera de respuesta');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'APROBADA')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('APROBADA', 'Aceptada por el cliente');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'RECHAZADA')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('RECHAZADA', 'Rechazada por el cliente');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'CONVERTIDA')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('CONVERTIDA', 'Convertida a pedido / orden de venta');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_COTIZACION_STATUS WHERE Nombre = 'CANCELADA')
    INSERT INTO dbo.ERP_COTIZACION_STATUS (Nombre, Descripcion) VALUES ('CANCELADA', 'Cancelada sin conversión a pedido');
GO

-- Catálogo de estatus de pedido de venta
IF OBJECT_ID('dbo.ERP_PEDIDO_VENTA_STATUS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_PEDIDO_VENTA_STATUS (
        Id_Status   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre      NVARCHAR(50) NOT NULL,
        Descripcion NVARCHAR(255) NULL
    );
END;
GO

-- Semilla básica de estatus de pedido de venta (solo si no existen)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.ERP_PEDIDO_VENTA_STATUS') AND type = 'U')
    RETURN;

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'BORRADOR')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('BORRADOR', 'Pedido en captura, aún no confirmado');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'CONFIRMADO')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('CONFIRMADO', 'Pedido confirmado para surtido/producción');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'SURTIDO_PARCIAL')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('SURTIDO_PARCIAL', 'Pedido parcialmente surtido');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'SURTIDO_COMPLETO')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('SURTIDO_COMPLETO', 'Pedido totalmente surtido');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'FACTURADO')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('FACTURADO', 'Pedido completamente facturado');

IF NOT EXISTS (SELECT 1 FROM dbo.ERP_PEDIDO_VENTA_STATUS WHERE Nombre = 'CANCELADO')
    INSERT INTO dbo.ERP_PEDIDO_VENTA_STATUS (Nombre, Descripcion) VALUES ('CANCELADO', 'Pedido cancelado');
GO

/*********************************************************************
 5. Guías de Embarque ligadas a Ventas
*********************************************************************/

IF OBJECT_ID('dbo.ERP_GUIA_EMBARQUE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_GUIA_EMBARQUE (
        Guia_Id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Venta_Id      INT NULL,               -- FK lógica hacia ERP_VENTAS
        FechaSalida   DATETIME NOT NULL,      -- Fecha/hora de salida de la mercancía
        Transportista NVARCHAR(200) NULL,     -- Nombre del transportista o paquetería
        NumeroGuia    NVARCHAR(100) NOT NULL, -- Número de guía / tracking
        Status        NVARCHAR(50) NOT NULL DEFAULT ('ACTIVA') -- ACTIVA / ENTREGADA / CANCELADA
    );

    CREATE INDEX IX_ERP_GUIA_EMBARQUE_Venta ON dbo.ERP_GUIA_EMBARQUE (Venta_Id);
    CREATE INDEX IX_ERP_GUIA_EMBARQUE_NumeroGuia ON dbo.ERP_GUIA_EMBARQUE (NumeroGuia);
END;
GO

-- Fin de esquema de cotizaciones
