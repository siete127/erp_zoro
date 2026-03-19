const sql = require('mssql');
const { poolPromise } = require('../config/db');
const facturamaService = require('../services/facturamaService');

// Crear complemento de pago
exports.crearComplementoPago = async (req, res) => {
  try {
    const { 
      Company_Id, FechaPago, FormaPago, Moneda = 'MXN', Monto, 
      NumOperacion, CtaOrdenante, CtaBeneficiario, facturas 
    } = req.body;
    const userId = req.user?.Username || 'sistema';
    
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Crear complemento de pago
      const complementoResult = await transaction.request()
        .input('Company_Id', sql.Int, Company_Id)
        .input('FechaPago', sql.DateTime, new Date(FechaPago))
        .input('FormaPago', sql.VarChar, FormaPago)
        .input('Moneda', sql.VarChar, Moneda)
        .input('Monto', sql.Decimal(18, 2), Monto)
        .input('NumOperacion', sql.VarChar, NumOperacion || null)
        .input('CtaOrdenante', sql.VarChar, CtaOrdenante || null)
        .input('CtaBeneficiario', sql.VarChar, CtaBeneficiario || null)
        .input('CreadoPor', sql.VarChar, userId)
        .query(`
          INSERT INTO ERP_COMPLEMENTOS_PAGO 
          (Company_Id, FechaPago, FormaPago, Moneda, Monto, NumOperacion, CtaOrdenante, CtaBeneficiario, CreadoPor)
          OUTPUT INSERTED.*
          VALUES (@Company_Id, @FechaPago, @FormaPago, @Moneda, @Monto, @NumOperacion, @CtaOrdenante, @CtaBeneficiario, @CreadoPor)
        `);
      
      const complemento = complementoResult.recordset[0];
      
      // Relacionar con facturas
      for (const factura of facturas) {
        await transaction.request()
          .input('ComplementoPago_Id', sql.Int, complemento.ComplementoPago_Id)
          .input('Factura_Id', sql.Int, factura.Factura_Id)
          .input('MontoPagado', sql.Decimal(18, 2), factura.MontoPagado)
          .input('NumParcialidad', sql.Int, factura.NumParcialidad || 1)
          .input('SaldoAnterior', sql.Decimal(18, 2), factura.SaldoAnterior)
          .input('SaldoInsoluto', sql.Decimal(18, 2), factura.SaldoInsoluto)
          .query(`
            INSERT INTO ERP_COMPLEMENTO_FACTURA 
            (ComplementoPago_Id, Factura_Id, MontoPagado, NumParcialidad, SaldoAnterior, SaldoInsoluto)
            VALUES (@ComplementoPago_Id, @Factura_Id, @MontoPagado, @NumParcialidad, @SaldoAnterior, @SaldoInsoluto)
          `);
      }
      
      await transaction.commit();
      
      res.status(201).json({
        success: true,
        message: 'Complemento de pago creado. Procede a timbrar.',
        data: complemento
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al crear complemento de pago:', error);
    res.status(500).json({ success: false, message: 'Error al crear complemento de pago', error: error.message });
  }
};

// Timbrar complemento de pago en Facturama
exports.timbrarComplementoPago = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = await poolPromise;
    
    // Obtener complemento con datos de la empresa
    const complementoResult = await pool.request()
      .input('ComplementoPago_Id', sql.Int, id)
      .query(`
        SELECT cp.*, c.RFC as EmisorRFC, c.LegalName as EmisorNombre, 
               c.FiscalRegime, c.TaxZipCode
        FROM ERP_COMPLEMENTOS_PAGO cp
        INNER JOIN ERP_COMPANY c ON cp.Company_Id = c.Company_Id
        WHERE cp.ComplementoPago_Id = @ComplementoPago_Id
      `);
    
    if (complementoResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Complemento de pago no encontrado' });
    }
    
    const complemento = complementoResult.recordset[0];
    
    // Obtener facturas relacionadas
    const facturasResult = await pool.request()
      .input('ComplementoPago_Id', sql.Int, id)
      .query(`
        SELECT cf.*, f.UUID, f.Serie, f.Folio, f.Moneda as MonedaDR, f.ReceptorRFC, f.ReceptorNombre
        FROM ERP_COMPLEMENTO_FACTURA cf
        INNER JOIN ERP_FACTURAS f ON cf.Factura_Id = f.Factura_Id
        WHERE cf.ComplementoPago_Id = @ComplementoPago_Id
      `);
    
    const facturas = facturasResult.recordset;
    const primerReceptor = facturas[0];
    
    // Preparar CFDI de Pago para Facturama
    const cfdiData = {
      CfdiType: 'P',
      NameId: '1',
      ExpeditionPlace: complemento.TaxZipCode || '64000',
      Issuer: {
        FiscalRegime: complemento.FiscalRegime || '601',
        Rfc: complemento.EmisorRFC,
        Name: complemento.EmisorNombre
      },
      Receiver: {
        Rfc: primerReceptor.ReceptorRFC,
        Name: primerReceptor.ReceptorNombre,
        CfdiUse: 'CP01',
        FiscalRegime: '616',
        TaxZipCode: '64000'
      },
      Complemento: {
        Payments: [{
          Date: new Date(complemento.FechaPago).toISOString(),
          PaymentForm: complemento.FormaPago,
          Currency: complemento.Moneda,
          Amount: complemento.Monto,
          RelatedDocuments: facturas.map(f => ({
            Uuid: f.UUID,
            Serie: f.Serie,
            Folio: f.Folio,
            Currency: f.MonedaDR,
            PaymentMethod: 'PPD',
            PartialityNumber: f.NumParcialidad,
            PreviousBalanceAmount: f.SaldoAnterior,
            AmountPaid: f.MontoPagado,
            ImpSaldoInsoluto: f.SaldoInsoluto
          }))
        }]
      }
    };
    
    // Timbrar en Facturama (API Multiemisor)
    const cfdiResult = await facturamaService.crearComplementoPago(cfdiData);
    
    // Actualizar complemento con datos del timbrado
    await pool.request()
      .input('ComplementoPago_Id', sql.Int, id)
      .input('UUID', sql.VarChar, cfdiResult.Complement?.TaxStamp?.Uuid || cfdiResult.Id)
      .input('FacturamaId', sql.VarChar, cfdiResult.Id)
      .input('Serie', sql.VarChar, cfdiResult.Serie || null)
      .input('Folio', sql.VarChar, cfdiResult.Folio || null)
      .query(`
        UPDATE ERP_COMPLEMENTOS_PAGO 
        SET UUID = @UUID, FacturamaId = @FacturamaId, Serie = @Serie, Folio = @Folio,
            FechaTimbrado = GETDATE(), Status = 'Vigente'
        WHERE ComplementoPago_Id = @ComplementoPago_Id
      `);
    
    res.json({
      success: true,
      message: 'Complemento de pago timbrado exitosamente',
      data: cfdiResult
    });
  } catch (error) {
    console.error('Error al timbrar complemento de pago:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.Message || 'Error al timbrar complemento de pago',
      error: error.response?.data || error.message 
    });
  }
};

