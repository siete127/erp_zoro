const sql = require('mssql');
const { poolPromise } = require('./config/db');

async function testCerrarOportunidad() {
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log('1. Leyendo oportunidad 11...');
    const opRequest = new sql.Request(transaction);
    const opResult = await opRequest
      .input('Oportunidad_Id', sql.Int, 11)
      .query('SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id');

    if (opResult.recordset.length === 0) {
      console.error('❌ Oportunidad no encontrada');
      await transaction.rollback();
      return;
    }

    const oportunidad = opResult.recordset[0];
    console.log('✅ Oportunidad encontrada:', {
      Oportunidad_Id: oportunidad.Oportunidad_Id,
      Company_Id: oportunidad.Company_Id,
      Client_Id: oportunidad.Client_Id,
      MontoEstimado: oportunidad.MontoEstimado,
      ID_COTIZACION: oportunidad.ID_COTIZACION
    });

    console.log('\n2. Leyendo cliente...');
    const clienteReq = new sql.Request(transaction);
    const clienteRes = await clienteReq
      .input('Client_Id', sql.Int, oportunidad.Client_Id)
      .query('SELECT TOP 1 LegalName, CommercialName, RFC FROM ERP_CLIENT WHERE Client_Id = @Client_Id');

    if (clienteRes.recordset.length === 0) {
      console.error('❌ Cliente no encontrado');
      await transaction.rollback();
      return;
    }

    const cliente = clienteRes.recordset[0];
    console.log('✅ Cliente encontrado:', cliente);

    // Calcular montos
    const montoBase = Number(oportunidad.MontoEstimado) || 0;
    const subtotal = montoBase / 1.16;
    const iva = subtotal * 0.16;
    const total = montoBase;

    console.log('\n3. Montos calculados:', {
      MontoEstimado: montoBase,
      Subtotal: subtotal.toFixed(2),
      IVA: iva.toFixed(2),
      Total: total.toFixed(2)
    });

    console.log('\n4. Intentando insertar en ERP_VENTAS...');
    const ventaReq = new sql.Request(transaction);
    const ventaRes = await ventaReq
      .input('Company_Id', sql.Int, oportunidad.Company_Id)
      .input('Moneda', sql.VarChar(3), oportunidad.Moneda || 'MXN')
      .input('Subtotal', sql.Decimal(18, 2), subtotal)
      .input('IVA', sql.Decimal(18, 2), iva)
      .input('Total', sql.Decimal(18, 2), total)
      .input('Status_Id', sql.Int, 2)
      .input('ID_COTIZACION', sql.Int, oportunidad.ID_COTIZACION || null)
      .input('Client_Id', sql.Int, oportunidad.Client_Id)
      .query(`
        INSERT INTO ERP_VENTAS
          (Company_Id, Total, IVA, Subtotal, Moneda, Status_Id, FechaVenta, Status, ID_COTIZACION, Client_Id)
        OUTPUT INSERTED.Venta_Id
        VALUES
          (@Company_Id, @Total, @IVA, @Subtotal, @Moneda, @Status_Id, GETDATE(), 'Completada', @ID_COTIZACION, @Client_Id);
      `);

    const nuevaVentaId = ventaRes.recordset[0].Venta_Id;
    console.log('✅ Venta creada exitosamente! Venta_Id:', nuevaVentaId);

    console.log('\n5. Actualizando oportunidad...');
    const cierreReq = new sql.Request(transaction);
    await cierreReq
      .input('Oportunidad_Id', sql.Int, 11)
      .input('Status', sql.NVarChar(50), 'Ganada')
      .input('Venta_Id', sql.Int, nuevaVentaId)
      .query(`
        UPDATE ERP_CRM_OPORTUNIDADES
        SET Status = @Status,
            Venta_Id = @Venta_Id,
            FechaCierreReal = GETDATE(),
            FechaModificacion = GETDATE()
        WHERE Oportunidad_Id = @Oportunidad_Id;
      `);

    console.log('✅ Oportunidad actualizada');

    await transaction.rollback(); // Revertir para no afectar datos reales
    console.log('\n⚠️  Transacción revertida (modo prueba)');
    console.log('\n✅✅✅ PRUEBA EXITOSA - El código funciona correctamente ✅✅✅');

  } catch (error) {
    console.error('\n❌❌❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testCerrarOportunidad();
