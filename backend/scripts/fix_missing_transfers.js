/**
 * Script para corregir las OPs cerradas que NO tuvieron transferencia automática.
 * Busca OPs CERRADAS donde Company_Id != CompanySolicitante_Id y no existe
 * movimiento TRANSFERENCIA_OUT en el kardex.
 */
const { poolPromise, sql } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;

    // Buscar OPs cerradas con solicitante diferente que no tienen transferencia
    const result = await pool.request().query(`
      SELECT op.OP_Id, op.NumeroOP, op.Company_Id, op.CompanySolicitante_Id,
             op.Producto_Id, op.CantidadProducida,
             p.Nombre AS ProductoNombre
      FROM ERP_OP_PRODUCCION op
      LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
      WHERE op.Estado = 'CERRADA'
        AND op.CompanySolicitante_Id IS NOT NULL
        AND op.CompanySolicitante_Id != op.Company_Id
        AND op.CantidadProducida > 0
        AND NOT EXISTS (
          SELECT 1 FROM ERP_KARDEX k 
          WHERE k.Referencia = op.NumeroOP + '-TRANSFER'
          AND k.TipoMovimiento = 'TRANSFERENCIA_OUT'
        )
    `);

    if (result.recordset.length === 0) {
      console.log('✅ No hay OPs pendientes de transferencia. Todo está al día.');
      process.exit(0);
    }

    console.log(`🔧 Se encontraron ${result.recordset.length} OP(s) cerradas sin transferencia:`);
    console.table(result.recordset);

    for (const op of result.recordset) {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const cantidadTransferir = Number(op.CantidadProducida);
        const referenciaTransfer = `${op.NumeroOP}-TRANSFER`;

        // Obtener almacén de la empresa productora
        const almProdResult = await new sql.Request(transaction)
          .input('Company_Id', sql.Int, op.Company_Id)
          .query(`SELECT TOP 1 Almacen_Id, Nombre FROM ERP_ALMACENES WHERE Company_Id = @Company_Id AND Activo = 1 ORDER BY Almacen_Id`);

        if (almProdResult.recordset.length === 0) {
          console.warn(`  ⚠️ OP ${op.NumeroOP}: No hay almacén para empresa productora (${op.Company_Id}). Saltando.`);
          await transaction.rollback();
          continue;
        }

        const almacenProdId = almProdResult.recordset[0].Almacen_Id;
        const almacenProdNombre = almProdResult.recordset[0].Nombre;

        // Obtener almacén del solicitante
        const almSolResult = await new sql.Request(transaction)
          .input('Company_Id', sql.Int, op.CompanySolicitante_Id)
          .query(`SELECT TOP 1 Almacen_Id, Nombre FROM ERP_ALMACENES WHERE Company_Id = @Company_Id AND Activo = 1 ORDER BY Almacen_Id`);

        if (almSolResult.recordset.length === 0) {
          console.warn(`  ⚠️ OP ${op.NumeroOP}: No hay almacén para empresa solicitante (${op.CompanySolicitante_Id}). Saltando.`);
          await transaction.rollback();
          continue;
        }

        const almacenSolId = almSolResult.recordset[0].Almacen_Id;
        const almacenSolNombre = almSolResult.recordset[0].Nombre;

        console.log(`\n  📦 Procesando OP ${op.NumeroOP}: ${cantidadTransferir} unidades de "${op.ProductoNombre}"`);
        console.log(`     ${almacenProdNombre} (${almacenProdId}) → ${almacenSolNombre} (${almacenSolId})`);

        // SALIDA del almacén productor
        const stockProdResult = await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenProdId)
          .query(`SELECT Cantidad FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id`);

        const stockProdAntes = stockProdResult.recordset.length > 0 ? Number(stockProdResult.recordset[0].Cantidad) : 0;
        const stockProdDespues = stockProdAntes - cantidadTransferir;

        if (stockProdDespues < 0) {
          console.warn(`  ⚠️ OP ${op.NumeroOP}: Stock insuficiente en almacén productor (tiene ${stockProdAntes}, necesita ${cantidadTransferir}). Saltando.`);
          await transaction.rollback();
          continue;
        }

        await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenProdId)
          .input('Cantidad', sql.Decimal(18, 2), stockProdDespues)
          .query(`
            IF EXISTS (SELECT 1 FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id)
              UPDATE ERP_STOCK SET Cantidad = @Cantidad WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
            ELSE
              INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo) VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0)
          `);

        await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenProdId)
          .input('TipoMovimiento', sql.VarChar, 'TRANSFERENCIA_OUT')
          .input('Cantidad', sql.Decimal(18, 2), cantidadTransferir)
          .input('Stock_Anterior', sql.Decimal(18, 2), stockProdAntes)
          .input('Stock_Actual', sql.Decimal(18, 2), stockProdDespues)
          .input('Referencia', sql.VarChar, referenciaTransfer)
          .input('Usuario', sql.VarChar, 'sistema-correccion')
          .query(`
            INSERT INTO ERP_KARDEX (Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, Stock_Anterior, Stock_Actual, Referencia, Usuario, FechaMovimiento)
            VALUES (@Producto_Id, @Almacen_Id, @TipoMovimiento, @Cantidad, @Stock_Anterior, @Stock_Actual, @Referencia, @Usuario, GETDATE())
          `);

        // ENTRADA al almacén solicitante
        const stockSolResult = await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenSolId)
          .query(`SELECT Cantidad FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id`);

        const stockSolAntes = stockSolResult.recordset.length > 0 ? Number(stockSolResult.recordset[0].Cantidad) : 0;
        const stockSolDespues = stockSolAntes + cantidadTransferir;

        await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenSolId)
          .input('Cantidad', sql.Decimal(18, 2), stockSolDespues)
          .query(`
            IF EXISTS (SELECT 1 FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id)
              UPDATE ERP_STOCK SET Cantidad = @Cantidad WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
            ELSE
              INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo) VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0)
          `);

        await new sql.Request(transaction)
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Almacen_Id', sql.Int, almacenSolId)
          .input('TipoMovimiento', sql.VarChar, 'TRANSFERENCIA_IN')
          .input('Cantidad', sql.Decimal(18, 2), cantidadTransferir)
          .input('Stock_Anterior', sql.Decimal(18, 2), stockSolAntes)
          .input('Stock_Actual', sql.Decimal(18, 2), stockSolDespues)
          .input('Referencia', sql.VarChar, referenciaTransfer)
          .input('Usuario', sql.VarChar, 'sistema-correccion')
          .query(`
            INSERT INTO ERP_KARDEX (Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, Stock_Anterior, Stock_Actual, Referencia, Usuario, FechaMovimiento)
            VALUES (@Producto_Id, @Almacen_Id, @TipoMovimiento, @Cantidad, @Stock_Anterior, @Stock_Actual, @Referencia, @Usuario, GETDATE())
          `);

        await transaction.commit();
        console.log(`  ✅ OP ${op.NumeroOP}: Transferencia completada. Stock PTC: ${stockProdAntes}→${stockProdDespues}, Stock Solicitante: ${stockSolAntes}→${stockSolDespues}`);

      } catch (err) {
        await transaction.rollback();
        console.error(`  ❌ OP ${op.NumeroOP}: Error - ${err.message}`);
      }
    }

    // Verificar resultado final
    const stockFinal = await pool.request().query(`
      SELECT s.Producto_Id, s.Almacen_Id, a.Nombre AS AlmacenNombre, 
             a.Company_Id, c.NameCompany, s.Cantidad
      FROM ERP_STOCK s
      INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
      LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
      WHERE s.Producto_Id = 893
    `);
    console.log('\n=== STOCK FINAL PRODUCTO 893 ===');
    console.table(stockFinal.recordset);

    const transferKardex = await pool.request().query(`
      SELECT Kardex_Id, Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, 
             Stock_Anterior, Stock_Actual, Referencia
      FROM ERP_KARDEX 
      WHERE TipoMovimiento IN ('TRANSFERENCIA_OUT', 'TRANSFERENCIA_IN')
      ORDER BY Kardex_Id
    `);
    console.log('\n=== KARDEX TRANSFERENCIAS ===');
    console.table(transferKardex.recordset);

    process.exit(0);
  } catch (e) {
    console.error('ERROR GENERAL:', e.message);
    process.exit(1);
  }
})();
