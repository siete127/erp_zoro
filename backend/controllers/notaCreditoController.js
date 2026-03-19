const sql = require('mssql');
const { poolPromise } = require('../config/db');
const facturamaService = require('../services/facturamaService');

// Crear nota de crédito
exports.crearNotaCredito = async (req, res) => {
  try {
    const { Factura_Id, Motivo, productos } = req.body;
    const userId = req.user?.Username || 'sistema';
    
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Obtener datos de la factura original
      const facturaResult = await transaction.request()
        .input('Factura_Id', sql.Int, Factura_Id)
        .query(`
          SELECT f.*, c.RFC as EmisorRFC, c.LegalName as EmisorNombre,
                 cl.RFC as ReceptorRFC, cl.LegalName as ReceptorNombre
          FROM ERP_FACTURAS f
          INNER JOIN ERP_COMPANY c ON f.Company_Id = c.Company_Id
          INNER JOIN ERP_CLIENT cl ON f.ReceptorRFC = cl.RFC
          WHERE f.Factura_Id = @Factura_Id
        `);
      
      if (facturaResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Factura no encontrada' });
      }
      
      const factura = facturaResult.recordset[0];
      
      // Calcular totales
      let subtotal = 0, iva = 0, total = 0;
      productos.forEach(p => {
        subtotal += p.Subtotal;
        iva += p.IVA;
        total += p.Total;
      });
      
      // Crear nota de crédito
      const notaResult = await transaction.request()
        .input('Factura_Id', sql.Int, Factura_Id)
        .input('Company_Id', sql.Int, factura.Company_Id)
        .input('Motivo', sql.VarChar, Motivo)
        .input('Subtotal', sql.Decimal(18, 2), subtotal)
        .input('IVA', sql.Decimal(18, 2), iva)
        .input('Total', sql.Decimal(18, 2), total)
        .input('Moneda', sql.VarChar(3), factura.Moneda)
        .input('CreadoPor', sql.VarChar, userId)
        .query(`
          INSERT INTO ERP_NOTAS_CREDITO 
          (Factura_Id, Company_Id, Motivo, Subtotal, IVA, Total, Moneda, CreadoPor)
          OUTPUT INSERTED.*
          VALUES (@Factura_Id, @Company_Id, @Motivo, @Subtotal, @IVA, @Total, @Moneda, @CreadoPor)
        `);
      
      const notaCredito = notaResult.recordset[0];
      
      // Insertar detalle
      for (const prod of productos) {
        await transaction.request()
          .input('NotaCredito_Id', sql.Int, notaCredito.NotaCredito_Id)
          .input('Producto_Id', sql.Int, prod.Producto_Id || null)
          .input('Descripcion', sql.VarChar, prod.Descripcion)
          .input('Cantidad', sql.Decimal(18, 2), prod.Cantidad)
          .input('PrecioUnitario', sql.Decimal(18, 2), prod.PrecioUnitario)
          .input('Subtotal', sql.Decimal(18, 2), prod.Subtotal)
          .input('IVA', sql.Decimal(18, 2), prod.IVA)
          .input('Total', sql.Decimal(18, 2), prod.Total)
          .query(`
            INSERT INTO ERP_NOTA_CREDITO_DETALLE 
            (NotaCredito_Id, Producto_Id, Descripcion, Cantidad, PrecioUnitario, Subtotal, IVA, Total)
            VALUES (@NotaCredito_Id, @Producto_Id, @Descripcion, @Cantidad, @PrecioUnitario, @Subtotal, @IVA, @Total)
          `);
      }
      
      await transaction.commit();
      
      res.status(201).json({
        success: true,
        message: 'Nota de crédito creada. Procede a timbrar.',
        data: notaCredito
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al crear nota de crédito:', error);
    res.status(500).json({ success: false, message: 'Error al crear nota de crédito', error: error.message });
  }
};

// Timbrar nota de crédito en Facturama
exports.timbrarNotaCredito = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = await poolPromise;
    
    // Obtener nota de crédito con factura relacionada
    const notaResult = await pool.request()
      .input('NotaCredito_Id', sql.Int, id)
      .query(`
        SELECT nc.*, f.UUID as FacturaUUID, f.ReceptorRFC, f.ReceptorNombre,
               c.RFC as EmisorRFC, c.LegalName as EmisorNombre, c.FiscalRegime, c.TaxZipCode
        FROM ERP_NOTAS_CREDITO nc
        INNER JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
        INNER JOIN ERP_COMPANY c ON nc.Company_Id = c.Company_Id
        WHERE nc.NotaCredito_Id = @NotaCredito_Id
      `);
    
    if (notaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota de crédito no encontrada' });
    }
    
    const nota = notaResult.recordset[0];
    
    // Obtener detalle
    const detalleResult = await pool.request()
      .input('NotaCredito_Id', sql.Int, id)
      .query('SELECT * FROM ERP_NOTA_CREDITO_DETALLE WHERE NotaCredito_Id = @NotaCredito_Id');
    
    // Preparar CFDI de Egreso para Facturama
    const cfdiData = {
      CfdiType: 'E',
      NameId: '1',
      ExpeditionPlace: nota.TaxZipCode || '64000',
      Issuer: {
        FiscalRegime: nota.FiscalRegime || '601',
        Rfc: nota.EmisorRFC,
        Name: nota.EmisorNombre
      },
      Receiver: {
        Rfc: nota.ReceptorRFC,
        Name: nota.ReceptorNombre,
        CfdiUse: 'G02',
        FiscalRegime: '616',
        TaxZipCode: '64000'
      },
      Items: detalleResult.recordset.map(item => ({
        ProductCode: '01010101',
        UnitCode: 'E48',
        Unit: 'Pieza',
        Description: item.Descripcion,
        Quantity: item.Cantidad,
        UnitPrice: item.PrecioUnitario,
        Subtotal: item.Subtotal,
        Taxes: [{
          Name: 'IVA',
          Rate: 0.16,
          Base: item.Subtotal,
          Total: item.IVA,
          IsRetention: false,
          Type: 'Federal'
        }]
      })),
      Relations: [{
        Type: '01',
        Cfdis: [nota.FacturaUUID]
      }]
    };
    
    // Timbrar en Facturama (API Multiemisor)
    const cfdiResult = await facturamaService.crearNotaCredito(cfdiData);
    
    // Actualizar nota de crédito con datos del timbrado
    await pool.request()
      .input('NotaCredito_Id', sql.Int, id)
      .input('UUID', sql.VarChar, cfdiResult.Complement?.TaxStamp?.Uuid || cfdiResult.Id)
      .input('FacturamaId', sql.VarChar, cfdiResult.Id)
      .input('Serie', sql.VarChar, cfdiResult.Serie || null)
      .input('Folio', sql.VarChar, cfdiResult.Folio || null)
      .query(`
        UPDATE ERP_NOTAS_CREDITO 
        SET UUID = @UUID, FacturamaId = @FacturamaId, Serie = @Serie, Folio = @Folio, 
            FechaTimbrado = GETDATE(), Status = 'Vigente'
        WHERE NotaCredito_Id = @NotaCredito_Id
      `);
    
    res.json({
      success: true,
      message: 'Nota de crédito timbrada exitosamente',
      data: cfdiResult
    });
  } catch (error) {
    console.error('Error al timbrar nota de crédito:', error);
    res.status(500).json({ 
      success: false, 
      message: error.response?.data?.Message || 'Error al timbrar nota de crédito',
      error: error.response?.data || error.message 
    });
  }
};

