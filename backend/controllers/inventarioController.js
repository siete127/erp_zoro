const { pool, sql } = require("../config/db");
const {
  resolveAlmacenProducto,
  syncInventarioEstado,
  upsertProductoInventarioConfig,
  normalizeClasificacionInventario,
  registrarRecepcionProduccion,
  cancelarRecepcionProduccion,
} = require("../services/inventoryControlService");

// Helper: obtener stock actual para un producto/almacén
async function getCurrentStock(productoId, almacenId, transaction) {
  const request = transaction ? new sql.Request(transaction) : pool.request();
  const result = await request
    .input("Producto_Id", sql.Int, productoId)
    .input("Almacen_Id", sql.Int, almacenId)
    .query(`
      SELECT Cantidad, Stock_Minimo
      FROM ERP_STOCK
      WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id;
    `);

  if (!result.recordset || result.recordset.length === 0) {
    return { cantidad: 0, stockMinimo: 0 };
  }

  const row = result.recordset[0];
  return { cantidad: Number(row.Cantidad || 0), stockMinimo: Number(row.Stock_Minimo || 0) };
}

// GET /api/inventario - Listado de stock por producto/almacén
exports.listStock = async (req, res) => {
  try {
    const { productoId, almacenId, sku, nombre, company_id } = req.query || {};

    let query = `
      SELECT s.Producto_Id,
             p.SKU,
             p.Nombre,
             s.Almacen_Id,
             a.Nombre AS AlmacenNombre,
             a.Company_Id,
             c.NameCompany,
              cfg.ClasificacionInventario,
              cfg.Almacen_Id AS AlmacenAsignado_Id,
              aa.Nombre AS AlmacenAsignadoNombre,
             s.Cantidad,
             s.Stock_Minimo
      FROM ERP_STOCK s
      JOIN ERP_PRODUCTOS p ON p.Producto_Id = s.Producto_Id
      JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
      LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
            LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg ON cfg.Producto_Id = s.Producto_Id AND cfg.Company_Id = a.Company_Id AND cfg.Activo = 1
            LEFT JOIN ERP_ALMACENES aa ON aa.Almacen_Id = cfg.Almacen_Id
      WHERE 1 = 1`;

    const request = pool.request();

    // Filtrar por empresa del usuario si no es admin
    if (!req.isAdmin) {
      if (req.userCompanies && req.userCompanies.length > 0) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((cid, idx) => {
          request.input(`userCompany${idx}`, sql.Int, cid);
        });
        query += ` AND a.Company_Id IN (${placeholders})`;
      } else {
        // sin empresas -> no tiene acceso a stock
        return res.json([]);
      }
    } else if (company_id) {
      query += " AND a.Company_Id = @Company_Id";
      request.input("Company_Id", sql.Int, Number(company_id));
    }

    if (productoId) {
      query += " AND s.Producto_Id = @Producto_Id";
      request.input("Producto_Id", sql.Int, Number(productoId));
    }

    if (almacenId) {
      query += " AND s.Almacen_Id = @Almacen_Id";
      request.input("Almacen_Id", sql.Int, Number(almacenId));
    }

    if (sku) {
      query += " AND p.SKU LIKE @SKU";
      request.input("SKU", sql.VarChar, `%${sku}%`);
    }

    if (nombre) {
      query += " AND p.Nombre LIKE @Nombre";
      request.input("Nombre", sql.VarChar, `%${nombre}%`);
    }

    query += " ORDER BY p.Nombre, a.Nombre";

    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (err) {
    console.error("inventario.listStock error", err);
    res.status(500).json({ msg: "Error al obtener inventario" });
  }
};

// GET /api/inventario/producto/:productoId - stock del producto en todos los almacenes
exports.getStockByProducto = async (req, res) => {
  const productoId = Number(req.params.productoId);
  if (!productoId || isNaN(productoId)) {
    return res.status(400).json({ msg: "Producto_Id inválido" });
  }

  try {
    // aplicar mismo filtro de empresas para el detalle de stock por producto
    let stockQuery = `
        SELECT s.Producto_Id,
               p.SKU,
               p.Nombre,
               s.Almacen_Id,
               a.Nombre AS AlmacenNombre,
           a.Company_Id,
           cfg.ClasificacionInventario,
           cfg.Almacen_Id AS AlmacenAsignado_Id,
           aa.Nombre AS AlmacenAsignadoNombre,
               s.Cantidad,
               s.Stock_Minimo
        FROM ERP_STOCK s
        JOIN ERP_PRODUCTOS p ON p.Producto_Id = s.Producto_Id
        JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
         LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg ON cfg.Producto_Id = s.Producto_Id AND cfg.Company_Id = a.Company_Id AND cfg.Activo = 1
         LEFT JOIN ERP_ALMACENES aa ON aa.Almacen_Id = cfg.Almacen_Id
        WHERE s.Producto_Id = @Producto_Id`;

    const stockReq = pool.request().input("Producto_Id", sql.Int, productoId);
    if (!req.isAdmin) {
      if (req.userCompanies && req.userCompanies.length > 0) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((cid, idx) => {
          stockReq.input(`userCompany${idx}`, sql.Int, cid);
        });
        stockQuery += ` AND a.Company_Id IN (${placeholders})`;
      } else {
        return res.json([]);
      }
    }
    stockQuery += "\n        ORDER BY a.Nombre;";

    const result = await stockReq.query(stockQuery);

    res.json(result.recordset || []);
  } catch (err) {
    console.error("inventario.getStockByProducto error", err);
    res.status(500).json({ msg: "Error al obtener stock por producto" });
  }
};

