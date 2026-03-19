const sql = require('mssql');
const { poolPromise } = require('../config/db');
const facturamaService = require('../services/facturamaService');

// Listar facturas con filtros
exports.getFacturas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, cliente, status } = req.query;
    
    const pool = await poolPromise;
    let query = `
      SELECT 
        f.Factura_Id,
        f.UUID,
        f.FacturamaId,
        f.Serie,
        f.Folio,
        f.ReceptorRFC,
        f.ReceptorNombre,
        f.Subtotal,
        f.IVA,
        f.Total,
        f.Moneda,
        f.Status,
        f.FechaTimbrado,
        f.Venta_Id,
        v.FechaVenta
      FROM ERP_FACTURAS f
      LEFT JOIN ERP_VENTAS v ON f.Venta_Id = v.Venta_Id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    if (fechaInicio) {
      query += ' AND f.FechaTimbrado >= @FechaInicio';
      request.input('FechaInicio', sql.DateTime, new Date(fechaInicio));
    }
    
    if (fechaFin) {
      query += ' AND f.FechaTimbrado <= @FechaFin';
      request.input('FechaFin', sql.DateTime, new Date(fechaFin));
    }
    
    if (cliente) {
      query += ' AND (f.ReceptorNombre LIKE @Cliente OR f.ReceptorRFC LIKE @Cliente)';
      request.input('Cliente', sql.VarChar, `%${cliente}%`);
    }
    
    if (status) {
      query += ' AND f.Status = @Status';
      request.input('Status', sql.VarChar, status);
    }
    
    query += ' ORDER BY f.FechaTimbrado DESC';
    
    const result = await request.query(query);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener facturas', error: error.message });
  }
};

// Descargar PDF de factura
exports.descargarPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('Factura_Id', sql.Int, id)
      .query('SELECT FacturamaId, UUID FROM ERP_FACTURAS WHERE Factura_Id = @Factura_Id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }
    
    const facturamaId = result.recordset[0].FacturamaId || result.recordset[0].UUID;
    
    // Verificar si es un ID temporal
    if (!facturamaId || facturamaId.startsWith('TEMP-')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Esta factura no tiene un ID válido de Facturama. Puede ser una factura de prueba.' 
      });
    }
    
    const pdfData = await facturamaService.descargarPDF(facturamaId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${facturamaId}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    res.status(500).json({ success: false, message: 'Error al descargar PDF', error: error.message });
  }
};

// Descargar XML de factura
exports.descargarXML = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('Factura_Id', sql.Int, id)
      .query('SELECT FacturamaId, UUID FROM ERP_FACTURAS WHERE Factura_Id = @Factura_Id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }
    
    const facturamaId = result.recordset[0].FacturamaId || result.recordset[0].UUID;
    
    // Verificar si es un ID temporal
    if (!facturamaId || facturamaId.startsWith('TEMP-')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Esta factura no tiene un ID válido de Facturama. Puede ser una factura de prueba.' 
      });
    }
    
    const xmlData = await facturamaService.descargarXML(facturamaId);
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${facturamaId}.xml"`);
    res.send(xmlData);
  } catch (error) {
    console.error('Error al descargar XML:', error);
    res.status(500).json({ success: false, message: 'Error al descargar XML', error: error.message });
  }
};

// Obtener estadísticas de facturación
exports.getEstadisticas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const pool = await poolPromise;
    const request = pool.request();
    
    let whereClause = 'WHERE 1=1';
    
    if (fechaInicio) {
      whereClause += ' AND FechaTimbrado >= @FechaInicio';
      request.input('FechaInicio', sql.DateTime, new Date(fechaInicio));
    }
    
    if (fechaFin) {
      whereClause += ' AND FechaTimbrado <= @FechaFin';
      request.input('FechaFin', sql.DateTime, new Date(fechaFin));
    }
    
    const result = await request.query(`
      SELECT 
        COUNT(*) as TotalFacturas,
        SUM(CASE WHEN Status = 'Vigente' THEN 1 ELSE 0 END) as FacturasVigentes,
        SUM(CASE WHEN Status = 'Cancelada' THEN 1 ELSE 0 END) as FacturasCanceladas,
        SUM(CASE WHEN Status = 'Vigente' THEN Total ELSE 0 END) as TotalFacturado,
        AVG(CASE WHEN Status = 'Vigente' THEN Total ELSE NULL END) as PromedioFactura
      FROM ERP_FACTURAS
      ${whereClause}
    `);
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas', error: error.message });
  }
};
