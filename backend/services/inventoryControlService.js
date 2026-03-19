const { pool, sql } = require('../config/db');

const CLASIFICACIONES_INVENTARIO = ['MATERIA_PRIMA', 'PRODUCTO_TERMINADO', 'PRODUCTO_REVENTA'];

function createRequest(transaction) {
  return transaction ? new sql.Request(transaction) : pool.request();
}

function normalizeClasificacionInventario(value, fallback = 'PRODUCTO_TERMINADO') {
  const normalized = String(value || fallback || 'PRODUCTO_TERMINADO').trim().toUpperCase();
  return CLASIFICACIONES_INVENTARIO.includes(normalized) ? normalized : fallback;
}

async function listProductoInventarioConfig(productoId, transaction) {
  const request = createRequest(transaction);
  request.input('Producto_Id', sql.Int, productoId);

  const result = await request.query(`
    SELECT cfg.ProductoAlmacenConfig_Id,
           cfg.Producto_Id,
           cfg.Company_Id,
           cfg.Almacen_Id,
           a.Nombre AS AlmacenNombre,
           a.Codigo AS AlmacenCodigo,
           cfg.ClasificacionInventario,
           cfg.Activo,
           cfg.CreatedAt,
           cfg.UpdatedAt,
           cfg.UpdatedBy,
           c.NameCompany
    FROM ERP_PRODUCTO_ALMACEN_CONFIG cfg
    INNER JOIN ERP_COMPANY c ON c.Company_Id = cfg.Company_Id
    LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = cfg.Almacen_Id
    WHERE cfg.Producto_Id = @Producto_Id
    ORDER BY cfg.Company_Id;
  `);

  return result.recordset || [];
}

async function getProductoInventarioConfig(productoId, companyId, transaction) {
  const request = createRequest(transaction);
  request.input('Producto_Id', sql.Int, productoId);

  let query = `
    SELECT TOP 1 cfg.ProductoAlmacenConfig_Id,
           cfg.Producto_Id,
           cfg.Company_Id,
           cfg.Almacen_Id,
           a.Nombre AS AlmacenNombre,
           a.Codigo AS AlmacenCodigo,
           cfg.ClasificacionInventario,
           cfg.Activo,
           cfg.CreatedAt,
           cfg.UpdatedAt,
           cfg.UpdatedBy,
           c.NameCompany
    FROM ERP_PRODUCTO_ALMACEN_CONFIG cfg
    INNER JOIN ERP_COMPANY c ON c.Company_Id = cfg.Company_Id
    LEFT JOIN ERP_ALMACENES a ON a.Almacen_Id = cfg.Almacen_Id
    WHERE cfg.Producto_Id = @Producto_Id
      AND cfg.Activo = 1`;

  if (companyId) {
    query += ' AND cfg.Company_Id = @Company_Id';
    request.input('Company_Id', sql.Int, companyId);
  }

  query += ' ORDER BY CASE WHEN cfg.Almacen_Id IS NULL THEN 1 ELSE 0 END, cfg.Company_Id';

  const result = await request.query(query);
  return result.recordset?.[0] || null;
}

async function ensureProductoCompanyRelacion(productoId, companyId, transaction) {
  const request = createRequest(transaction);
  request.input('Producto_Id', sql.Int, productoId);
  request.input('Company_Id', sql.Int, companyId);

  const result = await request.query(`
    SELECT COUNT(*) AS Total
    FROM ERP_PRODUCTO_EMPRESA
    WHERE Producto_Id = @Producto_Id AND Company_Id = @Company_Id;
  `);

  return Number(result.recordset?.[0]?.Total || 0) > 0;
}