// GET /api/inventario/consolidado - inventario total por producto/empresa con estados operativos
exports.listConsolidado = async (req, res) => {
  try {
    const { productoId, company_id, search = "", clasificacion } = req.query || {};

    let query = `
      SELECT p.Producto_Id,
             p.SKU,
             p.Nombre,
             pe.Company_Id,
             c.NameCompany,
             cfg.ClasificacionInventario,
             cfg.Almacen_Id AS AlmacenAsignado_Id,
             aw.Nombre AS AlmacenAsignadoNombre,
             aw.Codigo AS AlmacenAsignadoCodigo,
             ISNULL(stock.TotalAlmacen, 0) AS CantidadAlmacen,
             ISNULL(state.CantidadEnMaquina, 0) AS CantidadEnMaquina,
             ISNULL(state.CantidadEntregadaProduccion, 0) AS CantidadEntregadaProduccion,
             ISNULL(state.CantidadEnProceso, 0) AS CantidadEnProceso,
             state.FechaCorte AS UltimoCorte
      FROM ERP_PRODUCTOS p
      INNER JOIN ERP_PRODUCTO_EMPRESA pe ON pe.Producto_Id = p.Producto_Id
      INNER JOIN ERP_COMPANY c ON c.Company_Id = pe.Company_Id
      LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg ON cfg.Producto_Id = p.Producto_Id AND cfg.Company_Id = pe.Company_Id AND cfg.Activo = 1
      LEFT JOIN ERP_ALMACENES aw ON aw.Almacen_Id = cfg.Almacen_Id
      OUTER APPLY (
        SELECT ISNULL(SUM(s.Cantidad), 0) AS TotalAlmacen
        FROM ERP_STOCK s
        INNER JOIN ERP_ALMACENES sa ON sa.Almacen_Id = s.Almacen_Id
        WHERE s.Producto_Id = p.Producto_Id
          AND sa.Company_Id = pe.Company_Id
      ) stock
      OUTER APPLY (
        SELECT TOP 1 ie.CantidadEnMaquina,
                     ie.CantidadEntregadaProduccion,
                     ie.CantidadEnProceso,
                     ie.FechaCorte
        FROM ERP_INVENTARIO_ESTADO_PRODUCTO ie
        WHERE ie.Producto_Id = p.Producto_Id
          AND ie.Company_Id = pe.Company_Id
          AND (
            (cfg.Almacen_Id IS NULL AND ie.Almacen_Id IS NULL) OR
            ie.Almacen_Id = cfg.Almacen_Id
          )
        ORDER BY ie.FechaCorte DESC, ie.InventarioEstado_Id DESC
      ) state
      WHERE p.Activo = 1`;

    const request = pool.request();

    if (!req.isAdmin) {
      if (req.userCompanies?.length) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((companyId, idx) => {
          request.input(`userCompany${idx}`, sql.Int, companyId);
        });
        query += ` AND pe.Company_Id IN (${placeholders})`;
      } else {
        return res.json([]);
      }
    } else if (company_id) {
      query += ' AND pe.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(company_id));
    }

    if (productoId) {
      query += ' AND p.Producto_Id = @Producto_Id';
      request.input('Producto_Id', sql.Int, Number(productoId));
    }

    if (search) {
      query += ' AND (p.SKU LIKE @Search OR p.Nombre LIKE @Search)';
      request.input('Search', sql.VarChar, `%${search}%`);
    }

    if (clasificacion) {
      query += ' AND cfg.ClasificacionInventario = @ClasificacionInventario';
      request.input('ClasificacionInventario', sql.NVarChar(30), normalizeClasificacionInventario(clasificacion));
    }

    query += ' ORDER BY c.NameCompany, p.Nombre';

    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('inventario.listConsolidado error', err);
    res.status(500).json({ msg: 'Error al obtener inventario consolidado', error: err.message });
  }
};

