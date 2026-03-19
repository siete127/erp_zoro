-- Script para actualizar RFC de cliente con uno válido para pruebas en Facturama Sandbox
-- Usa uno de estos RFCs de prueba válidos:

-- Opción 1: Público en general (sin validación)
UPDATE ERP_CLIENT 
SET RFC = 'XAXX010101000'
WHERE Client_Id = (SELECT Client_Id FROM ERP_VENTAS WHERE Venta_Id = 15);

-- Opción 2: RFC de prueba válido en Facturama Sandbox
-- UPDATE ERP_CLIENT 
-- SET RFC = 'EKU9003173C9'
-- WHERE Client_Id = (SELECT Client_Id FROM ERP_VENTAS WHERE Venta_Id = 15);

-- Verificar el cambio
SELECT c.Client_Id, c.RFC, c.LegalName, v.Venta_Id
FROM ERP_CLIENT c
INNER JOIN ERP_VENTAS v ON c.Client_Id = v.Client_Id
WHERE v.Venta_Id = 15;
