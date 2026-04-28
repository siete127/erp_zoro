const { poolPromise } = require('./config/db');

async function checkProducts() {
  try {
    const pool = await poolPromise;
    
    // Total de productos
    const totalRes = await pool.request().query('SELECT COUNT(*) as Total FROM ERP_PRODUCTOS');
    console.log('Total productos en catálogo:', totalRes.recordset[0].Total);
    
    // Últimos 10 productos
    const lastRes = await pool.request().query('SELECT TOP 10 Producto_Id, SKU, Nombre FROM ERP_PRODUCTOS ORDER BY Producto_Id DESC');
    console.log('\nÚltimos 10 productos:');
    lastRes.recordset.forEach(p => {
      console.log(`  ${p.Producto_Id} - ${p.SKU || 'Sin SKU'} - ${p.Nombre || 'Sin nombre'}`);
    });
    
    // Verificar producto 893
    const prod893 = await pool.request().input('ProdId', 893).query('SELECT * FROM ERP_PRODUCTOS WHERE Producto_Id = @ProdId');
    console.log('\n¿Existe producto 893?', prod893.recordset.length > 0 ? 'SÍ' : 'NO');
    
    // Buscar productos cercanos al 893
    const cercanos = await pool.request().query('SELECT Producto_Id, SKU, Nombre FROM ERP_PRODUCTOS WHERE Producto_Id BETWEEN 880 AND 900 ORDER BY Producto_Id');
    console.log('\nProductos entre ID 880-900:');
    if (cercanos.recordset.length === 0) {
      console.log('  (ninguno)');
    } else {
      cercanos.recordset.forEach(p => {
        console.log(`  ${p.Producto_Id} - ${p.SKU || 'Sin SKU'} - ${p.Nombre || 'Sin nombre'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkProducts();
