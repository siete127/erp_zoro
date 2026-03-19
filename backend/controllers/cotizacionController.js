const { pool, sql, poolPromise } = require('../config/db');

// Helper: obtener configuración de costos / márgenes para una empresa PTC
async function getCostConfig(companyId) {
  const request = pool.request();
  request.input('Company_Id', sql.Int, companyId);
  const result = await request.query(`
    SELECT TOP 1 *
    FROM ERP_CONFIG_COSTOS_PTC
    WHERE Company_Id = @Company_Id
  `);

  if (!result.recordset || result.recordset.length === 0) {
    // Defaults razonables si aún no hay config en BD
    return {
      MermaPctDefault: 0,
      CostoHoraManoObra: 0,
      CostoHoraMaquina: 0,
      PorcentajeIndirectos: 0,
      MargenVerdeMin: 25,
      MargenAmarilloMin: 15,
      MargenRojoMax: 15,
      DiasVigenciaDefault: 15,
      RequiereOverrideBajoMargen: true,
      HabilitarBloqueoMorosidad: false
    };
  }

  return result.recordset[0];
}

// Helper: costo unitario teórico de un producto PTC basado en BOM
async function calcularCostoUnitarioPTC(productoId, companyId) {
  const poolConn = await poolPromise;
  const requestBOM = poolConn.request();
  requestBOM.input('Producto_Id', sql.Int, productoId);
  requestBOM.input('Company_Id', sql.Int, companyId);

  const bomResult = await requestBOM.query(`
    SELECT TOP 1 b.BOM_Id, b.MermaPct, cfg.PorcentajeIndirectos
    FROM ERP_BOM b
    LEFT JOIN ERP_CONFIG_COSTOS_PTC cfg ON cfg.Company_Id = b.Company_Id
    WHERE b.Producto_Id = @Producto_Id AND b.Company_Id = @Company_Id AND b.Vigente = 1
    ORDER BY b.Version DESC;
  `);

  if (!bomResult.recordset || bomResult.recordset.length === 0) {
    // Si no hay BOM, no podemos calcular costo
    return null;
  }

  const bom = bomResult.recordset[0];
  const bomId = bom.BOM_Id;
  const mermaGlobal = Number(bom.MermaPct || 0);
  const pctIndirectos = Number(bom.PorcentajeIndirectos || 0);

  // Materiales
  const reqMat = poolConn.request();
  reqMat.input('BOM_Id', sql.Int, bomId);
  const matResult = await reqMat.query(`
    SELECT m.CantidadTeorica, m.MermaPct, mp.CostoUnitario
    FROM ERP_BOM_MATERIALES m
    INNER JOIN ERP_MATERIA_PRIMA mp ON m.MateriaPrima_Id = mp.MateriaPrima_Id
    WHERE m.BOM_Id = @BOM_Id;
  `);

  let costoMateriales = 0;
  for (const row of matResult.recordset || []) {
    const cant = Number(row.CantidadTeorica || 0);
    const mermaLocal = Number(row.MermaPct || 0);
    const costoUnitInsumo = Number(row.CostoUnitario || 0);
    const factorMerma = 1 + (mermaGlobal + mermaLocal) / 100;
    costoMateriales += cant * factorMerma * costoUnitInsumo;
  }

  // Operaciones (mano de obra, máquina, indirectos ya calculados por unidad)
  const reqOps = poolConn.request();
  reqOps.input('BOM_Id', sql.Int, bomId);
  const opsResult = await reqOps.query(`
    SELECT CostoPorUnidad
    FROM ERP_BOM_OPERACIONES
    WHERE BOM_Id = @BOM_Id;
  `);

  let costoOperaciones = 0;
  for (const row of opsResult.recordset || []) {
    costoOperaciones += Number(row.CostoPorUnidad || 0);
  }

  let costoBase = costoMateriales + costoOperaciones;
  if (pctIndirectos > 0) {
    costoBase = costoBase * (1 + pctIndirectos / 100);
  }

  return costoBase; // costo teórico por unidad
}