// GET /api/inventario/recepcion/pendientes - productos de OP terminadas listos para almacén
exports.listRecepcionPendiente = async (req, res) => {
  try {
    const { company_id, productoId } = req.query || {};

    let query = `
      SELECT op.OP_Id,
             op.NumeroOP,
             op.Company_Id,
             c.NameCompany,
             op.Producto_Id,
             p.SKU,
              p.Nombre AS NombreProducto,
              p.Nombre AS ProductoNombre,
              CASE WHEN ISNULL(op.CantidadProducida, 0) > 0 THEN op.CantidadProducida ELSE op.CantidadPlanificada END AS CantidadListaRecepcion,
             op.CantidadPlanificada,
             op.CantidadProducida,
              op.FechaFin AS FechaCierre,
              op.FechaFin,
             cfg.ClasificacionInventario,
             cfg.Almacen_Id AS AlmacenSugerido_Id,
              aw.Nombre AS AlmacenSugerido,
             aw.Nombre AS AlmacenSugeridoNombre,
             aw.Codigo AS AlmacenSugeridoCodigo
      FROM ERP_OP_PRODUCCION op
      INNER JOIN ERP_PRODUCTOS p ON p.Producto_Id = op.Producto_Id
      INNER JOIN ERP_COMPANY c ON c.Company_Id = op.Company_Id
      LEFT JOIN ERP_PRODUCTO_ALMACEN_CONFIG cfg ON cfg.Producto_Id = op.Producto_Id AND cfg.Company_Id = op.Company_Id AND cfg.Activo = 1
      LEFT JOIN ERP_ALMACENES aw ON aw.Almacen_Id = cfg.Almacen_Id
      LEFT JOIN ERP_RECEPCION_PRODUCTO_TERMINADO rpt ON rpt.OP_Id = op.OP_Id
      WHERE op.Estado = 'TERMINADA'
        AND rpt.OP_Id IS NULL`;

    const request = pool.request();

    if (!req.isAdmin) {
      if (req.userCompanies?.length) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((companyIdItem, idx) => {
          request.input(`userCompany${idx}`, sql.Int, companyIdItem);
        });
        query += ` AND op.Company_Id IN (${placeholders})`;
      } else {
        return res.json([]);
      }
    } else if (company_id) {
      query += ' AND op.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(company_id));
    }

    if (productoId) {
      query += ' AND op.Producto_Id = @Producto_Id';
      request.input('Producto_Id', sql.Int, Number(productoId));
    }

    query += ' ORDER BY op.FechaFin DESC, op.OP_Id DESC';

    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('inventario.listRecepcionPendiente error', err);
    res.status(500).json({ msg: 'Error al obtener lista de recepción', error: err.message });
  }
};

// POST /api/inventario/recepcion/registrar - registrar entrada manual desde pendientes
exports.registrarRecepcionPendiente = async (req, res) => {
  const { OP_Id, Cantidad, Almacen_Id, Observaciones } = req.body || {};
  const usuario = req.user?.Username || req.user?.UserName || req.user?.email || 'sistema';

  if (!OP_Id || !Cantidad) {
    return res.status(400).json({ msg: 'Campos requeridos: OP_Id, Cantidad' });
  }

  const cantidadNum = Number(Cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ msg: 'Cantidad debe ser mayor a 0' });
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const opRequest = new sql.Request(transaction);
    opRequest.input('OP_Id', sql.Int, Number(OP_Id));
    const opResult = await opRequest.query(`
      SELECT TOP 1 OP_Id,
                   NumeroOP,
                   Producto_Id,
                   Company_Id,
                   Estado,
                   CantidadPlanificada,
                   CantidadProducida
      FROM ERP_OP_PRODUCCION
      WHERE OP_Id = @OP_Id;
    `);

    const op = opResult.recordset?.[0];
    if (!op) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'No se encontró la orden de producción' });
    }

    if (op.Estado !== 'TERMINADA') {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Solo se puede recibir en almacén una OP terminada' });
    }

    const result = await registrarRecepcionProduccion({
      op,
      cantidadRecibida: cantidadNum,
      almacenId: Almacen_Id ? Number(Almacen_Id) : null,
      observaciones: Observaciones,
      usuario,
      transaction,
    });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit('inventario:recepcion-produccion', {
        OP_Id: Number(OP_Id),
        Producto_Id: op.Producto_Id,
        Company_Id: op.Company_Id,
        Estatus: 'RECIBIDA',
      });
      io.emit('inventario:changed', {
        Producto_Id: op.Producto_Id,
        Company_Id: op.Company_Id,
        Almacen_Id: result?.almacenId || null,
        TipoMovimiento: 'ENTRADA',
      });
    }

    return res.status(201).json({
      msg: 'Entrada a almacén registrada correctamente',
      data: result,
    });
  } catch (err) {
    console.error('inventario.registrarRecepcionPendiente error', err);
    try { await transaction.rollback(); } catch (_) {}
    return res.status(500).json({ msg: err.message || 'Error al registrar recepción de almacén', error: err.message });
  }
};

