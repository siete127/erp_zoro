-- Fase 5C: Conciliación bancaria
-- Idempotente: seguro de ejecutar múltiples veces

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_CUENTAS_BANCARIAS')
CREATE TABLE ERP_CUENTAS_BANCARIAS (
    CuentaBancaria_Id INT IDENTITY(1,1) PRIMARY KEY,
    Company_Id        INT NOT NULL,
    Banco             NVARCHAR(100) NOT NULL,
    NumCuenta         NVARCHAR(50) NULL,
    Clabe             NVARCHAR(18) NULL,
    Titular           NVARCHAR(200) NULL,
    RFC               NVARCHAR(13) NULL,
    Moneda            NVARCHAR(3) NOT NULL DEFAULT 'MXN',
    SaldoInicial      DECIMAL(18,2) NOT NULL DEFAULT 0,
    Activa            BIT NOT NULL DEFAULT 1,
    CreatedAt         DATETIME DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ERP_MOVIMIENTOS_BANCARIOS')
CREATE TABLE ERP_MOVIMIENTOS_BANCARIOS (
    Movimiento_Id     INT IDENTITY(1,1) PRIMARY KEY,
    CuentaBancaria_Id INT NOT NULL,
    FechaMovimiento   DATE NOT NULL,
    Descripcion       NVARCHAR(500) NULL,
    Monto             DECIMAL(18,2) NOT NULL,
    Tipo              NVARCHAR(10) NOT NULL CHECK (Tipo IN ('CARGO','ABONO')),
    Referencia        NVARCHAR(100) NULL,
    Conciliado        BIT NOT NULL DEFAULT 0,
    FechaConciliacion DATETIME NULL,
    Pago_Id           INT NULL,
    Complemento_Id    INT NULL,
    Origen            NVARCHAR(20) NOT NULL DEFAULT 'IMPORTADO',
    Notas             NVARCHAR(500) NULL,
    CreatedAt         DATETIME DEFAULT GETDATE()
);