// Helper: preparación de detalle con cálculo de costos, utilidad y margen
async function prepararDetallesYTotales(body) {
  const {
    Company_Id,
    EmpresaCodigo,
    detalles
  } = body;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('Debe enviar al menos un renglón en la cotización');
  }

  const config = await getCostConfig(Company_Id);

  let subtotal = 0;
  let iva = 0;
  let total = 0;
  let costoTotal = 0;

  const detallesCalculados = [];

  for (const d of detalles) {
    const tipoProducto = (d.TipoProducto || 'CATALOGO').toUpperCase();
    const cantidad = Number(d.Cantidad || d.CANTIDAD || 0);
    const precioUnit = Number(d.PrecioUnitario || d.PRECIO_UNITARIO || 0);

    if (!cantidad || !precioUnit) {
      throw new Error('Cada renglón debe tener Cantidad y PrecioUnitario > 0');
    }

    let costoUnit = null;

    if (tipoProducto === 'PTC' && d.Producto_Id) {
      costoUnit = await calcularCostoUnitarioPTC(d.Producto_Id, Company_Id);
    }

    const sub = cantidad * precioUnit;
    const ivaR = sub * 0.16; // IVA fijo 16% por ahora
    const totalR = sub + ivaR;

    let utilidad = null;
    let margenPct = null;

    if (costoUnit !== null) {
      const costoR = cantidad * costoUnit;
      utilidad = sub - costoR;
      margenPct = sub > 0 ? (utilidad / sub) * 100 : null;
      costoTotal += costoR;
    }

    subtotal += sub;
    iva += ivaR;
    total += totalR;

    detallesCalculados.push({
      ID_PRODUCTO: d.Producto_Id || d.ID_PRODUCTO || null,
      TipoProducto: tipoProducto,
      SKU: d.SKU || null,
      Descripcion: d.Descripcion || '',
      UnidadVenta: d.UnidadVenta || 'PZA',
      CANTIDAD: cantidad,
      PRECIO_UNITARIO: precioUnit,
      COSTO_UNITARIO: costoUnit,
      SUBTOTAL: sub,
      IVA: ivaR,
      TOTAL: totalR,
      UTILIDAD: utilidad,
      MARGEN_PCT: margenPct,
      DatosPTC_JSON: d.DatosPTC ? JSON.stringify(d.DatosPTC) : null
    });
  }

  let utilidadBruta = null;
  let margenGlobal = null;

  if (costoTotal > 0) {
    utilidadBruta = subtotal - costoTotal;
    margenGlobal = subtotal > 0 ? (utilidadBruta / subtotal) * 100 : null;
  }

  return {
    config,
    subtotal,
    iva,
    total,
    costoTotal: costoTotal || null,
    utilidadBruta,
    margenGlobal,
    detallesCalculados
  };
}