// POST /api/inventario/recepcion/cancelar - cancelar entrada por producto incompleto
exports.cancelarRecepcionPendiente = async (req, res) => {
  const { OP_Id, MotivoCancelacion } = req.body || {};
  const usuario = req.user?.Username || req.user?.UserName || req.user?.email || 'sistema';

  if (!OP_Id) {
    return res.status(400).json({ msg: 'Campo requerido: OP_Id' });
  }

  if (!String(MotivoCancelacion || '').trim()) {
    return res.status(400).json({ msg: 'Debes indicar el motivo de cancelación' });
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const opRequest = new sql.Request(transaction);
    opRequest.input('OP_Id', sql.Int, Number(OP_Id));
    const opResult = await opRequest.query(`
      SELECT TOP 1 OP_Id,
                   NumeroOP,
                   Producto_Id,
                   Company_Id,
                   Estado,
                   CantidadPlanificada,
                   CantidadProducida
      FROM ERP_OP_PRODUCCION
      WHERE OP_Id = @OP_Id;
    `);

    const op = opResult.recordset?.[0];
    if (!op) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'No se encontró la orden de producción' });
    }

    if (op.Estado !== 'TERMINADA') {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Solo se puede cancelar la entrada de una OP terminada' });
    }

    const result = await cancelarRecepcionProduccion({
      op,
      motivoCancelacion: MotivoCancelacion,
      usuario,
      transaction,
    });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit('inventario:recepcion-produccion', {
        OP_Id: Number(OP_Id),
        Producto_Id: op.Producto_Id,
        Company_Id: op.Company_Id,
        Estatus: 'CANCELADA',
      });
    }

    return res.status(201).json({
      msg: 'Entrada a almacén cancelada por producto incompleto',
      data: result,
    });
  } catch (err) {
    console.error('inventario.cancelarRecepcionPendiente error', err);
    try { await transaction.rollback(); } catch (_) {}
    return res.status(500).json({ msg: err.message || 'Error al cancelar recepción pendiente', error: err.message });
  }
};

