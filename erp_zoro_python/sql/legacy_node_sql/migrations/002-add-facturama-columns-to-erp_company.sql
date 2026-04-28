-- Migration: Add Facturama credential columns to ERP_COMPANY
-- Run this on your SQL Server database (use SQL Server Management Studio or sqlcmd)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'FacturamaUser'
)
BEGIN
    ALTER TABLE ERP_COMPANY ADD FacturamaUser VARCHAR(200) NULL;
    PRINT 'Column FacturamaUser added to ERP_COMPANY.';
END
ELSE
BEGIN
    PRINT 'Column FacturamaUser already exists in ERP_COMPANY.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'FacturamaPassword'
)
BEGIN
    ALTER TABLE ERP_COMPANY ADD FacturamaPassword VARCHAR(500) NULL;
    PRINT 'Column FacturamaPassword added to ERP_COMPANY.';
END
ELSE
BEGIN
    PRINT 'Column FacturamaPassword already exists in ERP_COMPANY.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdPassword'
)
BEGIN
    ALTER TABLE ERP_COMPANY ADD CsdPassword VARCHAR(200) NULL;
    PRINT 'Column CsdPassword added to ERP_COMPANY.';
END
ELSE
BEGIN
    PRINT 'Column CsdPassword already exists in ERP_COMPANY.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdCargado'
)
BEGIN
    ALTER TABLE ERP_COMPANY ADD CsdCargado BIT DEFAULT 0;
    PRINT 'Column CsdCargado added to ERP_COMPANY.';
END
ELSE
BEGIN
    PRINT 'Column CsdCargado already exists in ERP_COMPANY.';
END
