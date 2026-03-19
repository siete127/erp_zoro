const { pool, sql, poolPromise } = require('../config/db');
const {
  resolveAlmacenProducto,
  registrarRecepcionProduccion,
  syncInventarioEstado,
  upsertStock,
  insertKardexMovimiento,
  getCurrentStock: getStockForProduct,
} = require('../services/inventoryControlService');

// GET /api/produccion/ordenes - tablero básico de OP
exports.listOrdenesProduccion = async (req, res) => {
  try {
    const { Company_Id, Estado } = req.query || {};

    let query = `
      SELECT op.OP_Id, op.NumeroOP, op.Company_Id, op.CompanySolicitante_Id, 
             op.Venta_Id, op.ID_COTIZACION,
             op.Producto_Id, p.SKU, p.Nombre AS ProductoNombre,
             op.CantidadPlanificada, op.CantidadProducida, op.MermaUnidades,
             op.Estado, op.Prioridad, op.FechaCreacion, op.FechaEntregaCompromiso,
             cp.NameCompany AS EmpresaProductora,
             cs.NameCompany AS EmpresaSolicitante
      FROM ERP_OP_PRODUCCION op
      LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
      LEFT JOIN ERP_COMPANY cp ON op.Company_Id = cp.Company_Id
      LEFT JOIN ERP_COMPANY cs ON op.CompanySolicitante_Id = cs.Company_Id
      WHERE 1 = 1`;

    const request = pool.request();

    if (Company_Id) {
      query += ' AND op.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Number(Company_Id));
    }
    if (Estado) {
      query += ' AND op.Estado = @Estado';
      request.input('Estado', sql.NVarChar(50), Estado);
    }

    query += ' ORDER BY op.Prioridad DESC, op.FechaCreacion DESC';

    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar órdenes de producción:', error);
    return res.status(500).json({ success: false, message: 'Error al listar órdenes de producción', error: error.message });
  }
};

