const sql = require('mssql');
const { poolPromise } = require('./config/db');

async function recreateProduct893() {
  try {
    const pool = await poolPromise;
    
    console.log('Recreando producto 893...\n');
    
    // Insertar producto 893 basado en estructura similar
    await pool.request()
      .input('Producto_Id', sql.Int, 893)
      .input('SKU', sql.VarChar, 'PROD893')
      .input('Nombre', sql.NVarChar, 'Producto 893 (Recuperado)')
      .input('Descripcion', sql.NVarChar, 'Producto recreado para cerrar órdenes de producción pendientes')
      .input('Precio', sql.Decimal(18, 2), 0)
      .input('ClaveProdServSAT', sql.VarChar, '01010101')
      .input('ClaveUnidadSAT', sql.VarChar, 'H87')
      .query(`
        SET IDENTITY_INSERT ERP_PRODUCTOS ON;
        
        INSERT INTO ERP_PRODUCTOS (
          Producto_Id, SKU, Nombre, Descripcion, Precio, 
          Activo, ClaveProdServSAT, ClaveUnidadSAT, FechaCreacion
        )
        VALUES (
          @Producto_Id, @SKU, @Nombre, @Descripcion, @Precio,
          1, @ClaveProdServSAT, @ClaveUnidadSAT, GETDATE()
        );
        
        SET IDENTITY_INSERT ERP_PRODUCTOS OFF;
      `);
    
    console.log('✅ Producto 893 recreado exitosamente');
    
    // Verificar
    const check = await pool.request()
      .input('ProdId', 893)
      .query('SELECT * FROM ERP_PRODUCTOS WHERE Producto_Id = @ProdId');
    
    console.log('\nProducto verificado:');
    console.log(JSON.stringify(check.recordset[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

recreateProduct893();
