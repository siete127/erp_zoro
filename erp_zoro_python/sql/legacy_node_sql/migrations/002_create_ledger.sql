-- Migration placeholder: crear tabla básica de asientos/ledger
-- Ajustar según políticas de DBA antes de ejecutar en producción
IF OBJECT_ID('dbo.ERP_LEDGER', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ERP_LEDGER (
    Ledger_Id INT IDENTITY(1,1) PRIMARY KEY,
    [Date] DATETIME NOT NULL,
    AccountCode VARCHAR(100) NULL,
    Debit DECIMAL(18,2) NULL,
    Credit DECIMAL(18,2) NULL,
    Reference_Id INT NULL,
    Company_Id INT NULL,
    Description VARCHAR(500) NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
  );
END
