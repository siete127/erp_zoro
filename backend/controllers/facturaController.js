const facturamaService = require("../services/facturamaService");
const { poolPromise, sql } = require('../config/db');

exports.facturar = async (req, res) => {
  try {
    const companyId = Number(req.body?.Company_Id || req.body?.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ success: false, message: 'Debe enviar Company_Id válido' });
    }

    if (!req.isAdmin && Array.isArray(req.userCompanies) && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(companyId)) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para facturar en esta empresa' });
      }
    }

    const conceptos = req.body?.Conceptos || req.body?.items || [];
    if (!Array.isArray(conceptos) || conceptos.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe enviar al menos un concepto para facturar' });
    }

    const cfdiData = {
      Receptor: req.body?.Receptor || {
        Rfc: req.body?.rfc,
        Nombre: req.body?.nombre,
        Email: req.body?.email,
        UsoCfdi: req.body?.UsoCFDI || req.body?.CfdiUse || 'G03',
        FiscalRegime: req.body?.FiscalRegime || req.body?.RegimenFiscalReceptor,
        TaxZipCode: req.body?.TaxZipCode || req.body?.CodigoPostalReceptor,
      },
      Conceptos: conceptos,
      FormaPago: req.body?.FormaPago || req.body?.PaymentForm || '01',
      MetodoPago: req.body?.MetodoPago || req.body?.PaymentMethod || 'PUE',
      Moneda: req.body?.Moneda || req.body?.Currency || 'MXN',
    };

    const factura = await facturamaService.buildFacturaPayload(cfdiData, companyId);
    const resultado = await facturamaService.timbrarMultiemisor(factura);

    // Intentar persistir la factura en ERP_FACTURAS y crear asientos en ERP_LEDGER
    try {
      const pool = await poolPromise;
      const transaction = new (require('mssql').Transaction)(pool.pool || pool);
      await transaction.begin();

      // Calcular totales (intentamos leer de resultado, si no, calculamos desde Conceptos)
      function safeNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      }

      let Subtotal = safeNumber(resultado.SubTotal || resultado.Subtotal || resultado.Subtotal || 0);
      let IVA = safeNumber(resultado.Tax || resultado.IVA || resultado.Iva || 0);
      let Total = safeNumber(resultado.Total || resultado.total || 0);

      if (!Total || !Subtotal) {
        // Intentar calcular desde Conceptos
        const conceptos = cfdiData?.Conceptos || [];
        Subtotal = conceptos.reduce((s, c) => s + (safeNumber(c.ValorUnitario || c.UnitPrice || c.Price || c.Precio) * safeNumber(c.Cantidad || c.Quantity || 1)), 0);
        // IVA aproximado: buscar impuesto en cada concepto
        IVA = conceptos.reduce((s, c) => s + (safeNumber(c.Taxes || c.Impuestos || 0)), 0) || IVA;
        Total = Subtotal + IVA;
      }

      const uuid = resultado.Complement?.TaxStamp?.Uuid || resultado.Uuid || 'TEMP-' + Date.now();
      const facturamaId = resultado.Id || uuid;

      const reqTran = transaction.request();
      reqTran.input('Company_Id', sql.Int, companyId)
        .input('UUID', sql.VarChar(50), uuid)
        .input('FacturamaId', sql.VarChar(50), facturamaId)
        .input('Serie', sql.VarChar(10), resultado.Serie || null)
        .input('Folio', sql.VarChar(20), resultado.Folio || null)
        .input('EmisorRFC', sql.VarChar(13), factura.Issuer?.Rfc || factura.Issuer?.Rfc || null)
        .input('ReceptorRFC', sql.VarChar(13), factura.Receiver?.Rfc || factura.Receptor?.Rfc || null)
        .input('ReceptorNombre', sql.VarChar(255), factura.Receiver?.Name || factura.Receptor?.Nombre || null)
        .input('Subtotal', sql.Decimal(18, 2), Subtotal)
        .input('IVA', sql.Decimal(18, 2), IVA)
        .input('Total', sql.Decimal(18, 2), Total)
        .input('Moneda', sql.VarChar(3), factura.Currency || factura.Moneda || 'MXN')
        .input('MetodoPago', sql.VarChar(10), cfdiData?.MetodoPago || cfdiData?.PaymentMethod || 'PUE')
        .input('FormaPago', sql.VarChar(10), cfdiData?.FormaPago || cfdiData?.PaymentForm || '01')
        .input('Status', sql.VarChar(20), 'Vigente')
        .input('CreadoPor', sql.VarChar(50), req.user?.Username || 'sistema');

      const insertFacturaQ = `
        INSERT INTO ERP_FACTURAS (
          Company_Id, UUID, FacturamaId, Serie, Folio, EmisorRFC, ReceptorRFC, ReceptorNombre,
          Subtotal, IVA, Total, Moneda, MetodoPago, FormaPago, Status, FechaTimbrado, CreadoPor, FechaCreacion
        ) VALUES (
          @Company_Id, @UUID, @FacturamaId, @Serie, @Folio, @EmisorRFC, @ReceptorRFC, @ReceptorNombre,
          @Subtotal, @IVA, @Total, @Moneda, @MetodoPago, @FormaPago, @Status, GETDATE(), @CreadoPor, GETDATE()
        ); SELECT SCOPE_IDENTITY() AS Factura_Id;`;

      // Evitar duplicados: verificar si ya existe una factura con ese FacturamaId o UUID
      const existingQ = `SELECT TOP 1 Factura_Id FROM ERP_FACTURAS WHERE FacturamaId = @FacturamaId OR UUID = @UUID`;
      const existingR = await reqTran.query(existingQ);
      let insertedFacturaId = null;
      if (existingR.recordset && existingR.recordset.length) {
        insertedFacturaId = Number(existingR.recordset[0].Factura_Id);
      } else {
        const facturaResult = await reqTran.query(insertFacturaQ);
        insertedFacturaId = facturaResult.recordset && facturaResult.recordset[0] ? Number(facturaResult.recordset[0].Factura_Id) : null;
      }

      // Intentar generar asientos contables si existe ERP_LEDGER y ERP_ACCOUNTS
      try {
        // Helper para buscar account code por palabras clave
        const findAccountCode = async (keywords = []) => {
          try {
            const search = keywords.map(k => `LOWER(Name) LIKE '%${k}%'`).join(' OR ');
            const q = `SELECT TOP 1 AccountCode FROM ERP_ACCOUNTS WHERE (${search}) AND Company_Id = @Company_Id`;
            const r = await transaction.request().input('Company_Id', sql.Int, companyId).query(q);
            if (r.recordset && r.recordset[0]) return r.recordset[0].AccountCode;
            return null;
          } catch (e) {
            return null;
          }
        };

        // Buscar cuentas: clientes (CxC), ventas (ingresos), IVA (pasivo)
        let accountReceivable = await findAccountCode(['cliente','clientes','por cobrar','cxp']);
        let accountRevenue = await findAccountCode(['venta','ventas','ingreso','ingresos']);
        let accountVAT = await findAccountCode(['iva','impuesto']);

        // Fallbacks simples si no se encuentran cuentas
        accountReceivable = accountReceivable || '1300';
        accountRevenue = accountRevenue || '4000';
        accountVAT = accountVAT || '2100';

        // Insertar asientos: Debitar CxC, Acreditar Ventas, Acreditar IVA (si IVA>0)
        const ledgerInsert = async (acctCode, debit, credit, refId, desc) => {
          await transaction.request()
            .input('Date', sql.DateTime, new Date())
            .input('AccountCode', sql.VarChar(50), acctCode)
            .input('Debit', sql.Decimal(18,2), debit)
            .input('Credit', sql.Decimal(18,2), credit)
            .input('Reference_Id', sql.Int, refId)
            .input('Company_Id', sql.Int, companyId)
            .input('Description', sql.VarChar(500), desc)
            .query(`INSERT INTO ERP_LEDGER (Date, AccountCode, Debit, Credit, Reference_Id, Company_Id, Description, CreatedAt)
                    VALUES (@Date, @AccountCode, @Debit, @Credit, @Reference_Id, @Company_Id, @Description, GETDATE())`);
        };

        const refIdForLedger = insertedFacturaId || null;

        // Evitar duplicar asientos: comprobar si ya existen registros en ERP_LEDGER para esta referencia
        let existingLedgerCount = 0;
        try {
          const ledRes = await transaction.request().input('RefId', sql.Int, refIdForLedger).query('SELECT COUNT(1) AS cnt FROM ERP_LEDGER WHERE Reference_Id = @RefId');
          existingLedgerCount = (ledRes.recordset && ledRes.recordset[0] && Number(ledRes.recordset[0].cnt)) || 0;
        } catch (e) {
          existingLedgerCount = 0; // si falla la consulta, proceder con inserción y capturar posible error
        }

        if (existingLedgerCount === 0) {
          // Debito CxC = Total
          await ledgerInsert(accountReceivable, Total, 0, refIdForLedger, `Factura ${facturamaId} - Receptor ${factura.Receiver?.Rfc || factura.Receptor?.Rfc || ''}`);

          // Credito Ventas = Subtotal
          if (Subtotal && Subtotal > 0) {
            await ledgerInsert(accountRevenue, 0, Subtotal, refIdForLedger, `Factura ${facturamaId} - Venta`);
          }

          // Credito IVA = IVA
          if (IVA && IVA > 0) {
            await ledgerInsert(accountVAT, 0, IVA, refIdForLedger, `Factura ${facturamaId} - IVA`);
          }
        } else {
          // ya existen asientos para esta factura, no insertar de nuevo
          console.log('Asientos ya existen para Factura_Id', refIdForLedger, ', se omite inserción.');
        }
      } catch (ledgerErr) {
        console.warn('No se pudo insertar en ERP_LEDGER o buscar cuentas (se ignorará):', ledgerErr?.message || ledgerErr);
      }

      await transaction.commit();
    } catch (persistErr) {
      console.error('Error guardando factura en ERP o creando asientos:', persistErr);
      try { if (persistErr && persistErr.transaction) await persistErr.transaction.rollback(); } catch(e){}
    }

    res.status(200).json({
      success: true,
      uuid: resultado.Complement?.TaxStamp?.Uuid || resultado.Uuid || resultado.Id,
      facturamaId: resultado.Id,
      data: resultado
    });

  } catch (error) {
    const message = error?.Message || error?.message || 'Error al facturar';
    const statusCode = error instanceof Error ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message,
      error
    });
  }
};

