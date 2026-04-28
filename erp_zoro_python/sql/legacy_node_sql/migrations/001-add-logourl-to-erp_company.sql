-- Migration: Add LogoUrl column to ERP_COMPANY
-- Run this on your SQL Server database (use SQL Server Management Studio or sqlcmd)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'LogoUrl'
)
BEGIN
    ALTER TABLE ERP_COMPANY ADD LogoUrl VARCHAR(500) NULL;
    PRINT 'Column LogoUrl added to ERP_COMPANY.';
END
ELSE
BEGIN
    PRINT 'Column LogoUrl already exists in ERP_COMPANY.';
END
