const { pool } = require('./config/db');

(async () => {
  try {
    const result = await pool.request()
      .query(`
        SELECT TOP 10 
          OP_Id, NumeroOP, Estado, Prioridad, CantidadPlanificada, FechaCreacion
        FROM ERP_OP_PRODUCCION 
        WHERE Producto_Id IN (
          SELECT Producto_Id FROM ERP_PRODUCTOS WHERE SKU = 'UDM'
        )
        ORDER BY FechaCreacion DESC
      `);
    
    console.log('Órdenes encontradas para SKU UDM:');
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch(e) { 
    console.error('ERROR:', e.message); 
  }
  process.exit();
})();