// Forzar cancelación local (solo para pruebas/admin) — no llama a Facturama
exports.forceCancelarFactura = async (req, res) => {
  try {
    const facturaId = Number(req.params?.id);
    if (!Number.isInteger(facturaId) || facturaId <= 0) {
      return res.status(400).json({ success: false, message: 'Debe enviar un Factura_Id válido' });
    }

    const pool = await poolPromise;
    const facturaResult = await pool.request()
      .input('Factura_Id', sql.Int, facturaId)
      .query(`
        SELECT Factura_Id, Company_Id, Venta_Id, FacturamaId, UUID, Status
        FROM ERP_FACTURAS
        WHERE Factura_Id = @Factura_Id
      `);

    if (!facturaResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    const factura = facturaResult.recordset[0];

    if (String(factura.Status || '').trim().toLowerCase() === 'cancelada') {
      return res.status(200).json({ success: true, message: 'La factura ya estaba marcada como cancelada', data: { facturaId: factura.Factura_Id } });
    }

    await pool.request()
      .input('Factura_Id', sql.Int, facturaId)
      .input('Status', sql.VarChar(20), 'Cancelada')
      .query(`
        UPDATE ERP_FACTURAS
        SET Status = @Status
        WHERE Factura_Id = @Factura_Id
      `);

    return res.status(200).json({ success: true, message: 'Factura marcada como cancelada (prueba)', data: { facturaId } });
  } catch (error) {
    console.error('Error forceCancelarFactura:', error);
    res.status(500).json({ success: false, message: 'Error marcando factura como cancelada', error });
  }
};

exports.cancelarFactura = async (req, res) => {
  try {
    const facturaId = Number(req.params?.id);
    if (!Number.isInteger(facturaId) || facturaId <= 0) {
      return res.status(400).json({ success: false, message: 'Debe enviar un Factura_Id válido' });
    }

    const motivo = String(req.body?.motivo || '02').trim();
    const folioSustitucionRaw = req.body?.folioSustitucion || req.body?.uuidReplacement || null;
    const folioSustitucion = folioSustitucionRaw ? String(folioSustitucionRaw).trim() : null;

    if (!['01', '02', '03', '04'].includes(motivo)) {
      return res.status(400).json({ success: false, message: 'Motivo inválido. Use 01, 02, 03 o 04' });
    }

    if (motivo === '01' && !folioSustitucion) {
      return res.status(400).json({
        success: false,
        message: 'Para motivo 01 debe enviar folioSustitucion (UUID de reemplazo)'
      });
    }

    const pool = await poolPromise;
    const facturaResult = await pool.request()
      .input('Factura_Id', sql.Int, facturaId)
      .query(`
        SELECT Factura_Id, Company_Id, Venta_Id, FacturamaId, UUID, Status
        FROM ERP_FACTURAS
        WHERE Factura_Id = @Factura_Id
      `);

    if (!facturaResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    const factura = facturaResult.recordset[0];

    if (!req.isAdmin && Array.isArray(req.userCompanies) && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(Number(factura.Company_Id))) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para cancelar esta factura' });
      }
    }

    if (String(factura.Status || '').trim().toLowerCase() === 'cancelada') {
      return res.status(200).json({
        success: true,
        message: 'La factura ya estaba cancelada',
        data: {
          facturaId: factura.Factura_Id,
          status: 'Cancelada'
        }
      });
    }

    const cfdiCandidates = [factura.FacturamaId, factura.UUID]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0 && !value.startsWith('TEMP-'));

    if (!cfdiCandidates.length) {
      return res.status(400).json({
        success: false,
        message: 'La factura no tiene un identificador válido en Facturama para cancelar'
      });
    }

    let cancelacionResponse = null;
    let lastCancelError = null;

    for (const cfdiId of cfdiCandidates) {
      try {
        cancelacionResponse = await facturamaService.cancelarCFDI(cfdiId, motivo, folioSustitucion);
        break;
      } catch (cancelError) {
        // Prefer errors that carry a meaningful Message from Facturama over generic ones
        const currentHasMessage = !!(cancelError?.Message || cancelError?.message?.includes('Facturama'));
        const lastHasMessage = !!(lastCancelError?.Message || lastCancelError?.message?.includes('Facturama'));
        if (!lastCancelError || currentHasMessage || !lastHasMessage) {
          lastCancelError = cancelError;
        }
      }
    }

    if (!cancelacionResponse) {
      throw lastCancelError || { Message: 'No se pudo cancelar el CFDI en Facturama' };
    }

    await pool.request()
      .input('Factura_Id', sql.Int, facturaId)
      .input('Status', sql.VarChar(20), 'Cancelada')
      .query(`
        UPDATE ERP_FACTURAS
        SET Status = @Status
        WHERE Factura_Id = @Factura_Id
      `);

    res.status(200).json({
      success: true,
      message: 'Factura cancelada correctamente',
      data: {
        facturaId: factura.Factura_Id,
        ventaId: factura.Venta_Id,
        status: 'Cancelada',
        facturama: cancelacionResponse
      }
    });
  } catch (error) {
    const message = error?.Message || error?.message || 'Error al cancelar factura';
    const facturamaStatus = Number(error?.status || error?.StatusCode || 0);

    let statusCode = 500;
    if (error?.Message) statusCode = 400;
    if ([400, 401, 403, 404, 409, 422].includes(facturamaStatus)) statusCode = 400;
    if (facturamaStatus >= 500) statusCode = 502;

    res.status(statusCode).json({
      success: false,
      message,
      error
    });
  }
};