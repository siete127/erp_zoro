-- Agregar campos faltantes a la tabla ERP_COMPANY para multi-emisor

-- Solo agregar Email (RFC, LegalName, FiscalRegime ya existen)
ALTER TABLE ERP_COMPANY ADD Email NVARCHAR(100) NULL;