// GET /api/produccion/ordenes/:id
exports.getOrdenProduccionDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const request = pool.request();
    request.input('OP_Id', sql.Int, id);

    const opResult = await request.query(`
            SELECT op.*, p.SKU, p.Nombre AS ProductoNombre, p.Precio AS PrecioVentaProducto,
             cp.NameCompany AS EmpresaProductora,
             cs.NameCompany AS EmpresaSolicitante
      FROM ERP_OP_PRODUCCION op
      LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
      LEFT JOIN ERP_COMPANY cp ON op.Company_Id = cp.Company_Id
      LEFT JOIN ERP_COMPANY cs ON op.CompanySolicitante_Id = cs.Company_Id
      WHERE op.OP_Id = @OP_Id;
    `);

    if (!opResult.recordset || opResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Orden de producción no encontrada' });
    }

    const op = opResult.recordset[0];

    // Obtener BOM
    let bomResult = null;
    if (op.BOM_Id) {
      bomResult = await pool.request()
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query('SELECT * FROM ERP_BOM WHERE BOM_Id = @BOM_Id');
    }

    // Obtener materiales del BOM
    let materialesResult = [];
    if (op.BOM_Id) {
      materialesResult = await pool.request()
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query(`
             SELECT bm.*, mp.Codigo AS MateriaCodigo, mp.Nombre AS MateriaNombre,
               mp.CostoUnitario, mp.Moneda
          FROM ERP_BOM_MATERIALES bm
          LEFT JOIN ERP_MATERIA_PRIMA mp ON bm.MateriaPrima_Id = mp.MateriaPrima_Id
          WHERE bm.BOM_Id = @BOM_Id
        `);
    }

    // Obtener operaciones del BOM
    let operacionesResult = [];
    if (op.BOM_Id) {
      operacionesResult = await pool.request()
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query('SELECT * FROM ERP_BOM_OPERACIONES WHERE BOM_Id = @BOM_Id');
    }

    // Obtener consumos reales
    const consumoResult = await request.query(`
      SELECT c.*, mp.Codigo AS MateriaCodigo, mp.Nombre AS MateriaNombre,
             mp.CostoUnitario, mp.Moneda
      FROM ERP_OP_CONSUMO_MATERIAL c
      INNER JOIN ERP_MATERIA_PRIMA mp ON c.MateriaPrima_Id = mp.MateriaPrima_Id
      WHERE c.OP_Id = @OP_Id
      ORDER BY c.FechaRegistro;
    `);

    // Obtener resultado
    const resultadoResult = await request.query(`
      SELECT *
      FROM ERP_OP_RESULTADO
      WHERE OP_Id = @OP_Id;
    `);

    return res.json({
      success: true,
      data: {
        orden: op,
        bom: bomResult?.recordset?.[0] || null,
        materiales: materialesResult.recordset || [],
        operaciones: operacionesResult.recordset || [],
        consumos: consumoResult.recordset || [],
        resultado: resultadoResult.recordset[0] || null
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle de OP:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener detalle de OP', error: error.message });
  }
};

// GET /api/produccion/ordenes/:id/preview-cierre - resumen teórico antes de cerrar
exports.getPreviewCierreOrdenProduccion = async (req, res) => {
  try {
    const { id } = req.params;

    const opResult = await pool.request()
      .input('OP_Id', sql.Int, id)
      .query(`
        SELECT op.OP_Id, op.NumeroOP, op.CantidadPlanificada, op.BOM_Id,
               p.Nombre AS ProductoNombre, p.Precio AS PrecioVentaProducto
        FROM ERP_OP_PRODUCCION op
        LEFT JOIN ERP_PRODUCTOS p ON op.Producto_Id = p.Producto_Id
        WHERE op.OP_Id = @OP_Id
      `);

    if (!opResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Orden de producción no encontrada' });
    }

    const op = opResult.recordset[0];
    const cantidadPlanificada = Number(op.CantidadPlanificada || 0);

    let materiales = [];
    let operaciones = [];

    if (op.BOM_Id) {
      const matResult = await pool.request()
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query(`
          SELECT bm.MateriaPrima_Id, bm.CantidadTeorica, bm.MermaPct,
                 mp.Nombre AS MateriaNombre, mp.CostoUnitario, mp.Moneda
          FROM ERP_BOM_MATERIALES bm
          LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = bm.MateriaPrima_Id
          WHERE bm.BOM_Id = @BOM_Id
        `);
      materiales = matResult.recordset || [];

      const opResultBOM = await pool.request()
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query(`
          SELECT TipoCosto, CostoPorUnidad
          FROM ERP_BOM_OPERACIONES
          WHERE BOM_Id = @BOM_Id
        `);
      operaciones = opResultBOM.recordset || [];
    }

    let costoMaterialTeorico = 0;
    const materialesResumen = materiales.map((m) => {
      const cantidadBase = Number(m.CantidadTeorica || 0) * cantidadPlanificada;
      const factorMerma = 1 + (Number(m.MermaPct || 0) / 100);
      const cantidadConMerma = cantidadBase * factorMerma;
      const costoUnitario = Number(m.CostoUnitario || 0);
      const costoTotal = cantidadConMerma * costoUnitario;
      costoMaterialTeorico += costoTotal;

      return {
        materiaPrimaId: m.MateriaPrima_Id,
        materiaNombre: m.MateriaNombre,
        cantidadBase,
        cantidadConMerma,
        costoUnitario,
        moneda: m.Moneda || 'MXN',
        costoTotal
      };
    });

    let costoOperacionTeorico = 0;
    const operacionesResumen = operaciones.map((o) => {
      const costoPorUnidad = Number(o.CostoPorUnidad || 0);
      const costoTotal = costoPorUnidad * cantidadPlanificada;
      costoOperacionTeorico += costoTotal;
      return {
        tipoCosto: o.TipoCosto,
        costoPorUnidad,
        costoTotal
      };
    });

    const costoTotalTeorico = costoMaterialTeorico + costoOperacionTeorico;
    const ingresoTeorico = Number(op.PrecioVentaProducto || 0) * cantidadPlanificada;
    const margenTeorico = ingresoTeorico - costoTotalTeorico;

    return res.json({
      success: true,
      data: {
        op,
        resumen: {
          cantidadPlanificada,
          costoMaterialTeorico,
          costoOperacionTeorico,
          costoTotalTeorico,
          ingresoTeorico,
          margenTeorico
        },
        materiales: materialesResumen,
        operaciones: operacionesResumen
      }
    });
  } catch (error) {
    console.error('Error al obtener preview de cierre OP:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener preview de cierre', error: error.message });
  }
};

