-- Migration placeholder: crear tabla básica de cuentas contables
-- Ajustar según las convenciones de la base de datos real
IF OBJECT_ID('dbo.ERP_ACCOUNTS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ERP_ACCOUNTS (
    Account_Id INT IDENTITY(1,1) PRIMARY KEY,
    AccountCode VARCHAR(50) NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Type VARCHAR(50) NULL,
    ParentAccount VARCHAR(50) NULL,
    Company_Id INT NULL
  );
END