async function replaceProductoInventarioConfig(productoId, configs, updatedBy, transaction) {
  const normalizedConfigs = Array.isArray(configs)
    ? configs
      .filter((config) => config && config.Company_Id)
      .map((config) => ({
        Company_Id: Number(config.Company_Id),
        Almacen_Id: config.Almacen_Id ? Number(config.Almacen_Id) : null,
        ClasificacionInventario: normalizeClasificacionInventario(config.ClasificacionInventario),
        Activo: config.Activo === false ? 0 : 1,
      }))
      .filter((config) => config.Company_Id > 0)
    : [];

  const deleteRequest = createRequest(transaction);
  deleteRequest.input('Producto_Id', sql.Int, productoId);
  await deleteRequest.query('DELETE FROM ERP_PRODUCTO_ALMACEN_CONFIG WHERE Producto_Id = @Producto_Id;');

  for (const config of normalizedConfigs) {
    const relationExists = await ensureProductoCompanyRelacion(productoId, config.Company_Id, transaction);
    if (!relationExists) {
      throw new Error(`El producto ${productoId} no está asignado a la empresa ${config.Company_Id}`);
    }

    const insertRequest = createRequest(transaction);
    insertRequest
      .input('Producto_Id', sql.Int, productoId)
      .input('Company_Id', sql.Int, config.Company_Id)
      .input('Almacen_Id', sql.Int, config.Almacen_Id)
      .input('ClasificacionInventario', sql.NVarChar(30), config.ClasificacionInventario)
      .input('Activo', sql.Bit, config.Activo)
      .input('UpdatedBy', sql.NVarChar(100), updatedBy || null);

    await insertRequest.query(`
      INSERT INTO ERP_PRODUCTO_ALMACEN_CONFIG (
        Producto_Id,
        Company_Id,
        Almacen_Id,
        ClasificacionInventario,
        Activo,
        UpdatedBy
      ) VALUES (
        @Producto_Id,
        @Company_Id,
        @Almacen_Id,
        @ClasificacionInventario,
        @Activo,
        @UpdatedBy
      );
    `);
  }

  return normalizedConfigs;
}

async function upsertProductoInventarioConfig(productoId, config, updatedBy, transaction) {
  if (!config?.Company_Id) {
    return null;
  }

  const normalizedConfig = {
    Company_Id: Number(config.Company_Id),
    Almacen_Id: config.Almacen_Id ? Number(config.Almacen_Id) : null,
    ClasificacionInventario: normalizeClasificacionInventario(config.ClasificacionInventario),
    Activo: config.Activo === false ? 0 : 1,
  };

  const relationExists = await ensureProductoCompanyRelacion(productoId, normalizedConfig.Company_Id, transaction);
  if (!relationExists) {
    throw new Error(`El producto ${productoId} no está asignado a la empresa ${normalizedConfig.Company_Id}`);
  }

  const request = createRequest(transaction);
  request
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, normalizedConfig.Company_Id)
    .input('Almacen_Id', sql.Int, normalizedConfig.Almacen_Id)
    .input('ClasificacionInventario', sql.NVarChar(30), normalizedConfig.ClasificacionInventario)
    .input('Activo', sql.Bit, normalizedConfig.Activo)
    .input('UpdatedBy', sql.NVarChar(100), updatedBy || null);

  await request.query(`
    IF EXISTS (
      SELECT 1
      FROM ERP_PRODUCTO_ALMACEN_CONFIG
      WHERE Producto_Id = @Producto_Id AND Company_Id = @Company_Id
    )
    BEGIN
      UPDATE ERP_PRODUCTO_ALMACEN_CONFIG
      SET Almacen_Id = @Almacen_Id,
          ClasificacionInventario = @ClasificacionInventario,
          Activo = @Activo,
          UpdatedAt = GETDATE(),
          UpdatedBy = @UpdatedBy
      WHERE Producto_Id = @Producto_Id AND Company_Id = @Company_Id;
    END
    ELSE
    BEGIN
      INSERT INTO ERP_PRODUCTO_ALMACEN_CONFIG (
        Producto_Id,
        Company_Id,
        Almacen_Id,
        ClasificacionInventario,
        Activo,
        UpdatedBy
      ) VALUES (
        @Producto_Id,
        @Company_Id,
        @Almacen_Id,
        @ClasificacionInventario,
        @Activo,
        @UpdatedBy
      );
    END
  `);

  return normalizedConfig;
}