// POST /api/produccion/ordenes - crear OP manualmente (siempre se asigna a PTC como productora)
exports.createOrdenProduccion = async (req, res) => {
  try {
    const {
      Company_Id,
      Venta_Id,
      ID_COTIZACION,
      Producto_Id,
      CantidadPlanificada,
      Prioridad = 'NORMAL',
      FechaEntregaCompromiso
    } = req.body || {};

    if (!Company_Id || !Producto_Id || !CantidadPlanificada) {
      return res.status(400).json({ success: false, message: 'Company_Id, Producto_Id y CantidadPlanificada son requeridos' });
    }

    const poolConn = await poolPromise;

    // ── Validación: Bloquear duplicados SOLO para prioridades NORMAL/BAJA ──────────────
    // Las órdenes de ALTA prioridad SIEMPRE se permiten (sin restricción de duplicados)
    if (Prioridad !== 'ALTA') {
      const duplicadaCheck = await poolConn.request()
        .input('Producto_Id', sql.Int, Producto_Id)
        .input('CantidadPlanificada', sql.Decimal(18, 2), CantidadPlanificada)
        .query(`
          SELECT TOP 1 OP_Id, NumeroOP, Estado, FechaCreacion
          FROM ERP_OP_PRODUCCION
          WHERE Producto_Id = @Producto_Id
            AND CantidadPlanificada = @CantidadPlanificada
            AND Estado IN ('EN_ESPERA', 'EN_PROCESO')
            AND DATEDIFF(HOUR, FechaCreacion, GETDATE()) < 1
          ORDER BY FechaCreacion DESC
        `);

      if (duplicadaCheck.recordset.length > 0) {
        const opExistente = duplicadaCheck.recordset[0];
        return res.status(409).json({
          success: false,
          message: `Ya existe una orden de producción duplicada: ${opExistente.NumeroOP} (Estado: ${opExistente.Estado}). Se creó hace menos de 1 hora. Las órdenes de ALTA prioridad no tienen esta restricción.`,
          existingOP: opExistente
        });
      }
    }

    // Obtener Company_Id de PTC (empresa productora)
    const ptcRes = await poolConn.request().query("SELECT TOP 1 Company_Id FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'");
    const ptcCompanyId = ptcRes.recordset.length > 0 ? ptcRes.recordset[0].Company_Id : Company_Id;

    const request = poolConn.request();

    request
      .input('PTC_Company_Id', sql.Int, ptcCompanyId)
      .input('Solicitante_Company_Id', sql.Int, Company_Id)
      .input('Venta_Id', sql.Int, Venta_Id || null)
      .input('ID_COTIZACION', sql.Int, ID_COTIZACION || null)
      .input('Producto_Id', sql.Int, Producto_Id)
      .input('CantidadPlanificada', sql.Decimal(18, 2), CantidadPlanificada)
      .input('Prioridad', sql.NVarChar(20), Prioridad)
      .input('FechaEntregaCompromiso', sql.DateTime, FechaEntregaCompromiso || null);

    const result = await request.query(`
      INSERT INTO ERP_OP_PRODUCCION (
        NumeroOP, Company_Id, CompanySolicitante_Id, Venta_Id, ID_COTIZACION,
        Producto_Id, BOM_Id, CantidadPlanificada,
        Estado, Prioridad, FechaCreacion, FechaEntregaCompromiso
      )
      OUTPUT INSERTED.*
      SELECT
        'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' + RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
        @PTC_Company_Id, @Solicitante_Company_Id, @Venta_Id, @ID_COTIZACION,
        @Producto_Id,
        (SELECT TOP 1 BOM_Id FROM ERP_BOM WHERE Producto_Id = @Producto_Id AND Vigente = 1 ORDER BY CASE WHEN Company_Id = @PTC_Company_Id THEN 0 ELSE 1 END, Version DESC),
        @CantidadPlanificada,
        'EN_ESPERA', @Prioridad, GETDATE(), @FechaEntregaCompromiso;
    `);

    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error al crear orden de producción:', error);
    return res.status(500).json({ success: false, message: 'Error al crear orden de producción', error: error.message });
  }
};

