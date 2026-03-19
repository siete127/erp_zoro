-- Actualizar el código postal de la empresa
-- Usa un código postal que esté registrado en tu perfil fiscal de Facturama
-- Opciones comunes: 06000, 64000, 01000, etc.

UPDATE ERP_COMPANY 
SET TaxZipCode = '06000'
WHERE Company_Id = 1;

-- Verificar el cambio
SELECT Company_Id, RFC, LegalName, TaxZipCode 
FROM ERP_COMPANY;
