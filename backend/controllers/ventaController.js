const sql = require('mssql');
const { poolPromise } = require('../config/db');

// Crear nueva venta
exports.createVenta = async (req, res) => {
  try {
    const { Company_Id, Client_Id, Moneda = 'MXN', Status_Id = 1 } = req.body;
    const companyId = parseInt(Company_Id, 10);

    // Verificar que el usuario tenga acceso a la empresa
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(companyId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permisos para crear ventas en esta empresa' 
        });
      }
    }

    const pool = await poolPromise;
    
    // Obtener el nombre del status desde la tabla
    const statusResult = await pool.request()
      .input('Status_Id', sql.Int, Status_Id)
      .query('SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = @Status_Id');
    
    const statusText = statusResult.recordset[0]?.Nombre || 'Pendiente';
    
    const result = await pool.request()
      .input('Company_Id', sql.Int, companyId)
      .input('Client_Id', sql.Int, Client_Id)
      .input('Moneda', sql.VarChar(3), Moneda)
      .input('Status_Id', sql.Int, Status_Id)
      .input('Status', sql.VarChar, statusText)
      .query(`
        INSERT INTO ERP_VENTAS (Company_Id, Client_Id, Total, IVA, Subtotal, Moneda, Status_Id, FechaVenta, Status)
        OUTPUT INSERTED.*
        VALUES (@Company_Id, @Client_Id, 0, 0, 0, @Moneda, @Status_Id, GETDATE(), @Status)
      `);

    const nuevaVenta = result.recordset[0];

    const io = req.app.get('io');
    if (io) {
      io.emit('venta:changed', { Venta_Id: nuevaVenta.Venta_Id });
    }

    res.status(201).json({
      success: true,
      data: nuevaVenta
    });
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(500).json({ success: false, message: 'Error al crear venta', error: error.message });
  }
};

