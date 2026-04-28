const sql = require('mssql');
const { poolPromise } = require('./config/db');

async function testCerrarOP23() {
  let transaction;
  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    const id = 23;
    const PiezasBuenas = 5;
    const PiezasMerma = 0;

    console.log('1. Obteniendo datos de OP 23...');
    const reqOP = new sql.Request(transaction);
    reqOP.input('OP_Id', sql.Int, id);
    const opResult = await reqOP.query(`SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = @OP_Id;`);

    if (!opResult.recordset || opResult.recordset.length === 0) {
      throw new Error('Orden de producción no encontrada');
    }

    const op = opResult.recordset[0];
    console.log('✅ OP encontrada:', {
      OP_Id: op.OP_Id,
      NumeroOP: op.NumeroOP,
      Producto_Id: op.Producto_Id,
      BOM_Id: op.BOM_Id,
      Estado: op.Estado,
      Company_Id: op.Company_Id
    });

    // Validar que la orden no esté ya cerrada
    if (op.Estado === 'CERRADA') {
      throw new Error('La orden ya está cerrada');
    }

    console.log('\n2. Verificando que el producto existe...');
    const productoCheck = await new sql.Request(transaction)
      .input('Producto_Id', sql.Int, op.Producto_Id)
      .query(`SELECT Producto_Id, Nombre, SKU FROM ERP_PRODUCTOS WHERE Producto_Id = @Producto_Id`);

    if (productoCheck.recordset.length === 0) {
      throw new Error(`El producto con ID ${op.Producto_Id} no existe en el catálogo`);
    }

    console.log('✅ Producto encontrado:', productoCheck.recordset[0]);

    console.log('\n3. Obteniendo almacén de la empresa...');
    const almacenResult = await new sql.Request(transaction)
      .input('Company_Id', sql.Int, op.Company_Id)
      .query(`SELECT TOP 1 Almacen_Id, Nombre FROM ERP_ALMACENES WHERE Company_Id = @Company_Id ORDER BY Almacen_Id`);

    if (almacenResult.recordset.length === 0) {
      throw new Error(`No se encontró almacén para Company_Id ${op.Company_Id}`);
    }

    const almacenId = almacenResult.recordset[0].Almacen_Id;
    console.log('✅ Almacén encontrado:', almacenResult.recordset[0]);

    console.log('\n4. Obteniendo stock actual...');
    const stockResult = await new sql.Request(transaction)
      .input('Producto_Id', sql.Int, op.Producto_Id)
      .input('Almacen_Id', sql.Int, almacenId)
      .query(`SELECT Cantidad FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id`);

    const stockAnterior = stockResult.recordset.length > 0 ? Number(stockResult.recordset[0].Cantidad) : 0;
    const cantidadEntrada = Number(PiezasBuenas);
    const stockNuevo = stockAnterior + cantidadEntrada;

    console.log('Stock anterior:', stockAnterior);
    console.log('Cantidad entrada:', cantidadEntrada);
    console.log('Stock nuevo:', stockNuevo);

    console.log('\n5. Actualizando o insertando stock...');
    if (stockResult.recordset.length > 0) {
      console.log('→ Actualizando stock existente');
      await new sql.Request(transaction)
        .input('Producto_Id', sql.Int, op.Producto_Id)
        .input('Almacen_Id', sql.Int, almacenId)
        .input('Cantidad', sql.Decimal(18, 2), stockNuevo)
        .query(`UPDATE ERP_STOCK SET Cantidad = @Cantidad WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id`);
      console.log('✅ Stock actualizado');
    } else {
      console.log('→ Insertando nuevo registro de stock');
      await new sql.Request(transaction)
        .input('Producto_Id', sql.Int, op.Producto_Id)
        .input('Almacen_Id', sql.Int, almacenId)
        .input('Cantidad', sql.Decimal(18, 2), stockNuevo)
        .query(`INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo) VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0)`);
      console.log('✅ Stock insertado');
    }

    console.log('\n6. Registrando en kardex...');
    await new sql.Request(transaction)
      .input('Producto_Id', sql.Int, op.Producto_Id)
      .input('Almacen_Id', sql.Int, almacenId)
      .input('TipoMovimiento', sql.VarChar, 'ENTRADA')
      .input('Cantidad', sql.Decimal(18, 2), cantidadEntrada)
      .input('Stock_Anterior', sql.Decimal(18, 2), stockAnterior)
      .input('Stock_Actual', sql.Decimal(18, 2), stockNuevo)
      .input('Referencia', sql.VarChar, op.NumeroOP)
      .input('Usuario', sql.VarChar, 'test-script')
      .query(`
        INSERT INTO ERP_KARDEX (
          Producto_Id, Almacen_Id, TipoMovimiento, Cantidad,
          Stock_Anterior, Stock_Actual, Referencia, Usuario, FechaMovimiento
        ) VALUES (
          @Producto_Id, @Almacen_Id, @TipoMovimiento, @Cantidad,
          @Stock_Anterior, @Stock_Actual, @Referencia, @Usuario, GETDATE()
        )
      `);
    console.log('✅ Kardex registrado');

    await transaction.rollback();
    console.log('\n⚠️  Transacción revertida (modo prueba)');
    console.log('\n✅✅✅ PRUEBA EXITOSA ✅✅✅');

  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('\n❌❌❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testCerrarOP23();
