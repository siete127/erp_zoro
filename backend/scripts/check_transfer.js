const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;

    // 1. Kardex de la OP-2026-00053 (OP 20 - Company=1 PTC, Solicitante=2 CALI, CERRADA)
    const kardex = await pool.request().query(`
      SELECT Kardex_Id, Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, 
             Stock_Anterior, Stock_Actual, Referencia
      FROM ERP_KARDEX 
      WHERE Referencia LIKE '%OP-2026-00053%' 
      ORDER BY Kardex_Id
    `);
    console.log('\n=== KARDEX OP-2026-00053 (PTC->CALI) ===');
    console.table(kardex.recordset);

    // 2. Stock actual producto 893 en todos los almacenes
    const stock = await pool.request().query(`
      SELECT s.Producto_Id, s.Almacen_Id, a.Nombre AS AlmacenNombre, 
             a.Company_Id, c.NameCompany, s.Cantidad
      FROM ERP_STOCK s
      INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
      LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
      WHERE s.Producto_Id = 893
    `);
    console.log('\n=== STOCK PRODUCTO 893 EN TODOS LOS ALMACENES ===');
    console.table(stock.recordset);

    // 3. Almacenes por empresa
    const almacenes = await pool.request().query(`
      SELECT a.Almacen_Id, a.Nombre, a.Codigo, a.Company_Id, c.NameCompany, a.Activo
      FROM ERP_ALMACENES a
      LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
      ORDER BY a.Company_Id, a.Almacen_Id
    `);
    console.log('\n=== TODOS LOS ALMACENES ===');
    console.table(almacenes.recordset);

    // 4. Todas las OP cerradas donde Company != Solicitante
    const opsTransfer = await pool.request().query(`
      SELECT OP_Id, NumeroOP, Company_Id, CompanySolicitante_Id, 
             Producto_Id, Estado, CantidadProducida
      FROM ERP_OP_PRODUCCION 
      WHERE Estado = 'CERRADA' AND CompanySolicitante_Id IS NOT NULL 
            AND CompanySolicitante_Id != Company_Id
      ORDER BY OP_Id DESC
    `);
    console.log('\n=== OPs CERRADAS CON SOLICITANTE DIFERENTE ===');
    console.table(opsTransfer.recordset);

    // 5. Buscar kardex con TRANSFERENCIA para esas OPs
    const transferKardex = await pool.request().query(`
      SELECT Kardex_Id, Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, 
             Stock_Anterior, Stock_Actual, Referencia
      FROM ERP_KARDEX 
      WHERE TipoMovimiento IN ('TRANSFERENCIA_OUT', 'TRANSFERENCIA_IN')
      ORDER BY Kardex_Id DESC
    `);
    console.log('\n=== KARDEX CON TRANSFERENCIAS ===');
    console.table(transferKardex.recordset);

    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
