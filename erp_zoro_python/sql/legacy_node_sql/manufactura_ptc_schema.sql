-- Esquema de Manufactura / PTC (BOM, Costos y Órdenes de Producción)
-- Este script es idempotente: solo crea tablas si no existen.

/*
Resumen de tablas:
- ERP_MATERIA_PRIMA: Catálogo de insumos (papel, adhesivo, reventa).
- ERP_BOM: Estructura de producto (hoja de materiales/costos) por producto.
- ERP_BOM_MATERIALES: Detalle de insumos por BOM (papel, adhesivo, reventa).
- ERP_BOM_OPERACIONES: Mano de obra, máquina y gastos indirectos por BOM.
- ERP_PRODUCTO_PTC: Ficha técnica del producto terminado PTC (dimensiones, peso teórico, SKU técnico).
- ERP_OP_PRODUCCION: Orden de producción (ligada a pedido/venta y BOM).
- ERP_OP_CONSUMO_MATERIAL: Consumo teórico y real de insumos por OP.
- ERP_OP_RESULTADO: Resultado de la OP (piezas buenas, merma, fechas, operador).
- ERP_CONFIG_COSTOS_PTC: Parámetros de costo y reglas de margen para PTC.
*/

/*********************************************************************
 1. Catálogo de Insumos (Materia Prima)
*********************************************************************/
IF OBJECT_ID('dbo.ERP_MATERIA_PRIMA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_MATERIA_PRIMA (
        MateriaPrima_Id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Codigo               NVARCHAR(50) NOT NULL,
        Nombre               NVARCHAR(200) NOT NULL,
        Descripcion          NVARCHAR(500) NULL,
        -- Tipo: PAPEL / ADHESIVO / REVENTA
        Tipo                 NVARCHAR(50) NOT NULL,
        -- Unidad de compra (TONELADA, KILO, LITRO, PIEZA, ROLLO, CAJA)
        UnidadCompra         NVARCHAR(20) NOT NULL,
        -- Unidad de consumo (KILO, GRAMO, LITRO, ML, PIEZA, METRO)
        UnidadConsumo        NVARCHAR(20) NOT NULL,
        -- Factor de conversión: cuántas unidades de consumo hay en una unidad de compra
        FactorConversion     DECIMAL(18, 6) NOT NULL DEFAULT (1),
        -- Solo para papel
        Gramaje              DECIMAL(18, 4) NULL, -- gramos/m2
        -- Costo actual por unidad de consumo (ej. costo por KG)
        CostoUnitario        DECIMAL(18, 6) NOT NULL DEFAULT (0),
        Moneda               NVARCHAR(3) NOT NULL DEFAULT ('MXN'),
        Activo               BIT NOT NULL DEFAULT (1),
        FechaUltimoCosto     DATETIME NULL,
        FechaCreacion        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor            NVARCHAR(100) NULL,
        ModificadoPor        NVARCHAR(100) NULL,
        FechaModificacion    DATETIME NULL
    );

    CREATE UNIQUE INDEX UX_ERP_MATERIA_PRIMA_Codigo ON dbo.ERP_MATERIA_PRIMA (Codigo);
END
GO