// Listar complementos de pago
exports.getComplementosPago = async (req, res) => {
  try {
    const { Factura_Id } = req.query;
    const pool = await poolPromise;
    
    let query = `
      SELECT DISTINCT cp.*
      FROM ERP_COMPLEMENTOS_PAGO cp
    `;
    
    const request = pool.request();
    
    if (Factura_Id) {
      query += `
        INNER JOIN ERP_COMPLEMENTO_FACTURA cf ON cp.ComplementoPago_Id = cf.ComplementoPago_Id
        WHERE cf.Factura_Id = @Factura_Id
      `;
      request.input('Factura_Id', sql.Int, Factura_Id);
    } else {
      query += ' WHERE 1=1';
    }
    
    query += ' ORDER BY cp.FechaCreacion DESC';
    
    const result = await request.query(query);
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar complementos de pago:', error);
    res.status(500).json({ success: false, message: 'Error al listar complementos de pago', error: error.message });
  }
};

// Obtener detalle de complemento de pago
exports.getComplementoPagoDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const complementoResult = await pool.request()
      .input('ComplementoPago_Id', sql.Int, id)
      .query('SELECT * FROM ERP_COMPLEMENTOS_PAGO WHERE ComplementoPago_Id = @ComplementoPago_Id');
    
    if (complementoResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Complemento de pago no encontrado' });
    }
    
    const facturasResult = await pool.request()
      .input('ComplementoPago_Id', sql.Int, id)
      .query(`
        SELECT cf.*, f.Serie, f.Folio, f.UUID, f.Total as TotalFactura, f.ReceptorNombre
        FROM ERP_COMPLEMENTO_FACTURA cf
        INNER JOIN ERP_FACTURAS f ON cf.Factura_Id = f.Factura_Id
        WHERE cf.ComplementoPago_Id = @ComplementoPago_Id
      `);
    
    res.json({
      success: true,
      data: {
        complemento: complementoResult.recordset[0],
        facturas: facturasResult.recordset
      }
    });
  } catch (error) {
    console.error('Error al obtener complemento de pago:', error);
    res.status(500).json({ success: false, message: 'Error al obtener complemento de pago', error: error.message });
  }
};
