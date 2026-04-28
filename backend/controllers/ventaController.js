const sql = require('mssql');
const { poolPromise } = require('../config/db');

const getStockEmpresa = async (pool, { productoId, companyId }) => {
  const stockRes = await pool.request()
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, companyId)
    .query(`
      SELECT SUM(s.Cantidad) AS StockTotal
      FROM ERP_STOCK s
      INNER JOIN ERP_ALMACENES a ON s.Almacen_Id = a.Almacen_Id
      WHERE s.Producto_Id = @Producto_Id
        AND a.Company_Id = @Company_Id;
    `);

  return Number(stockRes.recordset[0]?.StockTotal || 0);
};

const getStockReservadoOtrasVentas = async (pool, { productoId, companyId, ventaId }) => {
  const reservedRes = await pool.request()
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, companyId)
    .input('Venta_Id', sql.Int, ventaId)
    .query(`
      SELECT SUM(
        CASE
          WHEN ISNULL(r.PiezasBuenas, 0) < ISNULL(op.CantidadPlanificada, 0)
            THEN ISNULL(r.PiezasBuenas, 0)
          ELSE ISNULL(op.CantidadPlanificada, 0)
        END
      ) AS CantidadReservada
      FROM ERP_OP_PRODUCCION op
      INNER JOIN ERP_OP_RESULTADO r ON r.OP_Id = op.OP_Id
      INNER JOIN ERP_VENTAS v ON v.Venta_Id = op.Venta_Id
      WHERE op.Producto_Id = @Producto_Id
        AND op.CompanySolicitante_Id = @Company_Id
        AND op.Venta_Id <> @Venta_Id
        AND op.Estado = 'CERRADA'
        AND v.Status_Id NOT IN (3, 4);
    `);

  return Number(reservedRes.recordset[0]?.CantidadReservada || 0);
};