// POST /api/cotizaciones - Crear cotización (cabecera + detalle)
exports.createCotizacion = async (req, res) => {
  try {
    const {
      Company_Id,
      EmpresaCodigo,
      Client_Id,
      ClienteRFC,
      ClienteNombre,
      Moneda = 'MXN',
      Vendedor,
      CondicionesPago,
      FechaVigencia,
      ComentarioDescuento,
      detalles,
      OverrideMargen = false
    } = req.body || {};

    if (!Company_Id) {
      return res.status(400).json({ success: false, message: 'Company_Id es requerido' });
    }
    if (!EmpresaCodigo) {
      return res.status(400).json({ success: false, message: 'EmpresaCodigo (CALI/REMA/PTC) es requerido' });
    }

    if (!Client_Id && !(ClienteRFC && ClienteNombre)) {
      return res.status(400).json({ success: false, message: 'Debe indicar Client_Id o (ClienteRFC y ClienteNombre)' });
    }

    const {
      config,
      subtotal,
      iva,
      total,
      costoTotal,
      utilidadBruta,
      margenGlobal,
      detallesCalculados
    } = await prepararDetallesYTotales({ Company_Id, EmpresaCodigo, detalles });

    // Regla de semáforo y bloqueo por margen
    const margenVerde = Number(config.MargenVerdeMin || 25);
    const margenAmarillo = Number(config.MargenAmarilloMin || 15);
    const margenRojo = Number(config.MargenRojoMax || 15);

    let semaforo = 'SIN_COSTO';
    if (margenGlobal !== null) {
      if (margenGlobal > margenVerde) semaforo = 'VERDE';
      else if (margenGlobal >= margenAmarillo && margenGlobal <= margenVerde) semaforo = 'AMARILLO';
      else if (margenGlobal < margenRojo) semaforo = 'ROJO';
    }

    // Si margen en rojo y la config exige override, bloquear
    if (semaforo === 'ROJO' && config.RequiereOverrideBajoMargen && !OverrideMargen) {
      return res.status(400).json({
        success: false,
        message: 'Margen menor al mínimo permitido. Se requiere autorización de gerente.',
        data: { margenGlobal, semaforo }
      });
    }

    const poolConn = await poolPromise;
    const transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    try {
      const reqCab = new sql.Request(transaction);
      reqCab
        .input('Company_Id', sql.Int, Company_Id)
        .input('Client_Id', sql.Int, Client_Id || null)
        .input('ClienteRFC', sql.NVarChar(20), ClienteRFC || null)
        .input('ClienteNombre', sql.NVarChar(255), ClienteNombre || null)
        .input('EmpresaCodigo', sql.NVarChar(20), EmpresaCodigo)
        .input('Moneda', sql.NVarChar(3), Moneda)
        .input('Subtotal', sql.Decimal(18, 2), subtotal)
        .input('IVA', sql.Decimal(18, 2), iva)
        .input('TOTAL', sql.Decimal(18, 2), total)
        .input('CostoTotal', sql.Decimal(18, 2), costoTotal)
        .input('UtilidadBruta', sql.Decimal(18, 2), utilidadBruta)
        .input('MargenPorc', sql.Decimal(5, 2), margenGlobal)
        .input('Status', sql.NVarChar(50), 'BORRADOR')
        .input('Vendedor', sql.NVarChar(200), Vendedor || null)
        .input('CondicionesPago', sql.NVarChar(200), CondicionesPago || null)
        .input('ComentarioDescuento', sql.NVarChar(500), ComentarioDescuento || null)
        .input('FechaVigencia', sql.DateTime, FechaVigencia || (config.DiasVigenciaDefault
          ? new Date(Date.now() + config.DiasVigenciaDefault * 24 * 60 * 60 * 1000)
          : null))
        .input('CreadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);

      const cabResult = await reqCab.query(`
        INSERT INTO ERP_COTIZACIONES (
          Company_Id, Client_Id, ClienteRFC, ClienteNombre, EmpresaCodigo, Moneda,
          Subtotal, IVA, TOTAL, CostoTotal, UtilidadBruta, MargenPorc,
          Status, Vendedor, CondicionesPago, ComentarioDescuento,
          FechaVigencia, CreadoPor
        )
        OUTPUT INSERTED.*
        VALUES (
          @Company_Id, @Client_Id, @ClienteRFC, @ClienteNombre, @EmpresaCodigo, @Moneda,
          @Subtotal, @IVA, @TOTAL, @CostoTotal, @UtilidadBruta, @MargenPorc,
          @Status, @Vendedor, @CondicionesPago, @ComentarioDescuento,
          @FechaVigencia, @CreadoPor
        );
      `);

      const cab = cabResult.recordset[0];
      const idCotizacion = cab.ID_COTIZACION;

      // Insertar detalle
      for (const d of detallesCalculados) {
        const reqDet = new sql.Request(transaction);
        reqDet
          .input('ID_COTIZACION', sql.Int, idCotizacion)
          .input('ID_PRODUCTO', sql.Int, d.ID_PRODUCTO || null)
          .input('TipoProducto', sql.NVarChar(20), d.TipoProducto)
          .input('SKU', sql.NVarChar(50), d.SKU || null)
          .input('Descripcion', sql.NVarChar(500), d.Descripcion || '')
          .input('UnidadVenta', sql.NVarChar(20), d.UnidadVenta || 'PZA')
          .input('CANTIDAD', sql.Decimal(18, 2), d.CANTIDAD)
          .input('PRECIO_UNITARIO', sql.Decimal(18, 6), d.PRECIO_UNITARIO)
          .input('COSTO_UNITARIO', sql.Decimal(18, 6), d.COSTO_UNITARIO)
          .input('SUBTOTAL', sql.Decimal(18, 2), d.SUBTOTAL)
          .input('IVA', sql.Decimal(18, 2), d.IVA)
          .input('TOTAL', sql.Decimal(18, 2), d.TOTAL)
          .input('UTILIDAD', sql.Decimal(18, 2), d.UTILIDAD)
          .input('MARGEN_PCT', sql.Decimal(5, 2), d.MARGEN_PCT)
          .input('DatosPTC_JSON', sql.NVarChar(sql.MAX), d.DatosPTC_JSON || null);

        await reqDet.query(`
          INSERT INTO ERP_COTIZACION_DETALLE (
            ID_COTIZACION, ID_PRODUCTO, TipoProducto, SKU, Descripcion, UnidadVenta,
            CANTIDAD, PRECIO_UNITARIO, COSTO_UNITARIO, SUBTOTAL, IVA, TOTAL,
            UTILIDAD, MARGEN_PCT, DatosPTC_JSON
          )
          VALUES (
            @ID_COTIZACION, @ID_PRODUCTO, @TipoProducto, @SKU, @Descripcion, @UnidadVenta,
            @CANTIDAD, @PRECIO_UNITARIO, @COSTO_UNITARIO, @SUBTOTAL, @IVA, @TOTAL,
            @UTILIDAD, @MARGEN_PCT, @DatosPTC_JSON
          );
        `);
      }

      await transaction.commit();

      // Notificar cambio de cotización en tiempo real
      const io = req.app.get('io');
      if (io) {
        io.emit('cotizacion:changed', { ID_COTIZACION: idCotizacion });
      }

      return res.status(201).json({
        success: true,
        data: {
          cabecera: cab,
          detalles: detallesCalculados,
          semaforo,
          margenGlobal
        }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al crear cotización:', error);
    return res.status(500).json({ success: false, message: 'Error al crear cotización', error: error.message });
  }
};

// GET /api/cotizaciones - Listar cotizaciones
exports.listCotizaciones = async (req, res) => {
  try {
    const { Company_Id, Client_Id, Status } = req.query || {};

    let query = `
      SELECT c.*,
             cli.LegalName AS ClientLegalName,
             cli.CommercialName AS ClientCommercialName
      FROM ERP_COTIZACIONES c
      LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
      WHERE 1 = 1`;

    const request = pool.request();

    if (Company_Id) {
      query += ' AND c.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(Company_Id));
    }
    if (Client_Id) {
      query += ' AND c.Client_Id = @Client_Id';
      request.input('Client_Id', sql.Int, Number(Client_Id));
    }
    if (Status) {
      query += ' AND c.Status = @Status';
      request.input('Status', sql.NVarChar(50), Status);
    }

    query += ' ORDER BY c.FechaCreacion DESC';

    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar cotizaciones:', error);
    return res.status(500).json({ success: false, message: 'Error al listar cotizaciones', error: error.message });
  }
};

// GET /api/cotizaciones/:id - Cabecera + detalle
exports.getCotizacionDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const request = pool.request();
    request.input('ID_COTIZACION', sql.Int, id);

    const cabResult = await request.query(`
      SELECT c.*,
             cli.LegalName AS ClientLegalName,
             cli.CommercialName AS ClientCommercialName,
             cli.RFC AS ClientRFC
      FROM ERP_COTIZACIONES c
      LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
      WHERE c.ID_COTIZACION = @ID_COTIZACION;
    `);

    if (!cabResult.recordset || cabResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    }

    const cab = cabResult.recordset[0];

    const detResult = await request.query(`
      SELECT d.*
      FROM ERP_COTIZACION_DETALLE d
      WHERE d.ID_COTIZACION = @ID_COTIZACION
      ORDER BY d.ID_DETALLE;
    `);

    return res.json({
      success: true,
      data: {
        cabecera: cab,
        detalles: detResult.recordset
      }
    });
  } catch (error) {
    console.error('Error al obtener cotización:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener cotización', error: error.message });
  }
};

// POST /api/cotizaciones/:id/aprobar - Cambiar estado a APROBADA aplicando reglas de margen
exports.aprobarCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { OverrideMargen = false, ComentarioDescuento } = req.body || {};

    const request = pool.request();
    request.input('ID_COTIZACION', sql.Int, id);

    const cabResult = await request.query(`
      SELECT *
      FROM ERP_COTIZACIONES
      WHERE ID_COTIZACION = @ID_COTIZACION;
    `);

    if (!cabResult.recordset || cabResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    }

    const cab = cabResult.recordset[0];
    const config = await getCostConfig(cab.Company_Id);

    const margenVerde = Number(config.MargenVerdeMin || 25);
    const margenAmarillo = Number(config.MargenAmarilloMin || 15);
    const margenRojo = Number(config.MargenRojoMax || 15);
    const margenGlobal = cab.MargenPorc != null ? Number(cab.MargenPorc) : null;

    let semaforo = 'SIN_COSTO';
    if (margenGlobal !== null) {
      if (margenGlobal > margenVerde) semaforo = 'VERDE';
      else if (margenGlobal >= margenAmarillo && margenGlobal <= margenVerde) semaforo = 'AMARILLO';
      else if (margenGlobal < margenRojo) semaforo = 'ROJO';
    }

    if (semaforo === 'ROJO' && config.RequiereOverrideBajoMargen && !OverrideMargen) {
      return res.status(400).json({
        success: false,
        message: 'Margen menor al mínimo permitido. Se requiere autorización de gerente para aprobar.',
        data: { margenGlobal, semaforo }
      });
    }

    const reqUpd = pool.request();
    reqUpd
      .input('ID_COTIZACION', sql.Int, id)
      .input('Status', sql.NVarChar(50), 'APROBADA')
      .input('ComentarioDescuento', sql.NVarChar(500), ComentarioDescuento || cab.ComentarioDescuento || null)
      .input('ModificadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);

    await reqUpd.query(`
      UPDATE ERP_COTIZACIONES
      SET Status = @Status,
          ComentarioDescuento = @ComentarioDescuento,
          ModificadoPor = @ModificadoPor,
          FechaModificacion = GETDATE()
      WHERE ID_COTIZACION = @ID_COTIZACION;
    `);

    return res.json({ success: true, data: { ID_COTIZACION: id, semaforo, margenGlobal } });
  } catch (error) {
    console.error('Error al aprobar cotización:', error);
    return res.status(500).json({ success: false, message: 'Error al aprobar cotización', error: error.message });
  }
};