/*********************************************************************
 2. Estructura de Producto (BOM) para PTC
*********************************************************************/
IF OBJECT_ID('dbo.ERP_BOM', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_BOM (
        BOM_Id               INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Producto_Id          INT NOT NULL, -- FK hacia ERP_PRODUCTOS (producto terminado)
        Company_Id           INT NOT NULL, -- empresa (CALI/REMA/PTC)
        CodigoBOM            NVARCHAR(50) NOT NULL,
        Descripcion          NVARCHAR(255) NULL,
        Version              INT NOT NULL DEFAULT (1),
        Vigente              BIT NOT NULL DEFAULT (1),
        -- Merma global de proceso (ej. 5%)
        MermaPct             DECIMAL(5, 2) NOT NULL DEFAULT (0),
        FechaCreacion        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor            NVARCHAR(100) NULL,
        ModificadoPor        NVARCHAR(100) NULL,
        FechaModificacion    DATETIME NULL
    );

    CREATE UNIQUE INDEX UX_ERP_BOM_Producto_Version
        ON dbo.ERP_BOM (Producto_Id, Version);
END
GO

-- Detalle de materiales de la BOM
IF OBJECT_ID('dbo.ERP_BOM_MATERIALES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_BOM_MATERIALES (
        BOM_Material_Id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BOM_Id               INT NOT NULL,
        MateriaPrima_Id      INT NOT NULL,
        -- Cantidad teórica por unidad de producto terminado (en UnidadConsumo del insumo)
        CantidadTeorica      DECIMAL(18, 6) NOT NULL,
        -- Tipo de componente: MATERIAL / ADHESIVO / REVENTA
        TipoComponente       NVARCHAR(50) NOT NULL,
        -- Merma específica para este componente (además de la global)
        MermaPct             DECIMAL(5, 2) NOT NULL DEFAULT (0),
        Notas                NVARCHAR(255) NULL
    );

    CREATE INDEX IX_ERP_BOM_MATERIALES_BOM ON dbo.ERP_BOM_MATERIALES (BOM_Id);
END
GO

-- Mano de obra, máquina y gastos indirectos asociados al BOM
IF OBJECT_ID('dbo.ERP_BOM_OPERACIONES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_BOM_OPERACIONES (
        BOM_Operacion_Id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BOM_Id               INT NOT NULL,
        -- TipoCosto: MANO_OBRA / MAQUINA / INDIRECTO
        TipoCosto            NVARCHAR(50) NOT NULL,
        -- Costo por unidad de producto terminado (ya calculado)
        CostoPorUnidad       DECIMAL(18, 6) NOT NULL DEFAULT (0),
        -- Datos opcionales de referencia para tiempos de máquina, etc.
        MinutosPorUnidad     DECIMAL(18, 6) NULL,
        CostoHoraReferencia  DECIMAL(18, 6) NULL,
        Notas                NVARCHAR(255) NULL
    );

    CREATE INDEX IX_ERP_BOM_OPERACIONES_BOM ON dbo.ERP_BOM_OPERACIONES (BOM_Id);
END
GO

/*********************************************************************
 3. Ficha de Producto Terminado PTC (dimensiones, peso teórico)
*********************************************************************/
IF OBJECT_ID('dbo.ERP_PRODUCTO_PTC', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_PRODUCTO_PTC (
        Producto_Id          INT NOT NULL PRIMARY KEY, -- FK a ERP_PRODUCTOS
        -- SKU técnico, por ejemplo: ESQ-22-1300-C120
        SKU_Tecnico          NVARCHAR(50) NOT NULL,
        -- Tipo de producto: ESQUINERO / TUBO / OTRO
        TipoProducto         NVARCHAR(50) NOT NULL,
        -- Dimensiones generales
        LargoMM              DECIMAL(18, 2) NULL,
        Ala1MM               DECIMAL(18, 2) NULL,
        Ala2MM               DECIMAL(18, 2) NULL,
        DiametroMM           DECIMAL(18, 2) NULL,
        EspesorMM            DECIMAL(18, 3) NULL,
        -- Peso teórico por pieza (kg) para control de fletes y validaciones
        PesoTeoricoKG        DECIMAL(18, 6) NULL,
        -- Relación principal al BOM vigente
        BOM_Id_Vigente       INT NULL,
        FechaCreacion        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor            NVARCHAR(100) NULL,
        ModificadoPor        NVARCHAR(100) NULL,
        FechaModificacion    DATETIME NULL
    );

    CREATE UNIQUE INDEX UX_ERP_PRODUCTO_PTC_SKU_Tecnico ON dbo.ERP_PRODUCTO_PTC (SKU_Tecnico);
END
GO

/*********************************************************************
 4. Órdenes de Producción (OP)
*********************************************************************/
IF OBJECT_ID('dbo.ERP_OP_PRODUCCION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_OP_PRODUCCION (
        OP_Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        NumeroOP             NVARCHAR(50) NOT NULL,
        Company_Id           INT NOT NULL,
        -- Pedido / venta origen
        Venta_Id             INT NULL,
        ID_COTIZACION        INT NULL,
        -- Producto a fabricar
        Producto_Id          INT NOT NULL,
        BOM_Id               INT NULL,
        CantidadPlanificada  DECIMAL(18, 2) NOT NULL,
        CantidadProducida    DECIMAL(18, 2) NULL,
        MermaUnidades        DECIMAL(18, 2) NULL,
        -- Estados: EN_ESPERA / EN_PROCESO / TERMINADA / CERRADA / CANCELADA
        Estado               NVARCHAR(50) NOT NULL DEFAULT ('EN_ESPERA'),
        Prioridad            NVARCHAR(20) NOT NULL DEFAULT ('NORMAL'), -- URGENTE / NORMAL
        FechaCreacion        DATETIME NOT NULL DEFAULT (GETDATE()),
        FechaInicio          DATETIME NULL,
        FechaFin             DATETIME NULL,
        FechaEntregaCompromiso DATETIME NULL,
        OperadorPrincipal    NVARCHAR(200) NULL,
        Notas                NVARCHAR(500) NULL
    );

    CREATE UNIQUE INDEX UX_ERP_OP_PRODUCCION_NumeroOP ON dbo.ERP_OP_PRODUCCION (NumeroOP);
    CREATE INDEX IX_ERP_OP_PRODUCCION_Venta ON dbo.ERP_OP_PRODUCCION (Venta_Id);
    CREATE INDEX IX_ERP_OP_PRODUCCION_Producto ON dbo.ERP_OP_PRODUCCION (Producto_Id);
END
GO

-- Consumo de materiales por OP (teórico vs real)
IF OBJECT_ID('dbo.ERP_OP_CONSUMO_MATERIAL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_OP_CONSUMO_MATERIAL (
        OP_Consumo_Id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        OP_Id                INT NOT NULL,
        MateriaPrima_Id      INT NOT NULL,
        CantidadTeorica      DECIMAL(18, 6) NOT NULL,
        CantidadReal         DECIMAL(18, 6) NULL,
        UnidadConsumo        NVARCHAR(20) NOT NULL,
        -- Merma en unidad de consumo (real - teórico cuando sea positivo)
        MermaCantidad        DECIMAL(18, 6) NULL,
        FechaRegistro        DATETIME NOT NULL DEFAULT (GETDATE()),
        RegistradoPor        NVARCHAR(100) NULL
    );

    CREATE INDEX IX_ERP_OP_CONSUMO_MATERIAL_OP ON dbo.ERP_OP_CONSUMO_MATERIAL (OP_Id);
END
GO

-- Resultado y cierre de OP (piezas buenas, merma en piezas)
IF OBJECT_ID('dbo.ERP_OP_RESULTADO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_OP_RESULTADO (
        OP_Result_Id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        OP_Id                INT NOT NULL,
        PiezasBuenas         DECIMAL(18, 2) NOT NULL,
        PiezasMerma          DECIMAL(18, 2) NOT NULL DEFAULT (0),
        Comentarios          NVARCHAR(500) NULL,
        OperadorCierre       NVARCHAR(200) NULL,
        FechaCierre          DATETIME NOT NULL DEFAULT (GETDATE())
    );

    CREATE UNIQUE INDEX UX_ERP_OP_RESULTADO_OP ON dbo.ERP_OP_RESULTADO (OP_Id);
END
GO

/*********************************************************************
 5. Configuración de Costos y Reglas de Margen para PTC
*********************************************************************/
IF OBJECT_ID('dbo.ERP_CONFIG_COSTOS_PTC', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ERP_CONFIG_COSTOS_PTC (
        Config_Id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Company_Id           INT NOT NULL,
        -- Porcentaje de merma estándar de proceso
        MermaPctDefault      DECIMAL(5, 2) NOT NULL DEFAULT (0),
        -- Costos base para cálculo de mano de obra / máquina
        CostoHoraManoObra    DECIMAL(18, 6) NULL,
        CostoHoraMaquina     DECIMAL(18, 6) NULL,
        -- % de gastos indirectos sobre costo de materiales + MO
        PorcentajeIndirectos DECIMAL(5, 2) NULL,
        -- Reglas de semáforo de utilidad
        MargenVerdeMin       DECIMAL(5, 2) NOT NULL DEFAULT (25), -- >= verde
        MargenAmarilloMin    DECIMAL(5, 2) NOT NULL DEFAULT (15), -- >= amarillo y < verde
        MargenRojoMax        DECIMAL(5, 2) NOT NULL DEFAULT (15), -- < rojo (bloqueo)
        -- Días de vigencia sugerida de la cotización
        DiasVigenciaDefault  INT NOT NULL DEFAULT (15),
        -- Flags para comportamiento
        RequiereOverrideBajoMargen BIT NOT NULL DEFAULT (1),
        HabilitarBloqueoMorosidad  BIT NOT NULL DEFAULT (0),
        FechaCreacion        DATETIME NOT NULL DEFAULT (GETDATE()),
        CreadoPor            NVARCHAR(100) NULL,
        ModificadoPor        NVARCHAR(100) NULL,
        FechaModificacion    DATETIME NULL
    );

    CREATE UNIQUE INDEX UX_ERP_CONFIG_COSTOS_PTC_Company ON dbo.ERP_CONFIG_COSTOS_PTC (Company_Id);
END
GO

-- Fin de esquema de manufactura / PTC