// PUT /api/produccion/ordenes/:id/estado - actualizar estado simple
exports.updateEstadoOrdenProduccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { Estado } = req.body || {};

    if (!Estado) {
      return res.status(400).json({ success: false, message: 'Estado es requerido' });
    }

    const pool = await poolPromise;

    // ── Validación al iniciar producción (EN_PROCESO) ──────────────
    if (Estado === 'EN_PROCESO') {
      const opCheck = await pool.request()
        .input('OP_Id', sql.Int, id)
        .query('SELECT OP_Id, BOM_Id, Producto_Id, Company_Id, Prioridad FROM ERP_OP_PRODUCCION WHERE OP_Id = @OP_Id');

      if (!opCheck.recordset || opCheck.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Orden de producción no encontrada' });
      }

      const op = opCheck.recordset[0];
      let bomIdToUse = op.BOM_Id;

      // 1) Verificar que tenga BOM asignado
      if (!bomIdToUse) {
        const bomLookup = await pool.request()
          .input('Producto_Id', sql.Int, op.Producto_Id)
          .input('Company_Id', sql.Int, op.Company_Id)
          .query(`
            SELECT TOP 1 BOM_Id
            FROM ERP_BOM
            WHERE Producto_Id = @Producto_Id
              AND Vigente = 1
            ORDER BY CASE WHEN Company_Id = @Company_Id THEN 0 ELSE 1 END, Version DESC
          `);

        if (bomLookup.recordset.length > 0) {
          bomIdToUse = bomLookup.recordset[0].BOM_Id;

          await pool.request()
            .input('OP_Id', sql.Int, id)
            .input('BOM_Id', sql.Int, bomIdToUse)
            .query('UPDATE ERP_OP_PRODUCCION SET BOM_Id = @BOM_Id WHERE OP_Id = @OP_Id');
        } else {
          const bomAny = await pool.request()
            .input('Producto_Id', sql.Int, op.Producto_Id)
            .query('SELECT COUNT(*) AS total FROM ERP_BOM WHERE Producto_Id = @Producto_Id');

          const totalBom = Number(bomAny.recordset[0]?.total || 0);
          if (totalBom > 0) {
            return res.status(400).json({
              success: false,
              message: 'No se puede iniciar la producción: el producto tiene recetas, pero ninguna está marcada como vigente. Marca una receta como vigente en Recetas de Producción.'
            });
          }

          return res.status(400).json({
            success: false,
            message: 'No se puede iniciar la producción: este producto no tiene una receta de producción (BOM) asignada. Crea una receta primero en Recetas de Producción.'
          });
        }
      }

      // 2) Verificar que el BOM tenga materiales (materia prima) - SOLO para prioridad NO ALTA
      // Las órdenes ALTA pueden iniciarse sin materiales si es necesario
      if (op.Prioridad !== 'ALTA') {
        const materialesCheck = await pool.request()
          .input('BOM_Id', sql.Int, bomIdToUse)
          .query('SELECT COUNT(*) AS total FROM ERP_BOM_MATERIALES WHERE BOM_Id = @BOM_Id');

        const totalMateriales = materialesCheck.recordset[0]?.total || 0;

        if (totalMateriales === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se puede iniciar la producción: la receta (BOM) no tiene materias primas definidas. Agrega materiales a la receta primero.'
          });
        }
      }
    }
    // ── Fin validación ─────────────────────────────────────────────

    const request = pool.request();
    request
      .input('OP_Id', sql.Int, id)
      .input('Estado', sql.NVarChar(50), Estado);

    // Registrar FechaInicio si cambia a EN_PROCESO
    // Registrar FechaFin si cambia a TERMINADA
    let queryExtra = '';
    if (Estado === 'EN_PROCESO') {
      queryExtra = ', FechaInicio = CASE WHEN FechaInicio IS NULL THEN GETDATE() ELSE FechaInicio END';
    } else if (Estado === 'TERMINADA') {
      queryExtra = ', FechaFin = CASE WHEN FechaFin IS NULL THEN GETDATE() ELSE FechaFin END';
    }

    await request.query(`
      UPDATE ERP_OP_PRODUCCION
      SET Estado = @Estado${queryExtra}
      WHERE OP_Id = @OP_Id;
    `);

    return res.json({ success: true, data: { OP_Id: id, Estado } });
  } catch (error) {
    console.error('Error al actualizar estado de OP:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar estado de OP', error: error.message });
  }
};