const getStockDisponibleParaVenta = async (pool, { productoId, companyId, ventaId }) => {
  const stockTotal = await getStockEmpresa(pool, { productoId, companyId });
  const stockReservado = await getStockReservadoOtrasVentas(pool, { productoId, companyId, ventaId });

  return {
    stockTotal,
    stockReservado,
    stockDisponible: Math.max(0, stockTotal - stockReservado),
  };
};

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
               CASE 
                 WHEN UPPER(ISNULL(v.Status, '')) = 'CONFIRMADA' THEN v.Status
                 ELSE ISNULL(s.Nombre, v.Status)
               END as StatusNombre,
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
      SELECT v.*, 
             CASE 
               WHEN UPPER(ISNULL(v.Status, '')) = 'CONFIRMADA' THEN v.Status
               ELSE s.Nombre
             END as StatusNombre,
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
    const {
      UsoCFDI = 'G03',
      FormaPago = '01',
      MetodoPago = 'PUE',
      ReceptorNombre,
      ReceptorRFC,
      ReceptorFiscalRegime,
      ReceptorTaxZipCode,
      ReceptorEmail,
    } = req.body;

    const withFallback = (value, fallback) => {
      if (value === undefined || value === null) return fallback;
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : fallback;
    };

    const pool = await poolPromise;
    const GENERIC_RFCS = new Set(['XAXX010101000', 'XEXX010101000']);

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

    const ventaConfirmada = String(venta.Status || '').trim().toLowerCase() === 'confirmada';

    if (venta.Status_Id !== 2 || !ventaConfirmada) {
      return res.status(400).json({
        success: false,
        message: 'Primero debe confirmar la venta para poder facturarla'
      });
    }

    const opPendientesResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT COUNT(*) AS TotalPendientes
        FROM ERP_OP_PRODUCCION
        WHERE Venta_Id = @Venta_Id
          AND Estado <> 'CERRADA'
      `);

    const totalOpPendientes = Number(opPendientesResult.recordset[0]?.TotalPendientes || 0);
    if (totalOpPendientes > 0) {
      return res.status(400).json({
        success: false,
        message: `La venta tiene ${totalOpPendientes} orden(es) de producción sin cerrar. Confirme la venta cuando la producción esté concluida.`
      });
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

      // 1) Verificar stock PROPIO disponible para esta venta (descontando reservas de otras ventas)
      const stockPropioInfo = await getStockDisponibleParaVenta(pool, {
        productoId: item.Producto_Id,
        companyId: venta.Company_Id,
        ventaId: Number(id),
      });
      const stockPropio = stockPropioInfo.stockDisponible;
      const cant = Number(item.Cantidad || 0);

      if (stockPropio >= cant) continue; // Stock propio suficiente

      // 2) Verificar stock de PTC (empresa productora)
      let stockPTC = 0;
      if (ptcCompanyId && ptcCompanyId !== venta.Company_Id) {
        const stockPTCInfo = await getStockDisponibleParaVenta(pool, {
          productoId: item.Producto_Id,
          companyId: ptcCompanyId,
          ventaId: Number(id),
        });
        stockPTC = stockPTCInfo.stockDisponible;
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

      if (faltanteTotal > 0) productosConFaltante.push({
        Producto_Id: item.Producto_Id,
        Nombre: item.Nombre,
        StockPropio: stockPropio,
        StockPropioFisico: stockPropioInfo.stockTotal,
        StockPropioReservado: stockPropioInfo.stockReservado,
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

    const clientRfc = String(venta.ClienteRFC || '').trim().toUpperCase();
    const bodyRfc = String(ReceptorRFC || '').trim().toUpperCase();

    if (clientRfc && bodyRfc && bodyRfc !== clientRfc) {
      return res.status(400).json({
        success: false,
        message: 'El RFC del receptor no coincide con el RFC fiscal del cliente asociado a la venta'
      });
    }

    const receiverRfc = withFallback(bodyRfc, clientRfc);
    const legalName = withFallback(venta.ClienteNombre, null);
    const requestedName = withFallback(ReceptorNombre, null);
    const shouldUseLegalName = !!legalName && !!receiverRfc && !GENERIC_RFCS.has(receiverRfc);
    const receiverName = shouldUseLegalName ? legalName : withFallback(requestedName, legalName);

    const cfdiData = {
      Receptor: {
        Rfc: receiverRfc,
        Nombre: receiverName,
        Email: withFallback(ReceptorEmail, venta.ClienteEmail),
        FiscalRegime: withFallback(ReceptorFiscalRegime, venta.ClienteFiscalRegime),
        TaxZipCode: withFallback(ReceptorTaxZipCode, venta.ClienteTaxZipCode),
        UsoCfdi: UsoCFDI
      },
      Conceptos: conceptos,
      FormaPago: FormaPago,
      MetodoPago: MetodoPago,
      Moneda: venta.Moneda
    };

    // Determinar la empresa emisora para el timbrado.
    // Reglas:
    // - Si el cliente provee `issuerCompanyId` (body, query o header `x-company-id`), se usa tras validar pertenencia.
    // - Si el usuario está asignado a una sola compañía, se usa esa.
    // - Si el usuario pertenece a varias compañías y no se especifica, devolver 400 solicitando `issuerCompanyId`.
    let issuerCompanyId = null;
    const candidateFromBody = req.body && (req.body.issuerCompanyId || req.body.IssuerCompanyId);
    const candidateFromQuery = req.query && (req.query.issuerCompanyId || req.query.IssuerCompanyId);
    const candidateFromHeader = req.headers['x-company-id'] || req.headers['X-Company-Id'];

    if (candidateFromBody) issuerCompanyId = Number(candidateFromBody);
    else if (candidateFromQuery) issuerCompanyId = Number(candidateFromQuery);
    else if (candidateFromHeader) issuerCompanyId = Number(candidateFromHeader);

    const userCompanies = Array.isArray(req.userCompanies) ? req.userCompanies.map(Number) : [];

    if (issuerCompanyId) {
      if (!userCompanies.includes(issuerCompanyId)) {
        return res.status(403).json({ success: false, message: 'No tiene permisos para timbrar como esa empresa' });
      }
    } else if (userCompanies.length === 1) {
      issuerCompanyId = Number(userCompanies[0]);
    } else {
      return res.status(400).json({ success: false, message: 'Usuario asignado a múltiples empresas. Especifique `issuerCompanyId` en body/query/header `x-company-id`.' });
    }

    const facturaPayload = await facturamaService.buildFacturaPayload(cfdiData, issuerCompanyId);

    // Enviar a PAC
    console.log('Enviando a Facturama (issuer companyId=' + issuerCompanyId + '):', JSON.stringify(facturaPayload, null, 2));
    // Selección de credenciales por empresa: buscamos primero en .env (convención)
    // Si realmente quieres que el sistema lea la BD, define FACTURAMA_USE_DB=true en .env
    const companyId = issuerCompanyId;
    let companyUser = null;
    let companyPass = null;

    // Buscar en .env con las claves por convención
    const envUserKeys = [
      `FACTURAMA_USER_COMPANY_${companyId}`,
      `FACTURAMA_USER_${companyId}`
    ];
    const envPassKeys = [
      `FACTURAMA_PASSWORD_COMPANY_${companyId}`,
      `FACTURAMA_PASSWORD_${companyId}`
    ];

    for (const k of envUserKeys) {
      if (process.env[k]) { companyUser = String(process.env[k]).trim(); break; }
    }
    for (const k of envPassKeys) {
      if (process.env[k]) { companyPass = String(process.env[k]).trim(); break; }
    }

    if (companyUser && companyPass) {
      console.log(`[Facturama] Credenciales encontradas en .env para Company_Id=${companyId}, user=${companyUser}`);
    } else if (process.env.FACTURAMA_USE_DB && String(process.env.FACTURAMA_USE_DB).toLowerCase() === 'true') {
      // Solo intentar leer DB si FACTURAMA_USE_DB=true
      try {
        const credRes = await pool.request()
          .input('Company_Id', sql.Int, companyId)
          .query(`SELECT TOP 1 FacturamaUser, FacturamaPassword FROM ERP_COMPANY WHERE Company_Id = @Company_Id`);
        if (credRes && credRes.recordset && credRes.recordset.length > 0) {
          const row = credRes.recordset[0];
          if (row.FacturamaUser && row.FacturamaPassword) {
            companyUser = String(row.FacturamaUser).trim();
            companyPass = String(row.FacturamaPassword).trim();
            console.log(`[Facturama] Credenciales encontradas en BD para Company_Id=${companyId}, user=${companyUser}`);
          }
        }
      } catch (dbCredErr) {
        console.debug('[Facturama] No se pudo leer credenciales desde BD (posible columna faltante):', dbCredErr.message || dbCredErr);
      }
    } else {
      console.log('[Facturama] No se encontraron credenciales por empresa en .env — usando credenciales globales.');
    }

    let authBase64 = null;
    if (companyUser && companyPass) {
      authBase64 = Buffer.from(`${companyUser}:${companyPass}`).toString('base64');
    }

    const cfdiResult = await facturamaService.timbrarMultiemisor(facturaPayload, { authBase64 });

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
      const uuid = cfdiResult.Complement?.TaxStamp?.Uuid || cfdiResult.Id || 'TEMP-' + Date.now();
      const facturamaId = cfdiResult.Id || uuid;
      
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .input('Company_Id', sql.Int, venta.Company_Id)
        .input('UUID', sql.VarChar(50), uuid)
        .input('FacturamaId', sql.VarChar(50), facturamaId)
        .input('Serie', sql.VarChar(10), cfdiResult.Serie || null)
        .input('Folio', sql.VarChar(20), cfdiResult.Folio || null)
        .input('EmisorRFC', sql.VarChar(13), facturaPayload.Issuer.Rfc)
        .input('ReceptorRFC', sql.VarChar(13), facturaPayload.Receiver.Rfc)
        .input('ReceptorNombre', sql.VarChar(255), facturaPayload.Receiver.Name)
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

      // ----------------------
      // Insertar asientos contables vinculados a la factura
      // ----------------------
      try {
        const safeNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

        // Obtener Factura_Id recién insertada (evitar duplicados)
        const fcheckRes = await transaction.request()
          .input('FacturamaId', sql.VarChar(50), facturamaId)
          .input('UUID', sql.VarChar(50), uuid)
          .query('SELECT TOP 1 Factura_Id FROM ERP_FACTURAS WHERE FacturamaId = @FacturamaId OR UUID = @UUID');

        const facturaIdInserted = (fcheckRes.recordset && fcheckRes.recordset[0]) ? Number(fcheckRes.recordset[0].Factura_Id) : null;

        if (facturaIdInserted) {
          // Helper: buscar account code por keywords
          const findAccountCode = async (keywords = []) => {
            try {
              const search = keywords.map(k => `LOWER(Name) LIKE '%${k}%'`).join(' OR ');
              const q = `SELECT TOP 1 AccountCode FROM ERP_ACCOUNTS WHERE (${search}) AND Company_Id = @Company_Id`;
              const r = await transaction.request().input('Company_Id', sql.Int, venta.Company_Id).query(q);
              if (r.recordset && r.recordset[0]) return r.recordset[0].AccountCode;
            } catch (e) {
              // ignore
            }
            return null;
          };

          let accountReceivable = await findAccountCode(['cliente','clientes','por cobrar','cxp']);
          let accountRevenue = await findAccountCode(['venta','ventas','ingreso','ingresos']);
          let accountVAT = await findAccountCode(['iva','impuesto']);

          accountReceivable = accountReceivable || '1300';
          accountRevenue = accountRevenue || '4000';
          accountVAT = accountVAT || '2100';

          const Subtotal = safeNumber(venta.Subtotal);
          const IVA = safeNumber(venta.IVA);
          const Total = safeNumber(venta.Total);

          // Evitar duplicar asientos: comprobar si ya existen registros en ERP_LEDGER para esta referencia
          let existingLedgerCount = 0;
          try {
            const ledRes = await transaction.request().input('RefId', sql.Int, facturaIdInserted).query('SELECT COUNT(1) AS cnt FROM ERP_LEDGER WHERE Reference_Id = @RefId');
            existingLedgerCount = (ledRes.recordset && ledRes.recordset[0] && Number(ledRes.recordset[0].cnt)) || 0;
          } catch (e) {
            existingLedgerCount = 0;
          }

          if (existingLedgerCount === 0) {
            const ledgerInsert = async (acctCode, debit, credit, refId, desc) => {
              await transaction.request()
                .input('Date', sql.DateTime, new Date())
                .input('AccountCode', sql.VarChar(50), acctCode)
                .input('Debit', sql.Decimal(18,2), debit)
                .input('Credit', sql.Decimal(18,2), credit)
                .input('Reference_Id', sql.Int, refId)
                .input('Company_Id', sql.Int, venta.Company_Id)
                .input('Description', sql.VarChar(500), desc)
                .query(`INSERT INTO ERP_LEDGER (Date, AccountCode, Debit, Credit, Reference_Id, Company_Id, Description, CreatedAt)
                        VALUES (@Date, @AccountCode, @Debit, @Credit, @Reference_Id, @Company_Id, @Description, GETDATE())`);
            };

            // Debito CxC = Total
            await ledgerInsert(accountReceivable, Total, 0, facturaIdInserted, `Factura ${facturamaId} - Cliente ${facturaPayload.Receiver?.Rfc || ''}`);

            // Credito Ventas = Subtotal
            if (Subtotal > 0) await ledgerInsert(accountRevenue, 0, Subtotal, facturaIdInserted, `Factura ${facturamaId} - Venta`);

            // Credito IVA = IVA
            if (IVA > 0) await ledgerInsert(accountVAT, 0, IVA, facturaIdInserted, `Factura ${facturamaId} - IVA`);
          } else {
            console.log('Asientos ya existentes para Factura_Id', facturaIdInserted, '- omitiendo inserción.');
          }
        }
      } catch (errLedger) {
        console.warn('Error insertando asientos en ventaController (se continúa):', errLedger?.message || errLedger);
      }

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

// Confirmar venta (requisito previo a facturación)
exports.confirmarVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const ventaResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query('SELECT Venta_Id, Company_Id, Status_Id, Status FROM ERP_VENTAS WHERE Venta_Id = @Venta_Id');

    if (ventaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const venta = ventaResult.recordset[0];

    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(venta.Company_Id)) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para confirmar ventas de esta empresa'
        });
      }
    }

    if (venta.Status_Id === 3) {
      return res.status(400).json({ success: false, message: 'La venta ya está facturada' });
    }

    if (venta.Status_Id === 4) {
      return res.status(400).json({ success: false, message: 'No se puede confirmar una venta cancelada' });
    }

    if (String(venta.Status || '').trim().toLowerCase() === 'confirmada') {
      return res.json({
        success: true,
        message: 'La venta ya estaba confirmada',
        data: {
          Venta_Id: Number(id),
          Status_Id: 2,
          Status: 'Confirmada'
        }
      });
    }

    const opResumenResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT
          COUNT(*) AS TotalOP,
          SUM(CASE WHEN Estado = 'CERRADA' THEN 1 ELSE 0 END) AS TotalOPCerradas,
          SUM(CASE WHEN Estado <> 'CERRADA' THEN 1 ELSE 0 END) AS TotalOPPendientes
        FROM ERP_OP_PRODUCCION
        WHERE Venta_Id = @Venta_Id
      `);

    const totalOP = Number(opResumenResult.recordset[0]?.TotalOP || 0);
    const totalOPPendientes = Number(opResumenResult.recordset[0]?.TotalOPPendientes || 0);

    if (totalOP > 0 && totalOPPendientes > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede confirmar la venta: hay ${totalOPPendientes} orden(es) de producción pendientes de cierre`
      });
    }

    const detalleResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT vd.*, p.Nombre
        FROM ERP_VENTA_DETALLE vd
        LEFT JOIN ERP_PRODUCTOS p ON vd.Producto_Id = p.Producto_Id
        WHERE vd.Venta_Id = @Venta_Id
      `);

    const detalle = detalleResult.recordset || [];

    if (detalle.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede confirmar una venta sin productos.'
      });
    }

    const productosConFaltante = [];

    const ptcResult = await pool.request().query(`
      SELECT TOP 1 Company_Id FROM ERP_COMPANY
      WHERE NameCompany LIKE '%PTC%'
    `);
    const ptcCompanyId = ptcResult.recordset.length > 0 ? ptcResult.recordset[0].Company_Id : null;

    for (const item of detalle) {
      if (!item.Producto_Id) continue;

      const stockPropioInfo = await getStockDisponibleParaVenta(pool, {
        productoId: item.Producto_Id,
        companyId: venta.Company_Id,
        ventaId: Number(id),
      });
      const stockPropio = stockPropioInfo.stockDisponible;
      const cant = Number(item.Cantidad || 0);

      if (stockPropio >= cant) continue;

      let stockPTC = 0;
      if (ptcCompanyId && ptcCompanyId !== venta.Company_Id) {
        const stockPTCInfo = await getStockDisponibleParaVenta(pool, {
          productoId: item.Producto_Id,
          companyId: ptcCompanyId,
          ventaId: Number(id),
        });
        stockPTC = stockPTCInfo.stockDisponible;
      }

      const faltantePropio = cant - stockPropio;
      const disponiblePTC = Math.min(stockPTC, faltantePropio);
      const faltanteTotal = faltantePropio - disponiblePTC;

      const bomRes = await pool.request()
        .input('Producto_Id', sql.Int, item.Producto_Id)
        .query(`
          SELECT TOP 1 BOM_Id
          FROM ERP_BOM
          WHERE Producto_Id = @Producto_Id
            AND Vigente = 1
          ORDER BY Version DESC
        `);

      if (faltanteTotal > 0) productosConFaltante.push({
        Producto_Id: item.Producto_Id,
        Nombre: item.Nombre,
        StockPropio: stockPropio,
        StockPropioFisico: stockPropioInfo.stockTotal,
        StockPropioReservado: stockPropioInfo.stockReservado,
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

    if (productosConFaltante.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Inventario insuficiente. Verifique stock de PTC o solicite producción.',
        requiereProduccion: true,
        productos: productosConFaltante,
        ptcCompanyId,
        sugerencia: 'Los productos con faltante pueden solicitarse a PTC (producción) o surtirse de su stock existente'
      });
    }

    const statusText = 'Confirmada';

    await pool.request()
      .input('Venta_Id', sql.Int, id)
      .input('Status_Id', sql.Int, 2)
      .input('Status', sql.VarChar, statusText)
      .query(`
        UPDATE ERP_VENTAS
        SET Status_Id = @Status_Id,
            Status = @Status
        WHERE Venta_Id = @Venta_Id
      `);

    const io = req.app.get('io');
    if (io) {
      io.emit('venta:changed', { Venta_Id: Number(id) });
    }

    return res.json({
      success: true,
      message: 'Venta confirmada correctamente. Ahora puede facturar.',
      data: {
        Venta_Id: Number(id),
        Status_Id: 2,
        Status: statusText,
        TotalOP: totalOP
      }
    });
  } catch (error) {
    console.error('Error al confirmar venta:', error);
    return res.status(500).json({ success: false, message: 'Error al confirmar venta', error: error.message });
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

      // Al enviar a producción, la venta se mantiene en "Pendiente"
      await transaction.request()
        .input('Venta_Id', sql.Int, id)
        .input('Status_Id', sql.Int, 1)
        .input('Status', sql.VarChar, 'Pendiente')
        .query(`
          UPDATE ERP_VENTAS
          SET Status_Id = @Status_Id, Status = @Status
          WHERE Venta_Id = @Venta_Id
        `);

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

// Descargar PDF de factura
exports.getFacturaPDFUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    
    const facturaResult = await pool.request()
      .input('Venta_Id', sql.Int, id)
      .query(`
        SELECT f.FacturamaId, f.UUID, v.Company_Id
        FROM ERP_FACTURAS f
        INNER JOIN ERP_VENTAS v ON v.Venta_Id = f.Venta_Id
        WHERE f.Venta_Id = @Venta_Id
      `);

    if (facturaResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    const factura = facturaResult.recordset[0];

    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      if (!req.userCompanies.includes(factura.Company_Id)) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para descargar factura de esta empresa'
        });
      }
    }

    const facturamaId = factura.FacturamaId || factura.UUID;
    if (!facturamaId || String(facturamaId).startsWith('TEMP-')) {
      return res.status(400).json({
        success: false,
        message: 'Esta factura no tiene un ID válido de Facturama'
      });
    }

    const facturamaService = require('../services/facturamaService');
    const pdfData = await facturamaService.descargarPDF(facturamaId);
    const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData || []);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${facturamaId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al descargar PDF de factura:', error);
    res.status(500).json({ success: false, message: 'Error al descargar PDF de factura', error: error.message });
  }
};