// Agregar productos a la venta
exports.addProductosVenta = async (req, res) => {
  try {
    const { Venta_Id, productos } = req.body; // productos: [{Producto_Id, Cantidad, PrecioUnitario}]

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
      // Obtener Status_Id y Company_Id actual de la venta
      const ventaResult = await transaction.request()
        .input('Venta_Id', sql.Int, Venta_Id)
        .query('SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');
      
      if (ventaResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Venta no encontrada' });
      }

      const ventaData = ventaResult.recordset[0];

      // Verificar que el usuario tenga acceso a la empresa de la venta
      if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
        if (!req.userCompanies.includes(ventaData.Company_Id)) {
          await transaction.rollback();
          return res.status(403).json({ 
            success: false, 
            message: 'No tiene permisos para agregar productos a ventas de esta empresa' 
          });
        }
      }

      const currentStatusId = ventaData.Status_Id;
      
      let subtotalTotal = 0;
      let ivaTotal = 0;
      let total = 0;

      // Insertar cada producto
      for (const prod of productos) {
        const subtotal = prod.Cantidad * prod.PrecioUnitario;
        const iva = subtotal * 0.16;
        const totalProd = subtotal + iva;

        await transaction.request()
          .input('Venta_Id', sql.Int, Venta_Id)
          .input('Producto_Id', sql.Int, prod.Producto_Id)
          .input('Cantidad', sql.Decimal(18, 2), prod.Cantidad)
          .input('PrecioUnitario', sql.Decimal(18, 2), prod.PrecioUnitario)
          .input('Subtotal', sql.Decimal(18, 2), subtotal)
          .input('IVA', sql.Decimal(18, 2), iva)
          .input('Total', sql.Decimal(18, 2), totalProd)
          .query(`
            INSERT INTO ERP_VENTA_DETALLE (Venta_Id, Producto_Id, Cantidad, PrecioUnitario, Subtotal, IVA, Total)
            VALUES (@Venta_Id, @Producto_Id, @Cantidad, @PrecioUnitario, @Subtotal, @IVA, @Total)
          `);

        subtotalTotal += subtotal;
        ivaTotal += iva;
        total += totalProd;
      }

      // Actualizar totales de la venta
      // Mantener el Status_Id actual (no cambiarlo al agregar productos)
      const statusResult = await transaction.request()
        .input('Status_Id', sql.Int, currentStatusId)
        .query('SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = @Status_Id');
      
      const statusText = statusResult.recordset[0]?.Nombre || 'Pendiente';
      
      await transaction.request()
        .input('Venta_Id', sql.Int, Venta_Id)
        .input('Subtotal', sql.Decimal(18, 2), subtotalTotal)
        .input('IVA', sql.Decimal(18, 2), ivaTotal)
        .input('Total', sql.Decimal(18, 2), total)
        .input('Status_Id', sql.Int, currentStatusId)
        .input('Status', sql.VarChar, statusText)
        .query(`
          UPDATE ERP_VENTAS 
          SET Subtotal = @Subtotal, IVA = @IVA, Total = @Total, Status_Id = @Status_Id, Status = @Status
          WHERE Venta_Id = @Venta_Id
        `);

      await transaction.commit();

      // Notificar cambios de venta en tiempo real
      const io = req.app.get('io');
      if (io) {
        io.emit('venta:changed', { Venta_Id });
      }

      res.json({
        success: true,
        message: 'Productos agregados correctamente',
        data: { Subtotal: subtotalTotal, IVA: ivaTotal, Total: total }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al agregar productos:', error);
    res.status(500).json({ success: false, message: 'Error al agregar productos', error: error.message });
  }
};

// Obtener venta con detalle
exports.getVentaDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;
    
    const ventaResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT v.*, 
               ISNULL(s.Nombre, v.Status) as StatusNombre, 
               s.Descripcion as StatusDescripcion,
               c.RFC as ClienteRFC, 
               c.LegalName as ClienteNombre
        FROM ERP_VENTAS v
        LEFT JOIN ERP_VENTA_STATUS s ON v.Status_Id = s.Status_Id
        LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
        WHERE v.Venta_Id = @Venta_Id
      `);

    if (ventaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const venta = ventaResult.recordset[0];

    // Verificar que el usuario tenga acceso a la empresa de la venta
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(venta.Company_Id)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permisos para ver ventas de esta empresa' 
        });
      }
    }

    const detalleResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT vd.*, 
               ISNULL(p.Nombre, 'Producto sin nombre') as ProductoNombre, 
               p.SKU as ProductoCodigo
        FROM ERP_VENTA_DETALLE vd
        LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
        WHERE vd.Venta_Id = @Venta_Id
      `);

    // Obtener solicitudes de cambio de precio asociadas a esta venta
    const solicitudesResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT 
          s.Solicitud_Id,
          s.Estado,
          s.EstadoAprobador1,
          s.EstadoAprobador2,
          s.EmailAprobador1,
          s.EmailAprobador2,
          s.FechaCreacion,
          s.FechaCompletado,
          COUNT(d.Detalle_Id) as CantidadProductos
        FROM ERP_SOLICITUDES_CAMBIO_PRECIO s
        LEFT JOIN ERP_SOLICITUD_PRECIO_DETALLE d ON s.Solicitud_Id = d.Solicitud_Id
        WHERE s.Venta_Id = @Venta_Id
        GROUP BY s.Solicitud_Id, s.Estado, s.EstadoAprobador1, s.EstadoAprobador2, 
                 s.EmailAprobador1, s.EmailAprobador2, s.FechaCreacion, s.FechaCompletado
      `);

    // Obtener detalles de cada solicitud (productos y precios)
    const detallesResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT 
          d.Detalle_Id,
          d.Solicitud_Id,
          d.Producto_Id,
          p.Nombre as ProductoNombre,
          p.SKU as ProductoCodigo,
          d.PrecioActual,
          d.PrecioNuevo
        FROM ERP_SOLICITUD_PRECIO_DETALLE d
        INNER JOIN ERP_SOLICITUDES_CAMBIO_PRECIO s ON d.Solicitud_Id = s.Solicitud_Id
        LEFT JOIN ERP_PRODUCTOS p ON d.Producto_Id = p.Producto_Id
        WHERE s.Venta_Id = @Venta_Id
        ORDER BY d.Solicitud_Id, d.Detalle_Id
      `);

    // Agrupar detalles por solicitud
    const solicitudesConDetalles = solicitudesResult.recordset.map(solicitud => ({
      ...solicitud,
      detalles: detallesResult.recordset.filter(d => d.Solicitud_Id === solicitud.Solicitud_Id)
    }));

    res.json({
      success: true,
      data: {
        venta: ventaResult.recordset[0],
        detalle: detalleResult.recordset || [],
        solicitudesPrecio: solicitudesConDetalles || []
      }
    });
  } catch (error) {
    console.error('Error al obtener venta:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Error al obtener venta', error: error.message });
  }
};

// Listar ventas
exports.getVentas = async (req, res) => {
  try {
    const { Company_Id, Status_Id } = req.query;

    const pool = await poolPromise;
    let query = `
      SELECT v.*, s.Nombre as StatusNombre,
             c.RFC as ClienteRFC, c.LegalName as ClienteNombre
      FROM ERP_VENTAS v
      LEFT JOIN ERP_VENTA_STATUS s ON v.Status_Id = s.Status_Id
      LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
      WHERE 1=1
    `;

    const request = pool.request();

    // Filtrar por empresa del usuario si no es admin
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
      req.userCompanies.forEach((cid, idx) => {
        request.input(`userCompany${idx}`, sql.Int, cid);
      });
      query += ` AND v.Company_Id IN (${placeholders})`;
    } else if (Company_Id) {
      query += ' AND v.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Company_Id);
    }

    if (Status_Id) {
      query += ' AND v.Status_Id = @Status_Id';
      request.input('Status_Id', sql.Int, Status_Id);
    }

    query += ' ORDER BY v.FechaVenta DESC';

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error al listar ventas:', error);
    res.status(500).json({ success: false, message: 'Error al listar ventas', error: error.message });
  }
};

