-- SCRIPT DE EJEMPLO: Datos para probar flujo de producción bajo pedido

-- 1. Insertar producto de ejemplo
INSERT INTO ERP_PRODUCTOS (SKU, Nombre, Descripcion, Precio, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo)
VALUES ('SILLA-001', 'Silla Ejecutiva', 'Silla ejecutiva ergonómica con respaldo alto', 2500.00, '31161700', 'H87', 16.00, 1);

DECLARE @Producto_Id INT = SCOPE_IDENTITY();

-- 2. Asociar producto a empresa
INSERT INTO ERP_PRODUCTO_EMPRESA (Producto_Id, Company_Id)
VALUES (@Producto_Id, 1);

-- 3. Crear BOM (Lista de materiales) para el producto
INSERT INTO ERP_BOM (Producto_Id, Company_Id, Version, Vigente, FechaCreacion)
VALUES (@Producto_Id, 1, 1, 1, GETDATE());

DECLARE @BOM_Id INT = SCOPE_IDENTITY();

-- 4. Insertar materias primas de ejemplo
INSERT INTO ERP_MATERIA_PRIMA (Codigo, Nombre, UnidadMedida, Company_Id)
VALUES 
('MP-MADERA-001', 'Madera MDF', 'KG', 1),
('MP-TORNILLO-001', 'Tornillos 5mm', 'PZA', 1),
('MP-TELA-001', 'Tela tapicería negra', 'M', 1);

DECLARE @MateriaMadera INT = (SELECT MateriaPrima_Id FROM ERP_MATERIA_PRIMA WHERE Codigo = 'MP-MADERA-001');
DECLARE @MateriaTornillo INT = (SELECT MateriaPrima_Id FROM ERP_MATERIA_PRIMA WHERE Codigo = 'MP-TORNILLO-001');
DECLARE @MateriaTela INT = (SELECT MateriaPrima_Id FROM ERP_MATERIA_PRIMA WHERE Codigo = 'MP-TELA-001');

-- 5. Definir componentes del BOM
INSERT INTO ERP_BOM_DETALLE (BOM_Id, MateriaPrima_Id, CantidadRequerida, UnidadMedida)
VALUES 
(@BOM_Id, @MateriaMadera, 0.5, 'KG'),      -- 0.5 kg de madera por silla
(@BOM_Id, @MateriaTornillo, 4, 'PZA'),     -- 4 tornillos por silla
(@BOM_Id, @MateriaTela, 0.1, 'M');         -- 0.1 metros de tela por silla

-- 6. Crear almacén de ejemplo
INSERT INTO ERP_ALMACENES (Codigo, Nombre, Direccion, Company_Id)
VALUES ('ALM-001', 'Almacén Principal', 'Av. Principal 123', 1);

DECLARE @Almacen_Id INT = SCOPE_IDENTITY();

-- 7. Agregar stock inicial del producto (20 unidades)
INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
VALUES (@Producto_Id, @Almacen_Id, 20, 10);

-- 8. Agregar stock de materias primas
INSERT INTO ERP_STOCK_MATERIA_PRIMA (MateriaPrima_Id, Almacen_Id, Cantidad, Stock_Minimo)
VALUES 
(@MateriaMadera, @Almacen_Id, 100, 20),    -- 100 kg de madera
(@MateriaTornillo, @Almacen_Id, 1000, 100), -- 1000 tornillos
(@MateriaTela, @Almacen_Id, 50, 10);       -- 50 metros de tela

-- 9. Crear cliente de ejemplo
INSERT INTO ERP_CLIENT (RFC, LegalName, Email, Phone, Company_Id)
VALUES ('XAXX010101000', 'Cliente Ejemplo SA de CV', 'cliente@ejemplo.com', '5551234567', 1);

DECLARE @Client_Id INT = SCOPE_IDENTITY();

-- 10. Verificar datos insertados
SELECT 'Producto creado:' AS Info, * FROM ERP_PRODUCTOS WHERE Producto_Id = @Producto_Id;
SELECT 'BOM creado:' AS Info, * FROM ERP_BOM WHERE BOM_Id = @BOM_Id;
SELECT 'Componentes BOM:' AS Info, * FROM ERP_BOM_DETALLE WHERE BOM_Id = @BOM_Id;
SELECT 'Stock inicial:' AS Info, * FROM ERP_STOCK WHERE Producto_Id = @Producto_Id;
SELECT 'Cliente creado:' AS Info, * FROM ERP_CLIENT WHERE Client_Id = @Client_Id;

PRINT '✓ Datos de ejemplo insertados correctamente';
PRINT 'Producto_Id: ' + CAST(@Producto_Id AS VARCHAR);
PRINT 'Client_Id: ' + CAST(@Client_Id AS VARCHAR);
PRINT 'Almacen_Id: ' + CAST(@Almacen_Id AS VARCHAR);
PRINT 'Stock inicial: 20 unidades';