// POST /api/produccion/ordenes/:id/confirm - confirmación de factibilidad por PTC
exports.confirmOrdenProduccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { canProduce, Comentarios } = req.body || {};

    if (typeof canProduce !== 'boolean') {
      return res.status(400).json({ success: false, message: 'canProduce (boolean) es requerido' });
    }

    // Buscar la compañía PTC en la tabla de empresas
    const poolConn = await poolPromise;
    const companyReq = poolConn.request();
    const companyResult = await companyReq.query(`
      SELECT TOP 1 Company_Id FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'
    `);

    if (!companyResult.recordset || companyResult.recordset.length === 0) {
      return res.status(500).json({ success: false, message: 'No se encontró la compañía PTC en la base de datos' });
    }

    const ptcCompanyId = companyResult.recordset[0].Company_Id;

    // Verificar que el usuario autenticado pertenece a PTC
    const userCompanies = req.userCompanies || [];
    if (!userCompanies.includes(ptcCompanyId) && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Solo usuarios de PTC pueden confirmar la factibilidad' });
    }

    const newEstado = canProduce ? 'APROBADO_PTC' : 'RECHAZADO_PTC';

    // Agregar nota de confirmación en el campo Notas y actualizar estado
    const notaTexto = `PTC Confirmación: ${canProduce ? 'APROBADO' : 'RECHAZADO'} por ${req.user?.Username || req.user?.Email || 'usuario'} - ${new Date().toISOString()}${Comentarios ? ' - ' + Comentarios : ''}`;

    const reqUpd = poolConn.request();
    reqUpd
      .input('OP_Id', sql.Int, id)
      .input('Estado', sql.NVarChar(50), newEstado)
      .input('Nota', sql.NVarChar(1000), notaTexto);

    await reqUpd.query(`
      UPDATE ERP_OP_PRODUCCION
      SET Estado = @Estado,
          Notas = ISNULL(Notas, '') + CHAR(13) + CHAR(10) + @Nota
      WHERE OP_Id = @OP_Id;
    `);

    const updated = await poolConn.request().input('OP_Id', sql.Int, id).query('SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = @OP_Id');

    return res.json({ success: true, data: updated.recordset[0] });
  } catch (error) {
    console.error('Error en confirmación de OP por PTC:', error);
    return res.status(500).json({ success: false, message: 'Error en confirmación de OP', error: error.message });
  }
};