// POST /api/cotizaciones/:id/confirmar-pedido
// Convierte una cotización aprobada en venta y, para productos PTC,
// genera órdenes de producción basadas en la cantidad pedida.
exports.confirmarPedidoDesdeCotizacion = async (req, res) => {
  const { id } = req.params;

  let transaction;

  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    const reqCab = new sql.Request(transaction);
    reqCab.input('ID_COTIZACION', sql.Int, id);

    const cabResult = await reqCab.query(`
      SELECT c.*,
             cli.LegalName AS ClientLegalName,
             cli.CommercialName AS ClientCommercialName,
             cli.RFC AS ClientRFC
      FROM ERP_COTIZACIONES c
      LEFT JOIN ERP_CLIENT cli ON c.Client_Id = cli.Client_Id
      WHERE c.ID_COTIZACION = @ID_COTIZACION;
    `);

    if (!cabResult.recordset || cabResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Cotización no encontrada' });
    }

    const cot = cabResult.recordset[0];

    if (cot.Status !== 'APROBADA') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'La cotización debe estar APROBADA para confirmar el pedido' });
    }

    // Detalle de cotización
    const reqDet = new sql.Request(transaction);
    reqDet.input('ID_COTIZACION', sql.Int, id);
    const detResult = await reqDet.query(`
      SELECT *
      FROM ERP_COTIZACION_DETALLE
      WHERE ID_COTIZACION = @ID_COTIZACION;
    `);

    const detalles = detResult.recordset || [];
    if (detalles.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'La cotización no tiene detalle capturado' });
    }

    // Crear venta (ERP_VENTAS)
    const reqVenta = new sql.Request(transaction);
    reqVenta
      .input('Company_Id', sql.Int, cot.Company_Id)
      .input('Moneda', sql.VarChar(3), cot.Moneda || 'MXN')
      .input('Subtotal', sql.Decimal(18, 2), cot.Subtotal)
      .input('IVA', sql.Decimal(18, 2), cot.IVA)
      .input('Total', sql.Decimal(18, 2), cot.TOTAL)
      .input('Status_Id', sql.Int, 2) // Completada (ya con detalle)
      .input('ID_COTIZACION', sql.Int, cot.ID_COTIZACION)
      .input('Client_Id', sql.Int, cot.Client_Id || null);

    const ventaResult = await reqVenta.query(`
      INSERT INTO ERP_VENTAS (
        Company_Id, Total, IVA, Subtotal, Moneda,
        Status_Id, FechaVenta, Status, ID_COTIZACION, Client_Id
      )
      OUTPUT INSERTED.Venta_Id
      VALUES (
        @Company_Id, @Total, @IVA, @Subtotal, @Moneda,
        @Status_Id, GETDATE(), 'Completada', @ID_COTIZACION, @Client_Id
      );
    `);

    const ventaId = ventaResult.recordset[0].Venta_Id;

    // Insertar detalle de venta desde detalle de cotización
    for (const d of detalles) {
      const sub = Number(d.SUBTOTAL || 0);
      const ivaDet = Number(d.IVA || sub * 0.16);
      const totalDet = Number(d.TOTAL || sub + ivaDet);

      const reqDetVenta = new sql.Request(transaction);
      reqDetVenta
        .input('Venta_Id', sql.Int, ventaId)
        .input('Producto_Id', sql.Int, d.ID_PRODUCTO || null)
        .input('Cantidad', sql.Decimal(18, 2), d.CANTIDAD)
        .input('PrecioUnitario', sql.Decimal(18, 2), d.PRECIO_UNITARIO)
        .input('Subtotal', sql.Decimal(18, 2), sub)
        .input('IVA', sql.Decimal(18, 2), ivaDet)
        .input('Total', sql.Decimal(18, 2), totalDet);

      await reqDetVenta.query(`
        INSERT INTO ERP_VENTA_DETALLE (
          Venta_Id, Producto_Id, Cantidad, PrecioUnitario, Subtotal, IVA, Total
        )
        VALUES (
          @Venta_Id, @Producto_Id, @Cantidad, @PrecioUnitario, @Subtotal, @IVA, @Total
        );
      `);
    }

    // Generar OP para líneas PTC (siempre asignadas a PTC como productora)
    const ptcRes = await new sql.Request(transaction).query("SELECT TOP 1 Company_Id FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'");
    const ptcCompanyId = ptcRes.recordset.length > 0 ? ptcRes.recordset[0].Company_Id : cot.Company_Id;

    for (const d of detalles) {
      const tipo = (d.TipoProducto || '').toUpperCase();
      if (tipo !== 'PTC' || !d.ID_PRODUCTO) continue;

      const reqOP = new sql.Request(transaction);
      reqOP
        .input('PTC_Company_Id', sql.Int, ptcCompanyId)
        .input('Solicitante_Company_Id', sql.Int, cot.Company_Id)
        .input('Venta_Id', sql.Int, ventaId)
        .input('ID_COTIZACION', sql.Int, cot.ID_COTIZACION)
        .input('Producto_Id', sql.Int, d.ID_PRODUCTO)
        .input('CantidadPlanificada', sql.Decimal(18, 2), d.CANTIDAD)
        .input('Prioridad', sql.NVarChar(20), 'NORMAL')
        .input('FechaEntregaCompromiso', sql.DateTime, cot.FechaVigencia || null);

      const opResult = await reqOP.query(`
        INSERT INTO ERP_OP_PRODUCCION (
          NumeroOP, Company_Id, CompanySolicitante_Id, Venta_Id, ID_COTIZACION,
          Producto_Id, BOM_Id, CantidadPlanificada,
          Estado, Prioridad, FechaCreacion, FechaEntregaCompromiso
        )
        OUTPUT INSERTED.OP_Id, INSERTED.NumeroOP
        SELECT
          'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' + RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
          @PTC_Company_Id, @Solicitante_Company_Id, @Venta_Id, @ID_COTIZACION,
          @Producto_Id,
          (SELECT TOP 1 BOM_Id FROM ERP_BOM WHERE Producto_Id = @Producto_Id AND Vigente = 1 ORDER BY CASE WHEN Company_Id = @PTC_Company_Id THEN 0 ELSE 1 END, Version DESC),
          @CantidadPlanificada,
          'EN_ESPERA', @Prioridad, GETDATE(), @FechaEntregaCompromiso;
      `);
    }

    // Marcar cotización como CONVERTIDA
    const reqUpdCot = new sql.Request(transaction);
    reqUpdCot
      .input('ID_COTIZACION', sql.Int, id)
      .input('Status', sql.NVarChar(50), 'CONVERTIDA')
      .input('ModificadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);

    await reqUpdCot.query(`
      UPDATE ERP_COTIZACIONES
      SET Status = @Status,
          ModificadoPor = @ModificadoPor,
          FechaModificacion = GETDATE()
      WHERE ID_COTIZACION = @ID_COTIZACION;
    `);

    await transaction.commit();

    return res.json({
      success: true,
      data: {
        ID_COTIZACION: cot.ID_COTIZACION,
        Venta_Id: ventaId
      }
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error('Error al confirmar pedido desde cotización:', error);
    return res.status(500).json({ success: false, message: 'Error al confirmar pedido desde cotización', error: error.message });
  }
};