async function resolveAlmacenProducto({ productoId, companyId, almacenId, transaction, allowFallback = true }) {
  if (almacenId) {
    const request = createRequest(transaction);
    request.input('Almacen_Id', sql.Int, almacenId);
    let query = `
      SELECT TOP 1 Almacen_Id, Company_Id, Nombre, Codigo, Activo
      FROM ERP_ALMACENES
      WHERE Almacen_Id = @Almacen_Id`;

    if (companyId) {
      query += ' AND Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, companyId);
    }

    const result = await request.query(query);
    const almacen = result.recordset?.[0] || null;
    if (!almacen) {
      throw new Error('El almacén indicado no existe o no pertenece a la empresa especificada');
    }
    return almacen;
  }

  if (productoId) {
    const config = await getProductoInventarioConfig(productoId, companyId, transaction);
    if (config?.Almacen_Id) {
      return {
        Almacen_Id: config.Almacen_Id,
        Company_Id: config.Company_Id,
        Nombre: config.AlmacenNombre,
        Codigo: config.AlmacenCodigo,
        Activo: config.Activo,
      };
    }
  }

  if (!allowFallback) {
    return null;
  }

  let resolvedCompanyId = companyId;
  if (!resolvedCompanyId && productoId) {
    const relationRequest = createRequest(transaction);
    relationRequest.input('Producto_Id', sql.Int, productoId);
    const relationResult = await relationRequest.query(`
      SELECT TOP 1 Company_Id
      FROM ERP_PRODUCTO_EMPRESA
      WHERE Producto_Id = @Producto_Id
      ORDER BY Company_Id;
    `);
    resolvedCompanyId = relationResult.recordset?.[0]?.Company_Id || null;
  }

  if (!resolvedCompanyId) {
    return null;
  }

  const fallbackRequest = createRequest(transaction);
  fallbackRequest.input('Company_Id', sql.Int, resolvedCompanyId);
  const fallbackResult = await fallbackRequest.query(`
    SELECT TOP 1 Almacen_Id, Company_Id, Nombre, Codigo, Activo
    FROM ERP_ALMACENES
    WHERE Company_Id = @Company_Id AND Activo = 1
    ORDER BY Almacen_Id;
  `);

  return fallbackResult.recordset?.[0] || null;
}

async function getCurrentStock(productoId, almacenId, transaction) {
  const request = createRequest(transaction);
  request.input('Producto_Id', sql.Int, productoId);
  request.input('Almacen_Id', sql.Int, almacenId);

  const result = await request.query(`
    SELECT Cantidad, Stock_Minimo
    FROM ERP_STOCK
    WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id;
  `);

  const row = result.recordset?.[0];
  return {
    cantidad: Number(row?.Cantidad || 0),
    stockMinimo: Number(row?.Stock_Minimo || 0),
  };
}

async function upsertStock(productoId, almacenId, cantidad, transaction) {
  const request = createRequest(transaction);
  request
    .input('Producto_Id', sql.Int, productoId)
    .input('Almacen_Id', sql.Int, almacenId)
    .input('Cantidad', sql.Decimal(18, 2), cantidad);

  await request.query(`
    IF EXISTS (SELECT 1 FROM ERP_STOCK WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id)
    BEGIN
      UPDATE ERP_STOCK
      SET Cantidad = @Cantidad
      WHERE Producto_Id = @Producto_Id AND Almacen_Id = @Almacen_Id;
    END
    ELSE
    BEGIN
      INSERT INTO ERP_STOCK (Producto_Id, Almacen_Id, Cantidad, Stock_Minimo)
      VALUES (@Producto_Id, @Almacen_Id, @Cantidad, 0);
    END
  `);
}