// PUT /api/inventario/consolidado - actualizar cantidades operativas manuales y resincronizar almacén
exports.updateEstadoConsolidado = async (req, res) => {
  const { Producto_Id, Company_Id, Almacen_Id, CantidadEnMaquina, CantidadEntregadaProduccion, CantidadEnProceso } = req.body || {};

  if (!Producto_Id || !Company_Id) {
    return res.status(400).json({ msg: 'Campos requeridos: Producto_Id, Company_Id' });
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const almacen = await resolveAlmacenProducto({
      productoId: Number(Producto_Id),
      companyId: Number(Company_Id),
      almacenId: Almacen_Id ? Number(Almacen_Id) : null,
      transaction,
      allowFallback: false,
    });

    const estado = await syncInventarioEstado({
      productoId: Number(Producto_Id),
      companyId: Number(Company_Id),
      almacenId: almacen?.Almacen_Id || null,
      cantidades: {
        CantidadEnMaquina,
        CantidadEntregadaProduccion,
        CantidadEnProceso,
      },
      transaction,
    });

    await transaction.commit();
    res.json({ msg: 'Inventario consolidado actualizado', data: estado });
  } catch (err) {
    console.error('inventario.updateEstadoConsolidado error', err);
    try { await transaction.rollback(); } catch (_) { }
    res.status(500).json({ msg: 'Error al actualizar inventario consolidado', error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/inventario/mp - Inventario de Materias Primas (ERP_STOCK_MP)
   Query params: search, company_id, almacen_id
───────────────────────────────────────────────────────────────────────────── */
exports.listStockMP = async (req, res) => {
  try {
    const { search = '', company_id, almacen_id } = req.query || {};

    let query = `
      SELECT
        mp.MateriaPrima_Id,
        mp.Codigo           AS SKU,
        mp.Nombre           AS NombreProducto,
        mp.Tipo,
        mp.UnidadCompra,
        mp.CostoUnitario,
        mp.Moneda,
        a.Almacen_Id,
        a.Nombre            AS NombreAlmacen,
        a.Codigo            AS CodigoAlmacen,
        a.Company_Id,
        c.NameCompany,
        ISNULL(s.Cantidad,    0) AS CantidadAlmacen,
        ISNULL(s.Stock_Minimo,0) AS StockMinimo
      FROM ERP_MATERIA_PRIMA mp
      CROSS JOIN ERP_ALMACENES a
      LEFT JOIN ERP_COMPANY c   ON c.Company_Id = a.Company_Id
      LEFT JOIN ERP_STOCK_MP s  ON s.MateriaPrima_Id = mp.MateriaPrima_Id AND s.Almacen_Id = a.Almacen_Id
      WHERE mp.Activo = 1
        AND (s.Cantidad > 0 OR s.StockMP_Id IS NOT NULL)
    `;

    const request = pool.request();

    if (!req.isAdmin) {
      if (req.userCompanies?.length) {
        const placeholders = req.userCompanies.map((_, i) => `@uc${i}`).join(',');
        req.userCompanies.forEach((cid, i) => request.input(`uc${i}`, sql.Int, cid));
        query += ` AND a.Company_Id IN (${placeholders})`;
      } else {
        return res.json({ data: [] });
      }
    } else if (company_id) {
      query += ' AND a.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(company_id));
    }

    if (almacen_id) {
      query += ' AND a.Almacen_Id = @Almacen_Id';
      request.input('Almacen_Id', sql.Int, Number(almacen_id));
    }

    if (search) {
      query += ' AND (mp.Codigo LIKE @Search OR mp.Nombre LIKE @Search)';
      request.input('Search', sql.NVarChar(200), `%${search}%`);
    }

    query += ' ORDER BY c.NameCompany, a.Nombre, mp.Nombre';

    const result = await request.query(query);
    return res.json({ data: result.recordset || [] });
  } catch (err) {
    console.error('inventario.listStockMP error', err);
    return res.status(500).json({ msg: 'Error al obtener inventario de materia prima', error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PUT /api/inventario/mp - Editar Stock_Minimo de una MP en un almacén
   Body: { MateriaPrima_Id, Almacen_Id, StockMinimo }
───────────────────────────────────────────────────────────────────────────── */
exports.updateStockMP = async (req, res) => {
  const { MateriaPrima_Id, Almacen_Id, StockMinimo } = req.body || {};
  if (!MateriaPrima_Id || !Almacen_Id) {
    return res.status(400).json({ msg: 'Se requiere MateriaPrima_Id y Almacen_Id' });
  }
  try {
    await pool.request()
      .input('MateriaPrima_Id', sql.Int,           Number(MateriaPrima_Id))
      .input('Almacen_Id',      sql.Int,           Number(Almacen_Id))
      .input('StockMinimo',     sql.Decimal(18,4), Number(StockMinimo) || 0)
      .query(`
        IF EXISTS (SELECT 1 FROM ERP_STOCK_MP WHERE MateriaPrima_Id = @MateriaPrima_Id AND Almacen_Id = @Almacen_Id)
          UPDATE ERP_STOCK_MP
            SET Stock_Minimo = @StockMinimo
          WHERE MateriaPrima_Id = @MateriaPrima_Id AND Almacen_Id = @Almacen_Id
        ELSE
          INSERT INTO ERP_STOCK_MP (MateriaPrima_Id, Almacen_Id, Cantidad, Stock_Minimo)
          VALUES (@MateriaPrima_Id, @Almacen_Id, 0, @StockMinimo)
      `);
    return res.json({ msg: 'Stock mínimo actualizado' });
  } catch (err) {
    console.error('inventario.updateStockMP error', err);
    return res.status(500).json({ msg: 'Error al actualizar stock MP', error: err.message });
  }
};

// POST /api/inventario/movimientos - registrar movimiento en kardex y actualizar stock
exports.registrarMovimiento = async (req, res) => {
  const { Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, Referencia, Company_Id, ClasificacionInventario } = req.body || {};
  const usuario = req.user?.Username || req.user?.UserName || req.user?.email || "sistema";

  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[MOVIMIENTO][${transactionId}] ===== INICIO REGISTRO ===== `);
  console.log(`[MOVIMIENTO][${transactionId}] Request body completo:`, JSON.stringify(req.body, null, 2));
  console.log(`[MOVIMIENTO][${transactionId}] Datos:`, { Producto_Id, Almacen_Id, TipoMovimiento, Cantidad, Referencia, Company_Id, ClasificacionInventario });

  if (!Producto_Id || !TipoMovimiento || !Cantidad) {
    console.log(`[MOVIMIENTO][${transactionId}] ERROR: Campos faltantes`);
    return res.status(400).json({ msg: "Campos requeridos: Producto_Id, TipoMovimiento, Cantidad" });
  }

  const cantidadNum = Number(Cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    console.log(`[MOVIMIENTO][${transactionId}] ERROR: Cantidad inválida:`, cantidadNum);
    return res.status(400).json({ msg: "Cantidad debe ser mayor a 0" });
  }

  const tipo = String(TipoMovimiento).toUpperCase();
  console.log(`[MOVIMIENTO][${transactionId}] Tipo de movimiento:`, tipo);

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    console.log(`[MOVIMIENTO][${transactionId}] Transacción iniciada`);

    const almacen = await resolveAlmacenProducto({
      productoId: Number(Producto_Id),
      companyId: Company_Id ? Number(Company_Id) : null,
      almacenId: Almacen_Id ? Number(Almacen_Id) : null,
      transaction,
      allowFallback: true,
    });

    if (!almacen?.Almacen_Id) {
      await transaction.rollback();
      return res.status(400).json({ msg: "No se pudo resolver el almacén para el movimiento" });
    }

    const companyIdResolved = Number(Company_Id || almacen.Company_Id || 0) || null;
    const almacenIdResolved = Number(almacen.Almacen_Id);

    if (ClasificacionInventario && companyIdResolved) {
      await upsertProductoInventarioConfig(Number(Producto_Id), {
        Company_Id: companyIdResolved,
        Almacen_Id: almacenIdResolved,
        ClasificacionInventario,
      }, usuario, transaction);
    }

    const referenciaFinal = Referencia || transactionId;
    console.log(`[MOVIMIENTO][${transactionId}] Referencia:`, referenciaFinal);

    const { cantidad: stockActualAntes } = await getCurrentStock(Producto_Id, almacenIdResolved, transaction);
    console.log(`[MOVIMIENTO][${transactionId}] Stock ANTES del movimiento:`, stockActualAntes);

    let stockNuevo = stockActualAntes;

    if (["ENTRADA", "AJUSTE+", "AJUSTE_POSITIVO", "TRANSFERENCIA_IN"].includes(tipo)) {
      stockNuevo = stockActualAntes + cantidadNum;
      console.log(`[MOVIMIENTO][${transactionId}] Tipo ENTRADA - Sumando:`, cantidadNum);
    } else if (["SALIDA", "AJUSTE-", "AJUSTE_NEGATIVO", "TRANSFERENCIA_OUT"].includes(tipo)) {
      stockNuevo = stockActualAntes - cantidadNum;
      console.log(`[MOVIMIENTO][${transactionId}] Tipo SALIDA - Restando:`, cantidadNum);
      if (stockNuevo < 0) {
        await transaction.rollback();
        console.log(`[MOVIMIENTO][${transactionId}] ERROR: Stock negativo`);
        return res.status(400).json({ msg: "El movimiento dejaría stock negativo" });
      }
    } else {
      await transaction.rollback();
      console.log(`[MOVIMIENTO][${transactionId}] ERROR: Tipo de movimiento no soportado:`, tipo);
      return res.status(400).json({ msg: "TipoMovimiento no soportado" });
    }

    console.log(`[MOVIMIENTO][${transactionId}] Stock NUEVO calculado:`, stockNuevo);
    console.log(`[MOVIMIENTO][${transactionId}] Diferencia:`, stockNuevo - stockActualAntes);

    const duplicateCheck = await transaction.request()
      .input('Referencia', sql.VarChar, referenciaFinal)
      .input('Producto_Id', sql.Int, Producto_Id)
      .input('Almacen_Id', sql.Int, almacenIdResolved)
      .query(`
        SELECT COUNT(*) as Count FROM ERP_KARDEX 
        WHERE Referencia = @Referencia 
          AND Producto_Id = @Producto_Id 
          AND Almacen_Id = @Almacen_Id
      `);

    if (duplicateCheck.recordset[0].Count > 0) {
      await transaction.rollback();
      console.log(`[MOVIMIENTO][${transactionId}] ERROR: Movimiento duplicado detectado!`);
      return res.status(400).json({ msg: "Movimiento duplicado detectado" });
    }

    const upsertRequest = new sql.Request(transaction);
    upsertRequest
      .input("Producto_Id", sql.Int, Producto_Id)
      .input("Almacen_Id", sql.Int, almacenIdResolved)
      .input("Cantidad", sql.Decimal(18, 2), stockNuevo);

    console.log(`[MOVIMIENTO][${transactionId}] Ejecutando UPSERT en ERP_STOCK...`);
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

    console.log(`[MOVIMIENTO][${transactionId}] Stock actualizado en BD a:`, stockNuevo);

    const kardexRequest = new sql.Request(transaction);
    kardexRequest
      .input("Producto_Id", sql.Int, Producto_Id)
      .input("Almacen_Id", sql.Int, almacenIdResolved)
      .input("TipoMovimiento", sql.VarChar, tipo)
      .input("Cantidad", sql.Decimal(18, 2), cantidadNum)
      .input("Stock_Anterior", sql.Decimal(18, 2), stockActualAntes)
      .input("Stock_Actual", sql.Decimal(18, 2), stockNuevo)
      .input("Referencia", sql.VarChar, referenciaFinal)
      .input("Usuario", sql.VarChar, usuario);

    console.log(`[MOVIMIENTO][${transactionId}] Insertando en KARDEX...`);
    await kardexRequest.query(`
      INSERT INTO ERP_KARDEX (
        Producto_Id,
        Almacen_Id,
        TipoMovimiento,
        Cantidad,
        Stock_Anterior,
        Stock_Actual,
        Referencia,
        Usuario,
        FechaMovimiento
      ) VALUES (
        @Producto_Id,
        @Almacen_Id,
        @TipoMovimiento,
        @Cantidad,
        @Stock_Anterior,
        @Stock_Actual,
        @Referencia,
        @Usuario,
        GETDATE()
      );
    `);

    if (companyIdResolved) {
      await syncInventarioEstado({
        productoId: Number(Producto_Id),
        companyId: companyIdResolved,
        almacenId: almacenIdResolved,
        transaction,
      });
    }

    console.log(`[MOVIMIENTO][${transactionId}] Kardex registrado`);
    console.log(`[MOVIMIENTO][${transactionId}] NOTA: Trigger deshabilitado - actualización manual de stock`);

    await transaction.commit();
    console.log(`[MOVIMIENTO][${transactionId}] Transacción COMMIT exitoso`);
    console.log(`[MOVIMIENTO][${transactionId}] ===== FIN REGISTRO ===== `);

    const io = req.app.get('io');
    if (io) {
      io.emit('inventario:changed', {
        Producto_Id,
        Almacen_Id: almacenIdResolved,
        TipoMovimiento: tipo,
        Stock_Actual: stockNuevo,
        Company_Id: companyIdResolved,
      });
    }

    res.status(201).json({
      msg: "Movimiento registrado",
      transactionId,
      Producto_Id,
      Company_Id: companyIdResolved,
      Almacen_Id: almacenIdResolved,
      ClasificacionInventario: ClasificacionInventario ? normalizeClasificacionInventario(ClasificacionInventario) : undefined,
      TipoMovimiento: tipo,
      Cantidad: cantidadNum,
      Stock_Anterior: stockActualAntes,
      Stock_Actual: stockNuevo
    });
  } catch (err) {
    console.error(`[MOVIMIENTO][${transactionId}] ERROR EN TRANSACCIÓN:`, err);
    console.error(`[MOVIMIENTO][${transactionId}] Stack:`, err.stack);
    try { await transaction.rollback(); console.log(`[MOVIMIENTO][${transactionId}] Rollback ejecutado`); } catch (_) { }
    res.status(500).json({ msg: "Error al registrar movimiento", error: err.message });
  }
};

// GET /api/inventario/kardex - historial de movimientos
exports.listKardex = async (req, res) => {
  try {
    const { productoId, almacenId, desde, hasta } = req.query || {};

    let query = `
      SELECT k.[Kardex_Id],
             k.[Producto_Id],
             p.SKU,
             p.Nombre,
             k.[Almacen_Id],
             a.Nombre AS AlmacenNombre,
             k.[TipoMovimiento],
             k.[Cantidad],
             k.[Stock_Anterior],
             k.[Stock_Actual],
             k.[Referencia],
             k.[Usuario],
             k.[FechaMovimiento]
      FROM ERP_KARDEX k
      JOIN ERP_PRODUCTOS p ON p.Producto_Id = k.Producto_Id
      JOIN ERP_ALMACENES a ON a.Almacen_Id = k.Almacen_Id
      WHERE 1 = 1`;

    const request = pool.request();

    if (productoId) {
      query += " AND k.Producto_Id = @Producto_Id";
      request.input("Producto_Id", sql.Int, Number(productoId));
    }

    if (almacenId) {
      query += " AND k.Almacen_Id = @Almacen_Id";
      request.input("Almacen_Id", sql.Int, Number(almacenId));
    }

    if (desde) {
      query += " AND k.FechaMovimiento >= @Desde";
      request.input("Desde", sql.DateTime, new Date(desde));
    }

    if (hasta) {
      query += " AND k.FechaMovimiento <= @Hasta";
      request.input("Hasta", sql.DateTime, new Date(hasta));
    }

    query += " ORDER BY k.FechaMovimiento DESC, k.Kardex_Id DESC";

    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (err) {
    console.error("inventario.listKardex error", err);
    res.status(500).json({ msg: "Error al obtener kardex" });
  }
};

// POST /api/inventario/transferencias - transferir stock entre almacenes
exports.transferir = async (req, res) => {
  const { Almacen_Origen_Id, Almacen_Destino_Id, Usuario, Referencia, Detalles } = req.body || {};

  if (!Almacen_Origen_Id || !Almacen_Destino_Id || !Array.isArray(Detalles) || Detalles.length === 0) {
    return res.status(400).json({ msg: "Campos requeridos: Almacen_Origen_Id, Almacen_Destino_Id, Detalles[]" });
  }

  const usuario = Usuario || req.user?.Username || req.user?.UserName || req.user?.email || "sistema";
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const warehouseInfo = await new sql.Request(transaction)
      .input('Almacen_Origen_Id', sql.Int, Almacen_Origen_Id)
      .input('Almacen_Destino_Id', sql.Int, Almacen_Destino_Id)
      .query(`
        SELECT Almacen_Id, Company_Id
        FROM ERP_ALMACENES
        WHERE Almacen_Id IN (@Almacen_Origen_Id, @Almacen_Destino_Id);
      `);

    const originWarehouse = warehouseInfo.recordset.find((item) => Number(item.Almacen_Id) === Number(Almacen_Origen_Id));
    const destinationWarehouse = warehouseInfo.recordset.find((item) => Number(item.Almacen_Id) === Number(Almacen_Destino_Id));

    if (!originWarehouse || !destinationWarehouse) {
      throw new Error('No se encontraron los almacenes de origen y destino');
    }

    for (const d of Detalles) {
      const productoId = Number(d.Producto_Id);
      const cantidad = Number(d.Cantidad);

      if (!productoId || isNaN(cantidad) || cantidad <= 0) {
        throw new Error("Detalle de transferencia inválido");
      }

      const { cantidad: stockOrigenAntes } = await getCurrentStock(productoId, Almacen_Origen_Id, transaction);
      const stockOrigenNuevo = stockOrigenAntes - cantidad;
      if (stockOrigenNuevo < 0) {
        throw new Error(`Stock insuficiente en almacén origen para producto ${productoId}`);
      }

      let reqStock = new sql.Request(transaction);
      reqStock
        .input("Producto_Id", sql.Int, productoId)
        .input("Almacen_Id", sql.Int, Almacen_Origen_Id)
        .input("Cantidad", sql.Decimal(18, 2), stockOrigenNuevo);

      await reqStock.query(`
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

      let reqKardex = new sql.Request(transaction);
      reqKardex
        .input("Producto_Id", sql.Int, productoId)
        .input("Almacen_Id", sql.Int, Almacen_Origen_Id)
        .input("TipoMovimiento", sql.VarChar, "TRANSFERENCIA_OUT")
        .input("Cantidad", sql.Decimal(18, 2), cantidad)
        .input("Stock_Anterior", sql.Decimal(18, 2), stockOrigenAntes)
        .input("Stock_Actual", sql.Decimal(18, 2), stockOrigenNuevo)
        .input("Referencia", sql.VarChar, Referencia || null)
        .input("Usuario", sql.VarChar, usuario);

      await reqKardex.query(`
        INSERT INTO ERP_KARDEX (
          Producto_Id,
          Almacen_Id,
          TipoMovimiento,
          Cantidad,
          Stock_Anterior,
          Stock_Actual,
          Referencia,
          Usuario,
          FechaMovimiento
        ) VALUES (
          @Producto_Id,
          @Almacen_Id,
          @TipoMovimiento,
          @Cantidad,
          @Stock_Anterior,
          @Stock_Actual,
          @Referencia,
          @Usuario,
          GETDATE()
        );
      `);

      const { cantidad: stockDestinoAntes } = await getCurrentStock(productoId, Almacen_Destino_Id, transaction);
      const stockDestinoNuevo = stockDestinoAntes + cantidad;

      reqStock = new sql.Request(transaction);
      reqStock
        .input("Producto_Id", sql.Int, productoId)
        .input("Almacen_Id", sql.Int, Almacen_Destino_Id)
        .input("Cantidad", sql.Decimal(18, 2), stockDestinoNuevo);

      await reqStock.query(`
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

      reqKardex = new sql.Request(transaction);
      reqKardex
        .input("Producto_Id", sql.Int, productoId)
        .input("Almacen_Id", sql.Int, Almacen_Destino_Id)
        .input("TipoMovimiento", sql.VarChar, "TRANSFERENCIA_IN")
        .input("Cantidad", sql.Decimal(18, 2), cantidad)
        .input("Stock_Anterior", sql.Decimal(18, 2), stockDestinoAntes)
        .input("Stock_Actual", sql.Decimal(18, 2), stockDestinoNuevo)
        .input("Referencia", sql.VarChar, Referencia || null)
        .input("Usuario", sql.VarChar, usuario);

      await reqKardex.query(`
        INSERT INTO ERP_KARDEX (
          Producto_Id,
          Almacen_Id,
          TipoMovimiento,
          Cantidad,
          Stock_Anterior,
          Stock_Actual,
          Referencia,
          Usuario,
          FechaMovimiento
        ) VALUES (
          @Producto_Id,
          @Almacen_Id,
          @TipoMovimiento,
          @Cantidad,
          @Stock_Anterior,
          @Stock_Actual,
          @Referencia,
          @Usuario,
          GETDATE()
        );
      `);

      await syncInventarioEstado({
        productoId,
        companyId: Number(originWarehouse.Company_Id),
        almacenId: Number(Almacen_Origen_Id),
        transaction,
      });

      await syncInventarioEstado({
        productoId,
        companyId: Number(destinationWarehouse.Company_Id),
        almacenId: Number(Almacen_Destino_Id),
        transaction,
      });
    }

    await transaction.commit();

    res.status(201).json({ msg: "Transferencia realizada" });
  } catch (err) {
    console.error("inventario.transferir error", err);
    try { await transaction.rollback(); } catch (_) { }
    res.status(500).json({ msg: "Error al realizar transferencia", error: err.message });
  }
};