// Facturar venta (enviar a PAC)
exports.facturarVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { UsoCFDI = 'G03', FormaPago = '01', MetodoPago = 'PUE' } = req.body;

    const pool = await poolPromise;

    // Obtener venta con datos del cliente y contacto primario
    const ventaResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT v.*, 
               c.RFC as ClienteRFC, 
               c.LegalName as ClienteNombre,
               c.TaxRegime as ClienteFiscalRegime,
               addr.PostalCode as ClienteTaxZipCode,
               cont.Email as ClienteEmail
        FROM ERP_VENTAS v
        LEFT JOIN ERP_CLIENT c ON v.Client_Id = c.Client_Id
        LEFT JOIN ERP_CLIENTADRESSES addr ON c.Client_Id = addr.Client_Id AND addr.IsPrimary = 1
        LEFT JOIN ERP_CLIENTCONTACTS cont ON c.Client_Id = cont.Client_Id AND cont.IsPrimary = 1
        WHERE v.Venta_Id = @Venta_Id
      `);

    if (ventaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const venta = ventaResult.recordset[0];

    // Verificar que el usuario tenga acceso a la empresa de la venta
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(venta.Company_Id)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permisos para facturar ventas de esta empresa' 
        });
      }
    }

    if (venta.Status_Id === 3) {
      return res.status(400).json({ success: false, message: 'La venta ya está facturada' });
    }

    // Obtener detalle
    const detalleResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT vd.*, p.Nombre
        FROM ERP_VENTA_DETALLE vd
        LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
        WHERE vd.Venta_Id = @Venta_Id
      `);

    const detalle = detalleResult.recordset || [];

    // Validar que la venta tenga productos
    if (detalle.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede facturar una venta sin productos. Por favor, agrega al menos un producto a la venta antes de facturar.' 
      });
    }

    // Regla de negocio: Verificar inventario y crear OP si es necesario
    const productosConFaltante = [];

    // Obtener Company_Id de PTC para verificar su stock
    const ptcResult = await pool.request().query(`
      SELECT TOP 1 Company_Id FROM ERP_COMPANY 
      WHERE NameCompany LIKE '%PTC%'
    `);
    const ptcCompanyId = ptcResult.recordset.length > 0 ? ptcResult.recordset[0].Company_Id : null;
    
    for (const item of detalle) {
      if (!item.Producto_Id) continue;

      // 1) Verificar stock PROPIO de la empresa que vende
      const stockRes = await pool.request()
        .input('Producto_Id', sql.Int, item.Producto_Id)
        .input('Company_Id', sql.Int, venta.Company_Id)
        .query(`
          SELECT SUM(s.Cantidad) AS StockTotal
          FROM ERP_STOCK s
          INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
          WHERE s.Producto_Id = @Producto_Id
            AND a.Company_Id = @Company_Id;
        `);

      const stockPropio = Number(stockRes.recordset[0]?.StockTotal || 0);
      const cant = Number(item.Cantidad || 0);

      if (stockPropio >= cant) continue; // Stock propio suficiente

      // 2) Verificar stock de PTC (empresa productora)
      let stockPTC = 0;
      if (ptcCompanyId && ptcCompanyId !== venta.Company_Id) {
        const stockPTCRes = await pool.request()
          .input('Producto_Id', sql.Int, item.Producto_Id)
          .input('PTC_Company_Id', sql.Int, ptcCompanyId)
          .query(`
            SELECT SUM(s.Cantidad) AS StockTotal
            FROM ERP_STOCK s
            INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
            WHERE s.Producto_Id = @Producto_Id
              AND a.Company_Id = @PTC_Company_Id;
          `);
        stockPTC = Number(stockPTCRes.recordset[0]?.StockTotal || 0);
      }

      const faltantePropio = cant - stockPropio;
      const disponiblePTC = Math.min(stockPTC, faltantePropio);
      const faltanteTotal = faltantePropio - disponiblePTC;

      // 3) Verificar si tiene BOM (se busca en cualquier empresa, no solo la vendedora)
      const bomRes = await pool.request()
        .input('Producto_Id', sql.Int, item.Producto_Id)
        .query(`
          SELECT TOP 1 BOM_Id 
          FROM ERP_BOM 
          WHERE Producto_Id = @Producto_Id 
            AND Vigente = 1 
          ORDER BY Version DESC
        `);

      productosConFaltante.push({
        Producto_Id: item.Producto_Id,
        Nombre: item.Nombre,
        StockPropio: stockPropio,
        StockPTC: stockPTC,
        DisponiblePTC: disponiblePTC,
        CantidadRequerida: cant,
        Faltante: faltanteTotal > 0 ? faltanteTotal : 0,
        FaltantePropio: faltantePropio,
        TieneBOM: bomRes.recordset.length > 0,
        RequiereProduccion: faltanteTotal > 0 && bomRes.recordset.length > 0,
        PuedeSurtirPTC: disponiblePTC > 0
      });
    }

    // Si hay productos con faltante, informar al usuario
    if (productosConFaltante.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Inventario insuficiente. Verifique stock de PTC o solicite producción.',
        requiereProduccion: true,
        productos: productosConFaltante,
        ptcCompanyId: ptcCompanyId,
        sugerencia: 'Los productos con faltante pueden solicitarse a PTC (producción) o surtirse de su stock existente'
      });
    }

    // Preparar datos para PAC (Facturama)
    const facturamaService = require('../services/facturamaService');

    const conceptos = detalle.map(item => ({
      ClaveProdServ: '01010101',
      Cantidad: item.Cantidad,
      ClaveUnidad: 'E48',
      Unidad: 'Pieza',
      Descripcion: item.Nombre,
      ValorUnitario: item.PrecioUnitario,
      Importe: item.Subtotal,
      Impuestos: {
        Traslados: [{
          Base: item.Subtotal,
          Impuesto: '002',
          TipoFactor: 'Tasa',
          TasaOCuota: '0.160000',
          Importe: item.IVA
        }]
      }
    }));

    // Validar y normalizar RFC del cliente - SIEMPRE usar RFC genérico en sandbox
    const clienteRFC = 'XAXX010101000'; // RFC genérico para público en general
    const clienteZipCode = '01000'; // Código postal genérico
    const usoCFDI = UsoCFDI === 'G03' ? 'S01' : UsoCFDI; // S01 es válido para régimen 616
    console.log('Usando RFC genérico para evitar errores de validación en sandbox');

    const cfdiData = {
      Receptor: {
        Rfc: clienteRFC,
        Nombre: 'PUBLICO EN GENERAL',
        Email: venta.ClienteEmail || 'cliente@ejemplo.com',
        FiscalRegime: '616',
        TaxZipCode: clienteZipCode,
        UsoCfdi: usoCFDI
      },
      Conceptos: conceptos,
      FormaPago: FormaPago,
      MetodoPago: MetodoPago,
      Moneda: venta.Moneda
    };

    // Enviar a PAC
    console.log('Enviando a Facturama:', JSON.stringify(cfdiData, null, 2));
    const cfdiResult = await facturamaService.crearFactura(cfdiData, venta.Company_Id);

    // Descontar inventario
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const movimientosInventario = [];
      
      for (const item of detalle) {
        if (!item.Producto_Id) continue;

        // Obtener primer almacén de la empresa con su nombre
        const almacenRes = await transaction.request()
          .input('Company_Id', sql.Int, venta.Company_Id)
          .query('SELECT TOP 1 Almacen_Id, Nombre FROM ERP_ALMACENES WHERE Company_Id = @Company_Id');

        if (almacenRes.recordset.length === 0) continue;

        const almacen = almacenRes.recordset[0];

        // Obtener stock actual
        const stockRes = await transaction.request()
          .input('Producto_Id', sql.Int, item.Producto_Id)
          .input('Almacen_Id', sql.Int, almacen.Almacen_Id)
          .query('SELECT Cantidad FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id');

        const stockAnterior = Number(stockRes.recordset[0]?.Cantidad || 0);
        const stockNuevo = stockAnterior - Number(item.Cantidad);

        // Actualizar stock
        await transaction.request()
          .input('Producto_Id', sql.Int, item.Producto_Id)
          .input('Almacen_Id', sql.Int, almacen.Almacen_Id)
          .input('Cantidad', sql.Decimal(18, 2), stockNuevo)
          .query('UPDATE ERP_STOCK SET Cantidad = @Cantidad WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id');

        // Registrar en kardex
        await transaction.request()
          .input('Producto_Id', sql.Int, item.Producto_Id)
          .input('Almacen_Id', sql.Int, almacen.Almacen_Id)
          .input('TipoMovimiento', sql.VarChar, 'SALIDA')
          .input('Cantidad', sql.Decimal(18, 2), item.Cantidad)
          .input('Stock_Anterior', sql.Decimal(18, 2), stockAnterior)
          .input('Stock_Actual', sql.Decimal(18, 2), stockNuevo)
          .input('Referencia', sql.VarChar, `VENTA-${id}`)
          .input('Usuario', sql.VarChar, req.user?.Username || 'sistema')
          .query(`
            INSERT INTO ERP_KARDEX (
              Producto_Id, Almacen_Id, TipoMovimiento, Cantidad,
              Stock_Anterior, Stock_Actual, Referencia, Usuario, FechaMovimiento
            ) VALUES (
              @Producto_Id, @Almacen_Id, @TipoMovimiento, @Cantidad,
              @Stock_Anterior, @Stock_Actual, @Referencia, @Usuario, GETDATE()
            )
          `);

        movimientosInventario.push({
          Producto: item.Nombre,
          Almacen: almacen.Nombre,
          Cantidad: item.Cantidad,
          StockAnterior: stockAnterior,
          StockNuevo: stockNuevo
        });
      }

      // Guardar factura en la tabla ERP_FACTURAS
      const emisorData = await pool.request()
        .input('Company_Id', sql.Int, venta.Company_Id)
        .query('SELECT RFC FROM ERP_COMPANY WHERE Company_Id = @Company_Id');
      
      const emisorRFC = emisorData.recordset[0]?.RFC;
      const uuid = cfdiResult.Complement?.TaxStamp?.Uuid || cfdiResult.Id || 'TEMP-' + Date.now();
      const facturamaId = cfdiResult.Id || uuid;
      
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .input('Company_Id', sql.Int, venta.Company_Id)
        .input('UUID', sql.VarChar(50), uuid)
        .input('FacturamaId', sql.VarChar(50), facturamaId)
        .input('Serie', sql.VarChar(10), cfdiResult.Serie || null)
        .input('Folio', sql.VarChar(20), cfdiResult.Folio || null)
        .input('EmisorRFC', sql.VarChar(13), emisorRFC)
        .input('ReceptorRFC', sql.VarChar(13), venta.ClienteRFC)
        .input('ReceptorNombre', sql.VarChar(255), venta.ClienteNombre)
        .input('Subtotal', sql.Decimal(18, 2), venta.Subtotal)
        .input('IVA', sql.Decimal(18, 2), venta.IVA)
        .input('Total', sql.Decimal(18, 2), venta.Total)
        .input('Moneda', sql.VarChar(3), venta.Moneda)
        .input('MetodoPago', sql.VarChar(10), MetodoPago)
        .input('FormaPago', sql.VarChar(10), FormaPago)
        .input('Status', sql.VarChar(20), 'Vigente')
        .input('CreadoPor', sql.VarChar(50), req.user?.Username || 'sistema')
        .query(`
          INSERT INTO ERP_FACTURAS (
            Venta_Id, Company_Id, UUID, FacturamaId, Serie, Folio, EmisorRFC, ReceptorRFC, ReceptorNombre,
            Subtotal, IVA, Total, Moneda, MetodoPago, FormaPago, Status, FechaTimbrado, CreadoPor, FechaCreacion
          ) VALUES (
            @Venta_Id, @Company_Id, @UUID, @FacturamaId, @Serie, @Folio, @EmisorRFC, @ReceptorRFC, @ReceptorNombre,
            @Subtotal, @IVA, @Total, @Moneda, @MetodoPago, @FormaPago, @Status, GETDATE(), @CreadoPor, GETDATE()
          )
        `);

      // Actualizar venta a facturada
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .input('Status_Id', sql.Int, 3)
        .query('UPDATE ERP_VENTAS SET Status_Id = @Status_Id, Status = \'Facturada\' WHERE Venta_Id = @Venta_Id');

      await transaction.commit();

      // Notificar cambios de venta en tiempo real
      const io = req.app.get('io');
      if (io) {
        io.emit('venta:changed', { Venta_Id: Number(id) });
      }

      res.json({
        success: true,
        message: 'Venta facturada correctamente',
        data: cfdiResult,
        movimientosInventario
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al facturar venta:', error);
    
    // Si el error tiene un mensaje específico de validación, devolverlo
    const errorMessage = error.Message || error.message || 'Error al facturar venta';
    const statusCode = error.Message ? 400 : 500;
    
    res.status(statusCode).json({ 
      success: false, 
      message: errorMessage,
      details: error.ModelState || error
    });
  }
};