async function insertKardexMovimiento({ productoId, almacenId, tipoMovimiento, cantidad, stockAnterior, stockActual, referencia, usuario, transaction }) {
  const request = createRequest(transaction);
  request
    .input('Producto_Id', sql.Int, productoId)
    .input('Almacen_Id', sql.Int, almacenId)
    .input('TipoMovimiento', sql.VarChar, tipoMovimiento)
    .input('Cantidad', sql.Decimal(18, 2), cantidad)
    .input('Stock_Anterior', sql.Decimal(18, 2), stockAnterior)
    .input('Stock_Actual', sql.Decimal(18, 2), stockActual)
    .input('Referencia', sql.VarChar, referencia || null)
    .input('Usuario', sql.VarChar, usuario || 'sistema');

  await request.query(`
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
}

async function syncInventarioEstado({ productoId, companyId, almacenId = null, cantidades = {}, transaction }) {
  const stockRequest = createRequest(transaction);
  stockRequest
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, companyId);

  let stockQuery = `
    SELECT ISNULL(SUM(s.Cantidad), 0) AS CantidadAlmacen
    FROM ERP_STOCK s
    INNER JOIN ERP_ALMACENES a ON a.Almacen_Id = s.Almacen_Id
    WHERE s.Producto_Id = @Producto_Id
      AND a.Company_Id = @Company_Id`;

  if (almacenId) {
    stockQuery += ' AND s.Almacen_Id = @Almacen_Id';
    stockRequest.input('Almacen_Id', sql.Int, almacenId);
  }

  const stockResult = await stockRequest.query(stockQuery);
  const cantidadAlmacen = Number(stockResult.recordset?.[0]?.CantidadAlmacen || 0);

  const stateRequest = createRequest(transaction);
  stateRequest
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, companyId);

  let stateQuery = `
    SELECT TOP 1 InventarioEstado_Id,
           CantidadEnMaquina,
           CantidadEntregadaProduccion,
           CantidadEnProceso
    FROM ERP_INVENTARIO_ESTADO_PRODUCTO
    WHERE Producto_Id = @Producto_Id
      AND Company_Id = @Company_Id`;

  if (almacenId) {
    stateQuery += ' AND Almacen_Id = @Almacen_Id';
    stateRequest.input('Almacen_Id', sql.Int, almacenId);
  } else {
    stateQuery += ' AND Almacen_Id IS NULL';
  }

  stateQuery += ' ORDER BY FechaCorte DESC, InventarioEstado_Id DESC';

  const stateResult = await stateRequest.query(stateQuery);
  const currentState = stateResult.recordset?.[0] || null;
  const values = {
    CantidadAlmacen: cantidadAlmacen,
    CantidadEnMaquina: Number(cantidades.CantidadEnMaquina ?? currentState?.CantidadEnMaquina ?? 0),
    CantidadEntregadaProduccion: Number(cantidades.CantidadEntregadaProduccion ?? currentState?.CantidadEntregadaProduccion ?? 0),
    CantidadEnProceso: Number(cantidades.CantidadEnProceso ?? currentState?.CantidadEnProceso ?? 0),
  };

  const upsertRequest = createRequest(transaction);
  upsertRequest
    .input('Producto_Id', sql.Int, productoId)
    .input('Company_Id', sql.Int, companyId)
    .input('Almacen_Id', sql.Int, almacenId)
    .input('CantidadAlmacen', sql.Decimal(18, 2), values.CantidadAlmacen)
    .input('CantidadEnMaquina', sql.Decimal(18, 2), values.CantidadEnMaquina)
    .input('CantidadEntregadaProduccion', sql.Decimal(18, 2), values.CantidadEntregadaProduccion)
    .input('CantidadEnProceso', sql.Decimal(18, 2), values.CantidadEnProceso);

  if (currentState?.InventarioEstado_Id) {
    upsertRequest.input('InventarioEstado_Id', sql.Int, currentState.InventarioEstado_Id);
    await upsertRequest.query(`
      UPDATE ERP_INVENTARIO_ESTADO_PRODUCTO
      SET CantidadAlmacen = @CantidadAlmacen,
          CantidadEnMaquina = @CantidadEnMaquina,
          CantidadEntregadaProduccion = @CantidadEntregadaProduccion,
          CantidadEnProceso = @CantidadEnProceso,
          FechaCorte = GETDATE()
      WHERE InventarioEstado_Id = @InventarioEstado_Id;
    `);
  } else {
    await upsertRequest.query(`
      INSERT INTO ERP_INVENTARIO_ESTADO_PRODUCTO (
        Company_Id,
        Producto_Id,
        Almacen_Id,
        CantidadAlmacen,
        CantidadEnMaquina,
        CantidadEntregadaProduccion,
        CantidadEnProceso,
        FechaCorte
      ) VALUES (
        @Company_Id,
        @Producto_Id,
        @Almacen_Id,
        @CantidadAlmacen,
        @CantidadEnMaquina,
        @CantidadEntregadaProduccion,
        @CantidadEnProceso,
        GETDATE()
      );
    `);
  }

  return values;
}

async function registrarRecepcionProduccion({ op, cantidadRecibida, almacenId, observaciones, usuario, transaction }) {
  const cantidad = Number(cantidadRecibida || 0);
  if (cantidad <= 0) {
    return null;
  }

  const existingRequest = createRequest(transaction);
  existingRequest.input('OP_Id', sql.Int, op.OP_Id);
  const existingResult = await existingRequest.query(`
    SELECT TOP 1 RecepcionPT_Id,
                 Estatus
    FROM ERP_RECEPCION_PRODUCTO_TERMINADO
    WHERE OP_Id = @OP_Id;
  `);

  if (existingResult.recordset?.length) {
    const existing = existingResult.recordset[0];
    if (existing.Estatus === 'CANCELADA') {
      throw new Error('Esta orden fue cancelada para entrada a almacén y ya no puede recibirse');
    }
    throw new Error('Esta orden ya tiene una recepción de producto terminado registrada');
  }

  const productConfig = await getProductoInventarioConfig(op.Producto_Id, op.Company_Id, transaction);
  const clasificacion = normalizeClasificacionInventario(productConfig?.ClasificacionInventario, 'PRODUCTO_TERMINADO');
  const almacen = await resolveAlmacenProducto({
    productoId: op.Producto_Id,
    companyId: op.Company_Id,
    almacenId,
    transaction,
    allowFallback: true,
  });

  if (!almacen?.Almacen_Id) {
    throw new Error('No se encontró un almacén activo para recibir el producto terminado');
  }

  const referencia = `${op.NumeroOP}-RECEPCION`;
  const stockAnterior = (await getCurrentStock(op.Producto_Id, almacen.Almacen_Id, transaction)).cantidad;
  const stockActual = stockAnterior + cantidad;

  await upsertStock(op.Producto_Id, almacen.Almacen_Id, stockActual, transaction);
  await insertKardexMovimiento({
    productoId: op.Producto_Id,
    almacenId: almacen.Almacen_Id,
    tipoMovimiento: 'ENTRADA',
    cantidad,
    stockAnterior,
    stockActual,
    referencia,
    usuario,
    transaction,
  });

  const receiptRequest = createRequest(transaction);
  receiptRequest
    .input('OP_Id', sql.Int, op.OP_Id)
    .input('Producto_Id', sql.Int, op.Producto_Id)
    .input('Company_Id', sql.Int, op.Company_Id)
    .input('Almacen_Id', sql.Int, almacen.Almacen_Id)
    .input('CantidadRecibida', sql.Decimal(18, 2), cantidad)
    .input('ClasificacionInventario', sql.NVarChar(30), clasificacion)
    .input('Estatus', sql.NVarChar(20), 'RECIBIDA')
    .input('Referencia', sql.NVarChar(100), referencia)
    .input('Observaciones', sql.NVarChar(1000), observaciones || null)
    .input('CreatedBy', sql.NVarChar(100), usuario || 'sistema');

  await receiptRequest.query(`
    INSERT INTO ERP_RECEPCION_PRODUCTO_TERMINADO (
      OP_Id,
      Producto_Id,
      Company_Id,
      Almacen_Id,
      CantidadRecibida,
      ClasificacionInventario,
      Estatus,
      Referencia,
      Observaciones,
      CreatedBy
    ) VALUES (
      @OP_Id,
      @Producto_Id,
      @Company_Id,
      @Almacen_Id,
      @CantidadRecibida,
      @ClasificacionInventario,
      @Estatus,
      @Referencia,
      @Observaciones,
      @CreatedBy
    );
  `);

  const estado = await syncInventarioEstado({
    productoId: op.Producto_Id,
    companyId: op.Company_Id,
    almacenId: almacen.Almacen_Id,
    cantidades: {
      CantidadEnMaquina: 0,
      CantidadEnProceso: 0,
    },
    transaction,
  });

  return {
    almacenId: almacen.Almacen_Id,
    almacenNombre: almacen.Nombre,
    clasificacion,
    referencia,
    stockAnterior,
    stockActual,
    estado,
  };
}

async function cancelarRecepcionProduccion({ op, motivoCancelacion, usuario, transaction }) {
  const motivo = String(motivoCancelacion || '').trim();
  if (!motivo) {
    throw new Error('Debes indicar el motivo de cancelación');
  }

  const existingRequest = createRequest(transaction);
  existingRequest.input('OP_Id', sql.Int, op.OP_Id);
  const existingResult = await existingRequest.query(`
    SELECT TOP 1 RecepcionPT_Id,
                 Estatus
    FROM ERP_RECEPCION_PRODUCTO_TERMINADO
    WHERE OP_Id = @OP_Id;
  `);

  if (existingResult.recordset?.length) {
    const existing = existingResult.recordset[0];
    if (existing.Estatus === 'CANCELADA') {
      throw new Error('Esta orden ya fue cancelada para entrada a almacén');
    }
    throw new Error('Esta orden ya fue recibida en almacén y no puede cancelarse');
  }

  const productConfig = await getProductoInventarioConfig(op.Producto_Id, op.Company_Id, transaction);
  const clasificacion = normalizeClasificacionInventario(productConfig?.ClasificacionInventario, 'PRODUCTO_TERMINADO');
  const referencia = `${op.NumeroOP}-RECEPCION-CANCELADA`;

  const cancelRequest = createRequest(transaction);
  cancelRequest
    .input('OP_Id', sql.Int, op.OP_Id)
    .input('Producto_Id', sql.Int, op.Producto_Id)
    .input('Company_Id', sql.Int, op.Company_Id)
    .input('Almacen_Id', sql.Int, null)
    .input('CantidadRecibida', sql.Decimal(18, 2), 0)
    .input('ClasificacionInventario', sql.NVarChar(30), clasificacion)
    .input('Estatus', sql.NVarChar(20), 'CANCELADA')
    .input('Referencia', sql.NVarChar(100), referencia)
    .input('Observaciones', sql.NVarChar(1000), motivo)
    .input('MotivoCancelacion', sql.NVarChar(1000), motivo)
    .input('FechaCancelacion', sql.DateTime, new Date())
    .input('CanceladoBy', sql.NVarChar(100), usuario || 'sistema')
    .input('CreatedBy', sql.NVarChar(100), usuario || 'sistema');

  await cancelRequest.query(`
    INSERT INTO ERP_RECEPCION_PRODUCTO_TERMINADO (
      OP_Id,
      Producto_Id,
      Company_Id,
      Almacen_Id,
      CantidadRecibida,
      ClasificacionInventario,
      Estatus,
      Referencia,
      Observaciones,
      MotivoCancelacion,
      FechaCancelacion,
      CanceladoBy,
      CreatedBy
    ) VALUES (
      @OP_Id,
      @Producto_Id,
      @Company_Id,
      @Almacen_Id,
      @CantidadRecibida,
      @ClasificacionInventario,
      @Estatus,
      @Referencia,
      @Observaciones,
      @MotivoCancelacion,
      @FechaCancelacion,
      @CanceladoBy,
      @CreatedBy
    );
  `);

  return {
    referencia,
    clasificacion,
    estatus: 'CANCELADA',
    motivoCancelacion: motivo,
  };
}

module.exports = {
  CLASIFICACIONES_INVENTARIO,
  normalizeClasificacionInventario,
  listProductoInventarioConfig,
  getProductoInventarioConfig,
  replaceProductoInventarioConfig,
  upsertProductoInventarioConfig,
  resolveAlmacenProducto,
  getCurrentStock,
  upsertStock,
  insertKardexMovimiento,
  syncInventarioEstado,
  registrarRecepcionProduccion,
  cancelarRecepcionProduccion,
};
