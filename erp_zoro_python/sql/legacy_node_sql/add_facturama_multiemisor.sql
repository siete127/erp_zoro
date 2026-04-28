-- =====================================================
-- MIGRACIÓN: Soporte Multiemisor Facturama
-- Una sola cuenta de Facturama timbra por las 3 empresas
-- usando la API Multiemisor (/2/cfdis).
-- Cada empresa necesita su CSD (certificado) cargado.
-- =====================================================

-- 1. Agregar columna para saber si el CSD está cargado en Facturama
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdCargado'
)
BEGIN
  ALTER TABLE ERP_COMPANY ADD CsdCargado BIT NOT NULL DEFAULT 0;
  PRINT 'Columna CsdCargado agregada a ERP_COMPANY';
END
GO

-- 2. Agregar columna Email si no existe
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'Email'
)
BEGIN
  ALTER TABLE ERP_COMPANY ADD Email NVARCHAR(200) NULL;
  PRINT 'Columna Email agregada a ERP_COMPANY';
END
GO

-- 3. Agregar columna para password del CSD (FIEL)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdPassword'
)
BEGIN
  ALTER TABLE ERP_COMPANY ADD CsdPassword NVARCHAR(100) NULL;
  PRINT 'Columna CsdPassword agregada a ERP_COMPANY';
END
GO

-- 4. Verificar estructura final
SELECT Company_Id, NameCompany, RFC, LegalName, FiscalRegime, TaxZipCode,
       CsdCargado, CsdPassword, Email
FROM ERP_COMPANY
ORDER BY Company_Id;
GO

PRINT '=== Migración Multiemisor completada ===';
PRINT 'Recuerda: Sube los CSD de cada empresa desde Configuración > Empresas';
GO