// Listar notas de crédito
exports.getNotasCredito = async (req, res) => {
  try {
    const { Factura_Id } = req.query;
    const pool = await poolPromise;
    
    let query = `
      SELECT nc.*, 
             f.Serie as FacturaSerie, 
             f.Folio as FacturaFolio, 
             f.ReceptorNombre,
             f.Total as FacturaTotal
      FROM ERP_NOTAS_CREDITO nc
      LEFT JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    if (Factura_Id) {
      query += ' AND nc.Factura_Id = @Factura_Id';
      request.input('Factura_Id', sql.Int, Factura_Id);
    }
    
    query += ' ORDER BY nc.FechaCreacion DESC';
    
    const result = await request.query(query);
    
    console.log('Notas de crédito:', result.recordset); // Debug
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar notas de crédito:', error);
    res.status(500).json({ success: false, message: 'Error al listar notas de crédito', error: error.message });
  }
};

// Obtener detalle de nota de crédito
exports.getNotaCreditoDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const notaResult = await pool.request()
      .input('NotaCredito_Id', sql.Int, id)
      .query(`
        SELECT nc.*, f.Serie as FacturaSerie, f.Folio as FacturaFolio, 
               f.UUID as FacturaUUID, f.ReceptorNombre, f.ReceptorRFC
        FROM ERP_NOTAS_CREDITO nc
        INNER JOIN ERP_FACTURAS f ON nc.Factura_Id = f.Factura_Id
        WHERE nc.NotaCredito_Id = @NotaCredito_Id
      `);
    
    if (notaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota de crédito no encontrada' });
    }
    
    const detalleResult = await pool.request()
      .input('NotaCredito_Id', sql.Int, id)
      .query('SELECT * FROM ERP_NOTA_CREDITO_DETALLE WHERE NotaCredito_Id = @NotaCredito_Id');
    
    res.json({
      success: true,
      data: {
        nota: notaResult.recordset[0],
        detalle: detalleResult.recordset
      }
    });
  } catch (error) {
    console.error('Error al obtener nota de crédito:', error);
    res.status(500).json({ success: false, message: 'Error al obtener nota de crédito', error: error.message });
  }
};

// Obtener productos de una factura
exports.getProductosFactura = async (req, res) => {
  try {
    const { facturaId } = req.params;
    const pool = await poolPromise;
    
    // Obtener detalle de la venta asociada a la factura
    const result = await pool.request()
      .input('Factura_Id', sql.Int, facturaId)
      .query(`
        SELECT vd.*, p.Nombre as ProductoNombre, p.SKU
        FROM ERP_FACTURAS f
        INNER JOIN ERP_VENTA_DETALLE vd ON f.Venta_Id = vd.Venta_Id
        LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
        WHERE f.Factura_Id = @Factura_Id
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener productos de factura:', error);
    res.status(500).json({ success: false, message: 'Error al obtener productos', error: error.message });
  }
};