// POST /api/produccion/ordenes/:id/cerrar - registrar consumos reales y resultado
exports.cerrarOrdenProduccionConConsumos = async (req, res) => {
  const { id } = req.params;
  const { consumos = [], PiezasBuenas, PiezasMerma = 0, Comentarios, OperadorCierre } = req.body || {};

  if (!PiezasBuenas && PiezasBuenas !== 0) {
    return res.status(400).json({ success: false, message: 'Debe indicar PiezasBuenas para cierre de la OP' });
  }

  let transaction;

  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    const reqOP = new sql.Request(transaction);
    reqOP.input('OP_Id', sql.Int, id);
    const opResult = await reqOP.query(`
      SELECT * FROM ERP_OP_PRODUCCION WHERE OP_Id = @OP_Id;
    `);

    if (!opResult.recordset || opResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Orden de producción no encontrada' });
    }

    const op = opResult.recordset[0];

    // Validar que la orden no esté ya cerrada
    if (op.Estado === 'CERRADA') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'La orden ya está cerrada' });
    }

    // Validar que la orden esté al menos en estado TERMINADA o EN_PROCESO
    if (op.Estado !== 'TERMINADA' && op.Estado !== 'EN_PROCESO') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `No se puede cerrar una orden en estado ${op.Estado}. La orden debe estar en estado TERMINADA o EN_PROCESO para poder cerrarla.` 
      });
    }

    // Si la OP tiene BOM, validar que haya al menos un consumo
    if (op.BOM_Id) {
      const matCountResult = await new sql.Request(transaction)
        .input('BOM_Id', sql.Int, op.BOM_Id)
        .query('SELECT COUNT(*) as Total FROM ERP_BOM_MATERIALES WHERE BOM_Id = @BOM_Id');
      const tieneMatBOM = matCountResult.recordset[0].Total > 0;

      if (tieneMatBOM && (!Array.isArray(consumos) || consumos.length === 0)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Debe registrar al menos un consumo de material (la OP tiene BOM con materiales)' });
      }
    }

    // Registrar consumos (puede ser vacío si no hay BOM/materiales)
    for (const c of consumos) {
      const materiaId = Number(c.MateriaPrima_Id);
      const cantTeorica = Number(c.CantidadTeorica || 0);
      const cantReal = Number(c.CantidadReal || 0);
      const unidad = c.UnidadConsumo || 'KG';

      const mermaCant = cantReal > cantTeorica ? cantReal - cantTeorica : 0;

      const reqCons = new sql.Request(transaction);
      reqCons
        .input('OP_Id', sql.Int, id)
        .input('MateriaPrima_Id', sql.Int, materiaId)
        .input('CantidadTeorica', sql.Decimal(18, 6), cantTeorica)
        .input('CantidadReal', sql.Decimal(18, 6), cantReal)
        .input('UnidadConsumo', sql.NVarChar(20), unidad)
        .input('MermaCantidad', sql.Decimal(18, 6), mermaCant)
        .input('RegistradoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);

      await reqCons.query(`
        INSERT INTO ERP_OP_CONSUMO_MATERIAL (
          OP_Id, MateriaPrima_Id, CantidadTeorica, CantidadReal,
          UnidadConsumo, MermaCantidad, FechaRegistro, RegistradoPor
        )
        VALUES (
          @OP_Id, @MateriaPrima_Id, @CantidadTeorica, @CantidadReal,
          @UnidadConsumo, @MermaCantidad, GETDATE(), @RegistradoPor
        );
      `);
    }

    // Validar que PiezasBuenas + PiezasMerma no exceda CantidadPlanificada
    const totalProducido = Number(PiezasBuenas) + Number(PiezasMerma);
    console.log(`[CIERRE OP ${id}] Piezas Buenas: ${PiezasBuenas}, Merma: ${PiezasMerma}, Total: ${totalProducido}, Planificado: ${op.CantidadPlanificada}`);

    if (totalProducido > Number(op.CantidadPlanificada || 0)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Límite de producción excedido. Total reportado (${totalProducido}) no puede superar lo planificado (${op.CantidadPlanificada}).`
      });
    }

    // Registrar resultado de la OP
    const reqRes = new sql.Request(transaction);
    reqRes
      .input('OP_Id', sql.Int, id)
      .input('PiezasBuenas', sql.Decimal(18, 2), PiezasBuenas)
      .input('PiezasMerma', sql.Decimal(18, 2), PiezasMerma)
      .input('Comentarios', sql.NVarChar(500), Comentarios || null)
      .input('OperadorCierre', sql.NVarChar(200), OperadorCierre || null);

    await reqRes.query(`
      INSERT INTO ERP_OP_RESULTADO (
        OP_Id, PiezasBuenas, PiezasMerma, Comentarios, OperadorCierre, FechaCierre
      )
      VALUES (
        @OP_Id, @PiezasBuenas, @PiezasMerma, @Comentarios, @OperadorCierre, GETDATE()
      );
    `);

    // Actualizar cabecera de OP
    const reqUpd = new sql.Request(transaction);
    reqUpd
      .input('OP_Id', sql.Int, id)
      .input('CantidadProducida', sql.Decimal(18, 2), PiezasBuenas)
      .input('MermaUnidades', sql.Decimal(18, 2), PiezasMerma);

    await reqUpd.query(`
      UPDATE ERP_OP_PRODUCCION
      SET CantidadProducida = @CantidadProducida,
          MermaUnidades = @MermaUnidades,
          Estado = 'CERRADA',
          FechaFin = GETDATE()
      WHERE OP_Id = @OP_Id;
    `);

    // ── REGISTRAR RECEPCIÓN EN ALMACÉN (piezas buenas únicamente) ──────────────
    // Usa el servicio centralizado que respeta configuración de almacén por producto/empresa,
    // registra kardex, actualiza ERP_STOCK y sincroniza ERP_INVENTARIO_ESTADO_PRODUCTO.
    const usuario = req.user?.Username || req.user?.email || 'sistema';
    const cantidadEntrada = Number(PiezasBuenas);

    let recepcionResult = null;
    let almacenProductoraId = null;

    if (cantidadEntrada > 0) {
      recepcionResult = await registrarRecepcionProduccion({
        op,
        cantidadRecibida: cantidadEntrada,
        almacenId: req.body.Almacen_Id || null,
        observaciones: Comentarios || null,
        usuario,
        transaction,
      });
      almacenProductoraId = recepcionResult?.almacenId || null;
      console.log(`[CIERRE OP ${id}] Recepción registrada en almacén ${almacenProductoraId}`);
    } else {
      console.log(`[CIERRE OP ${id}] Sin piezas buenas; no se registra entrada en almacén`);
    }

    // ── TRANSFERENCIA AUTOMÁTICA AL ALMACÉN DEL SOLICITANTE ──────────────
    let cantidadTransferida = 0;
    if (cantidadEntrada > 0 && op.CompanySolicitante_Id && op.CompanySolicitante_Id !== op.Company_Id) {
      const cantidadSolicitada = Number(op.CantidadPlanificada);
      const cantidadATransferir = Math.min(cantidadEntrada, cantidadSolicitada);

      if (cantidadATransferir > 0 && almacenProductoraId) {
        const almacenSolicitante = await resolveAlmacenProducto({
          productoId: op.Producto_Id,
          companyId: op.CompanySolicitante_Id,
          transaction,
          allowFallback: true,
        });

        if (almacenSolicitante?.Almacen_Id) {
          const almacenSolicitanteId = almacenSolicitante.Almacen_Id;
          const referenciaTransfer = `${op.NumeroOP}-TRANSFER`;

          console.log(`[CIERRE OP ${id}] Transfiriendo ${cantidadATransferir} → almacén solicitante ${almacenSolicitanteId} (${almacenSolicitante.Nombre})`);

          const stockPTCActual = (await getStockForProduct(op.Producto_Id, almacenProductoraId, transaction)).cantidad;
          const stockPTCDespues = stockPTCActual - cantidadATransferir;

          await upsertStock(op.Producto_Id, almacenProductoraId, stockPTCDespues, transaction);
          await insertKardexMovimiento({
            productoId: op.Producto_Id,
            almacenId: almacenProductoraId,
            tipoMovimiento: 'TRANSFERENCIA_OUT',
            cantidad: cantidadATransferir,
            stockAnterior: stockPTCActual,
            stockActual: stockPTCDespues,
            referencia: referenciaTransfer,
            usuario,
            transaction,
          });

          const stockSolicitanteAntes = (await getStockForProduct(op.Producto_Id, almacenSolicitanteId, transaction)).cantidad;
          const stockSolicitanteNuevo = stockSolicitanteAntes + cantidadATransferir;

          await upsertStock(op.Producto_Id, almacenSolicitanteId, stockSolicitanteNuevo, transaction);
          await insertKardexMovimiento({
            productoId: op.Producto_Id,
            almacenId: almacenSolicitanteId,
            tipoMovimiento: 'TRANSFERENCIA_IN',
            cantidad: cantidadATransferir,
            stockAnterior: stockSolicitanteAntes,
            stockActual: stockSolicitanteNuevo,
            referencia: referenciaTransfer,
            usuario,
            transaction,
          });

          // Sincronizar estado consolidado para empresa solicitante
          await syncInventarioEstado({
            productoId: op.Producto_Id,
            companyId: op.CompanySolicitante_Id,
            almacenId: almacenSolicitanteId,
            transaction,
          });

          cantidadTransferida = cantidadATransferir;
          const excedente = cantidadEntrada - cantidadATransferir;
          console.log(`[CIERRE OP ${id}] Transfer OK: ${cantidadATransferir} uds. Excedente PTC: ${excedente}`);
        } else {
          console.warn(`[CIERRE OP ${id}] Sin almacén activo para empresa solicitante ${op.CompanySolicitante_Id}`);
        }
      }
    }

    await transaction.commit();

    const cantidadSolicitada = Number(op.CantidadPlanificada);

    const io = req.app.get('io');
    if (io && cantidadTransferida > 0) {
      io.emit('inventario:transferencia-automatica', {
        OP_Id: id,
        NumeroOP: op.NumeroOP,
        Producto_Id: op.Producto_Id,
        CantidadTransferida: cantidadTransferida,
        CantidadSolicitada: cantidadSolicitada,
        CompanySolicitante_Id: op.CompanySolicitante_Id
      });
    }

    if (io && cantidadEntrada > 0) {
      io.emit('inventario:recepcion-produccion', {
        OP_Id: id,
        NumeroOP: op.NumeroOP,
        Producto_Id: op.Producto_Id,
        CantidadRecibida: cantidadEntrada,
        Almacen_Id: almacenProductoraId,
        Clasificacion: recepcionResult?.clasificacion,
      });
    }

    return res.json({
      success: true,
      data: {
        OP_Id: id,
        recepcion: recepcionResult ? {
          Almacen_Id: recepcionResult.almacenId,
          AlmacenNombre: recepcionResult.almacenNombre,
          CantidadRecibida: cantidadEntrada,
          ClasificacionInventario: recepcionResult.clasificacion,
          StockAnterior: recepcionResult.stockAnterior,
          StockActual: recepcionResult.stockActual,
        } : null,
        transferidoASolicitante: cantidadTransferida > 0,
        cantidadTransferida,
        cantidadSolicitada,
        excedente: cantidadEntrada - cantidadTransferida,
      }
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error('Error al cerrar orden de producción:', error);
    console.error('Stack trace completo:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error al cerrar orden de producción',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