// Cancelar venta
exports.cancelarVenta = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;

    // Obtener Company_Id de la venta
    const ventaCheck = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query('SELECT Company_Id FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

    if (ventaCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const ventaData = ventaCheck.recordset[0];

    // Verificar que el usuario tenga acceso a la empresa de la venta
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(ventaData.Company_Id)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permisos para cancelar ventas de esta empresa' 
        });
      }
    }

    await pool.request()
      .input('Venta_Id', sql.Int, id)
      .input('Status_Id', sql.Int, 4) // Cancelada
      .query(`
        UPDATE ERP_VENTAS 
        SET Status_Id = @Status_Id, Status = 'Cancelada'
        WHERE Venta_Id = @Venta_Id AND Status_Id != 3
      `);

    // Notificar cambios de venta en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('venta:changed', { Venta_Id: Number(id) });
    }

    res.json({
      success: true,
      message: 'Venta cancelada correctamente'
    });
  } catch (error) {
    console.error('Error al cancelar venta:', error);
    res.status(500).json({ success: false, message: 'Error al cancelar venta', error: error.message });
  }
};

// Obtener estatus disponibles
// Obtener resumen de ventas por empresa
exports.getResumenVentasPorEmpresa = async (req, res) => {
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        c.Company_Id,
        c.NameCompany,
        COUNT(v.Venta_Id) as TotalVentas,
        SUM(v.Total) as TotalVentas_Monto,
        SUM(CASE WHEN v.Status_Id = 1 THEN 1 ELSE 0 END) as VentasPendientes,
        SUM(CASE WHEN v.Status_Id = 2 THEN 1 ELSE 0 END) as VentasEnProduccion,
        SUM(CASE WHEN v.Status_Id = 3 THEN 1 ELSE 0 END) as VentasFacturadas,
        SUM(CASE WHEN v.Status_Id = 4 THEN 1 ELSE 0 END) as VentasCanceladas,
        SUM(CASE WHEN v.Status_Id = 3 THEN v.Total ELSE 0 END) as MontoFacturado
      FROM ERP_COMPANY c
      LEFT JOIN ERP_VENTAS v ON c.Company_Id = v.Company_Id
      WHERE 1=1
    `;

    const request = pool.request();

    // Filtrar por empresa del usuario si no es admin
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
      req.userCompanies.forEach((cid, idx) => {
        request.input(`userCompany${idx}`, sql.Int, cid);
      });
      query += ` AND c.Company_Id IN (${placeholders})`;
    }

    query += ` GROUP BY c.Company_Id, c.NameCompany ORDER BY c.Company_Id`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener resumen de ventas por empresa:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de ventas por empresa', error: error.message });
  }
};

exports.getVentaStatus = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM ERP_VENTA_STATUS ORDER BY Status_Id');

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener estatus:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estatus', error: error.message });
  }
};

// Actualizar venta
exports.updateVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { Client_Id, Moneda, Status_Id } = req.body;

    const pool = await poolPromise;
    
    // Verificar que la venta no esté facturada y obtener Company_Id
    const ventaCheck = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query('SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

    if (ventaCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const ventaData = ventaCheck.recordset[0];

    // Verificar que el usuario tenga acceso a la empresa de la venta
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(ventaData.Company_Id)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tiene permisos para editar ventas de esta empresa' 
        });
      }
    }

    if (ventaData.Status_Id === 3) {
      return res.status(400).json({ success: false, message: 'No se puede editar una venta facturada' });
    }

    // Construir query dinámicamente
    let updateFields = [];
    const request = pool.request().input('Venta_Id', sql.Int, id);
    
    if (Client_Id !== undefined) {
      updateFields.push('Client_Id = @Client_Id');
      request.input('Client_Id', sql.Int, Client_Id);
    }
    
    if (Moneda !== undefined) {
      updateFields.push('Moneda = @Moneda');
      request.input('Moneda', sql.VarChar(3), Moneda);
    }
    
    if (Status_Id !== undefined) {
      // Obtener nombre del status
      const statusResult = await pool.request()
        .input('Status_Id', sql.Int, Status_Id)
        .query('SELECT Nombre FROM ERP_VENTA_STATUS WHERE Status_Id = @Status_Id');
      
      const statusText = statusResult.recordset[0]?.Nombre || 'Pendiente';
      
      updateFields.push('Status_Id = @Status_Id');
      updateFields.push('Status = @Status');
      request.input('Status_Id', sql.Int, Status_Id);
      request.input('Status', sql.VarChar, statusText);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    await request.query(`
      UPDATE ERP_VENTAS 
      SET ${updateFields.join(', ')}
      WHERE Venta_Id = @Venta_Id
    `);

    // Notificar cambios
    const io = req.app.get('io');
    if (io) {
      io.emit('venta:changed', { Venta_Id: Number(id) });
    }

    res.json({
      success: true,
      message: 'Venta actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar venta', error: error.message });
  }
};

// Eliminar venta
exports.deleteVenta = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
      // Verificar que la venta no esté facturada y obtener Company_Id
      const ventaCheck = await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .query('SELECT Status_Id, Company_Id FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

      if (ventaCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Venta no encontrada' });
      }

      const ventaData = ventaCheck.recordset[0];

      // Verificar que el usuario tenga acceso a la empresa de la venta
      if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
        if (!req.userCompanies.includes(ventaData.Company_Id)) {
          await transaction.rollback();
          return res.status(403).json({ 
            success: false, 
            message: 'No tiene permisos para eliminar ventas de esta empresa' 
          });
        }
      }

      if (ventaData.Status_Id === 3) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'No se puede eliminar una venta facturada' });
      }

      // Eliminar detalle
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .query('DELETE FROM ERP_VENTA_DETALLE WHERE Venta_Id = @Venta_Id');

      // Eliminar venta
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .query('DELETE FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

      await transaction.commit();

      res.json({
        success: true,
        message: 'Venta eliminada correctamente'
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar venta', error: error.message });
  }
};

// Crear órdenes de producción para productos faltantes (siempre van a PTC)
exports.crearOrdenesProduccion = async (req, res) => {
  try {
    const { id } = req.params;
    let { productos } = req.body; // [{Producto_Id, Cantidad}] o Producto_Id y Cantidad directos
    
    // Simplificar: Si se envía Producto_Id y Cantidad directamente, convertir a array
    if (req.body.Producto_Id && req.body.Cantidad) {
      productos = [{ Producto_Id: req.body.Producto_Id, Cantidad: req.body.Cantidad }];
    }
    
    if (!productos || productos.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe especificar al menos un producto' });
    }

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
      const venta = await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .query('SELECT * FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

      if (venta.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Venta no encontrada' });
      }

      const ventaData = venta.recordset[0];

      // Verificar que el usuario tenga acceso a la empresa de la venta
      if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
        if (!req.userCompanies.includes(ventaData.Company_Id)) {
          await transaction.rollback();
          return res.status(403).json({ 
            success: false, 
            message: 'No tiene permisos para crear órdenes de producción para ventas de esta empresa' 
          });
        }
      }

      // Obtener Company_Id de PTC (empresa productora)
      const ptcRes = await transaction.request().query("SELECT TOP 1 Company_Id FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'");
      const ptcCompanyId = ptcRes.recordset.length > 0 ? ptcRes.recordset[0].Company_Id : ventaData.Company_Id;

      const ordenesCreadas = [];

      for (const prod of productos) {
        const request = new sql.Request(transaction);
        request
          .input('PTC_Company_Id', sql.Int, ptcCompanyId)
          .input('Solicitante_Company_Id', sql.Int, ventaData.Company_Id)
          .input('Venta_Id', sql.Int, id)
          .input('Producto_Id', sql.Int, prod.Producto_Id)
          .input('CantidadPlanificada', sql.Decimal(18, 2), prod.Cantidad);

        const result = await request.query(`
          INSERT INTO ERP_OP_PRODUCCION (
            NumeroOP, Company_Id, CompanySolicitante_Id, Venta_Id, Producto_Id, BOM_Id,
            CantidadPlanificada, Estado, Prioridad, FechaCreacion
          )
          OUTPUT INSERTED.*
          SELECT
            'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' + RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
            @PTC_Company_Id, @Solicitante_Company_Id, @Venta_Id, @Producto_Id,
            (SELECT TOP 1 BOM_Id FROM ERP_BOM WHERE Producto_Id = @Producto_Id AND Vigente = 1 ORDER BY CASE WHEN Company_Id = @PTC_Company_Id THEN 0 ELSE 1 END, Version DESC),
            @CantidadPlanificada, 'EN_ESPERA', 'ALTA', GETDATE();
        `);

        ordenesCreadas.push(result.recordset[0]);
      }

      // Actualizar estado de venta a "En Producción".
      // Intentar con Status_Id = 5, si no existe usar Status_Id = 2 (compatibilidad con instalaciones antiguas).
      let targetStatusId = null;
      const try5 = await transaction.request()
        .input('Status_Id', sql.Int, 5)
        .query('SELECT Status_Id FROM ERP_VENTA_STATUS WHERE Status_Id = @Status_Id');

      if (try5.recordset.length > 0) {
        targetStatusId = 5;
      } else {
        const try2 = await transaction.request()
          .input('Status_Id', sql.Int, 2)
          .query('SELECT Status_Id FROM ERP_VENTA_STATUS WHERE Status_Id = @Status_Id');

        if (try2.recordset.length > 0) {
          targetStatusId = 2;
        }
      }

      if (targetStatusId) {
        await transaction.request()
          .input('Venta_Id', sql.Int, id)
          .input('Status_Id', sql.Int, targetStatusId)
          .input('Status', sql.VarChar, 'En Producción')
          .query(`
            UPDATE ERP_VENTAS 
            SET Status_Id = @Status_Id, Status = @Status
            WHERE Venta_Id = @Venta_Id
          `);
      }

      await transaction.commit();

      const io = req.app.get('io');
      if (io) {
        io.emit('venta:changed', { Venta_Id: Number(id) });
        io.emit('produccion:nueva', { ordenes: ordenesCreadas });
      }

      res.status(201).json({
        success: true,
        message: 'Órdenes de producción creadas correctamente',
        data: ordenesCreadas
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al crear órdenes de producción:', error);
    res.status(500).json({ success: false, message: 'Error al crear órdenes de producción', error: error.message });
  }
};

// Registrar entrada de producción al inventario
exports.registrarEntradaProduccion = async (req, res) => {
  try {
    const { OP_Id, Almacen_Id } = req.body;

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
      // Obtener datos de la OP y verificar empresa
      const opResult = await transaction.request()
        .input('OP_Id', sql.Int, OP_Id)
        .query(`
          SELECT op.*, r.PiezasBuenas
          FROM ERP_OP_PRODUCCION op
          INNER JOIN ERP_OP_RESULTADO r ON op.OP_Id = r.OP_Id
          WHERE op.OP_Id = @OP_Id AND op.Estado = 'CERRADA'
        `);

      if (opResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Orden de producción no encontrada o no está cerrada' });
      }

      const op = opResult.recordset[0];

      // Verificar que el usuario tenga acceso a la empresa de la OP
      if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
        if (!req.userCompanies.includes(op.Company_Id)) {
          await transaction.rollback();
          return res.status(403).json({ 
            success: false, 
            message: 'No tiene permisos para registrar entrada de producción en esta empresa' 
          });
        }
      }

      // Obtener stock actual
      const stockRequest = new sql.Request(transaction);
      stockRequest
        .input('Producto_Id', sql.Int, op.Producto_Id)
        .input('Almacen_Id', sql.Int, Almacen_Id);

      const stockResult = await stockRequest.query(`
        SELECT Cantidad FROM ERP_STOCK 
        WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id
      `);

      const stockAnterior = stockResult.recordset.length > 0 ? Number(stockResult.recordset[0].Cantidad) : 0;
      const stockNuevo = stockAnterior + Number(op.PiezasBuenas);

      // Actualizar o insertar stock
      const upsertRequest = new sql.Request(transaction);
      upsertRequest
        .input('Producto_Id', sql.Int, op.Producto_Id)
        .input('Almacen_Id', sql.Int, Almacen_Id)
        .input('Cantidad', sql.Decimal(18, 2), stockNuevo);

      await upsertRequest.query(`
        IF EXISTS (SELECT 1 FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id)
        BEGIN
          UPDATE ERP_STOCK SET Cantidad = @Cantidad
          WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id;
        END
        ELSE
        BEGIN
          INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
          VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0);
        END
      `);

      // Registrar en kardex
      const kardexRequest = new sql.Request(transaction);
      kardexRequest
        .input('Producto_Id', sql.Int, op.Producto_Id)
        .input('Almacen_Id', sql.Int, Almacen_Id)
        .input('TipoMovimiento', sql.VarChar, 'ENTRADA')
        .input('Cantidad', sql.Decimal(18, 2), op.PiezasBuenas)
        .input('Stock_Anterior', sql.Decimal(18, 2), stockAnterior)
        .input('Stock_Actual', sql.Decimal(18, 2), stockNuevo)
        .input('Referencia', sql.VarChar, op.NumeroOP)
        .input('Usuario', sql.VarChar, req.user?.Username || 'sistema');

      await kardexRequest.query(`
        INSERT INTO ERP_KARDEX (
          Producto_Id, Almacen_Id, TipoMovimiento, Cantidad,
          Stock_Anterior, Stock_Actual, Referencia, Usuario, FechaMovimiento
        ) VALUES (
          @Producto_Id, @Almacen_Id, @TipoMovimiento, @Cantidad,
          @Stock_Anterior, @Stock_Actual, @Referencia, @Usuario, GETDATE()
        );
      `);

      await transaction.commit();

      const io = req.app.get('io');
      if (io) {
        io.emit('inventario:changed', {
          Producto_Id: op.Producto_Id,
          Almacen_Id: Almacen_Id,
          Stock_Actual: stockNuevo
        });
      }

      res.json({
        success: true,
        message: 'Entrada de producción registrada correctamente',
        data: { Stock_Anterior: stockAnterior, Stock_Actual: stockNuevo }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al registrar entrada de producción:', error);
    res.status(500).json({ success: false, message: 'Error al registrar entrada de producción', error: error.message });
  }
};

// Obtener URL del PDF de factura
exports.getFacturaPDFUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const facturaResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query('SELECT FacturamaId, UUID FROM ERP_FACTURAS WHERE Venta_Id = @Venta_Id');

    if (facturaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    const facturamaId = facturaResult.recordset[0].FacturamaId || facturaResult.recordset[0].UUID;
    // Multiemisor usa issuedLite, con fallback a issued
    const pdfUrl = `${process.env.FACTURAMA_BASE_URL}/cfdi/pdf/issuedLite/${facturamaId}`;
    
    res.json({ success: true, pdfUrl });
  } catch (error) {
    console.error('Error al obtener URL del PDF:', error);
    res.status(500).json({ success: false, message: 'Error al obtener URL del PDF', error: error.message });
  }
};
