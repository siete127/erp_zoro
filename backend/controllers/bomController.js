const { pool, sql, poolPromise } = require('../config/db');

const getPTCRemaCompany = async (transaction = null) => {
  const request = transaction ? new sql.Request(transaction) : pool.request();

  const result = await request.query(`
    SELECT TOP 1 Company_Id, NameCompany
    FROM ERP_COMPANY
    WHERE UPPER(ISNULL(NameCompany, '')) LIKE '%PTC REMA%'
       OR (UPPER(ISNULL(NameCompany, '')) LIKE '%PTC%' AND UPPER(ISNULL(NameCompany, '')) LIKE '%REMA%')
    ORDER BY CASE
      WHEN UPPER(ISNULL(NameCompany, '')) = 'PTC REMA' THEN 0
      WHEN UPPER(ISNULL(NameCompany, '')) LIKE '%PTC REMA%' THEN 1
      WHEN UPPER(ISNULL(NameCompany, '')) LIKE '%PTC%' AND UPPER(ISNULL(NameCompany, '')) LIKE '%REMA%' THEN 2
      ELSE 3
    END,
    Company_Id
  `);

  return result.recordset[0] || null;
};

// GET /api/bom - Listar todos los BOM
exports.listBOM = async (req, res) => {
  try {
    const { Producto_Id, Vigente } = req.query;
    const ptcRemaCompany = await getPTCRemaCompany();

    if (!ptcRemaCompany) {
      return res.status(500).json({ success: false, message: 'No se encontró la empresa PTC REMA' });
    }
    
    let query = `
      SELECT b.*, p.Nombre AS ProductoNombre, p.SKU,
             (SELECT COUNT(*) FROM ERP_BOM_MATERIALES WHERE BOM_Id = b.BOM_Id) AS TotalMateriales,
             (SELECT COUNT(*) FROM ERP_BOM_OPERACIONES WHERE BOM_Id = b.BOM_Id) AS TotalOperaciones
      FROM ERP_BOM b
      LEFT JOIN ERP_PRODUCTOS p ON b.Producto_Id = p.Producto_Id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    query += ' AND b.Company_Id = @Company_Id';
    request.input('Company_Id', sql.Int, Number(ptcRemaCompany.Company_Id));
    
    if (Producto_Id) {
      query += ' AND b.Producto_Id = @Producto_Id';
      request.input('Producto_Id', sql.Int, Number(Producto_Id));
    }
    
    if (Vigente !== undefined) {
      query += ' AND b.Vigente = @Vigente';
      request.input('Vigente', sql.Bit, Vigente === '1' || Vigente === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY b.Vigente DESC, b.Version DESC, b.FechaCreacion DESC';
    
    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al listar BOM', error: error.message });
  }
};

// GET /api/bom/:id - Obtener detalle de BOM
exports.getBOMDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const request = pool.request();
    request.input('BOM_Id', sql.Int, id);
    
    // BOM principal
    const bomResult = await request.query(`
      SELECT b.*, p.Nombre AS ProductoNombre, p.SKU
      FROM ERP_BOM b
      LEFT JOIN ERP_PRODUCTOS p ON b.Producto_Id = p.Producto_Id
      WHERE b.BOM_Id = @BOM_Id
    `);
    
    if (!bomResult.recordset || bomResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'BOM no encontrado' });
    }
    
    // Materiales
    const materialesResult = await pool.request()
      .input('BOM_Id', sql.Int, id)
      .query(`
        SELECT bm.*, mp.Codigo AS MateriaCodigo, mp.Nombre AS MateriaNombre, 
               mp.UnidadConsumo AS UnidadMedida,
               mp.CostoUnitario,
               mp.Moneda
        FROM ERP_BOM_MATERIALES bm
        LEFT JOIN ERP_MATERIA_PRIMA mp ON bm.MateriaPrima_Id = mp.MateriaPrima_Id
        WHERE bm.BOM_Id = @BOM_Id
        ORDER BY bm.BOM_Material_Id
      `);
    
    // Operaciones
    const operacionesResult = await pool.request()
      .input('BOM_Id', sql.Int, id)
      .query(`
        SELECT * FROM ERP_BOM_OPERACIONES
        WHERE BOM_Id = @BOM_Id
        ORDER BY BOM_Operacion_Id
      `);
    
    return res.json({
      success: true,
      data: {
        bom: bomResult.recordset[0],
        materiales: materialesResult.recordset || [],
        operaciones: operacionesResult.recordset || []
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle de BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener detalle de BOM', error: error.message });
  }
};

// GET /api/bom/:id/variacion-costos - comparación de costo por materia prima (versión actual vs previa)
exports.getVariacionCostosBOM = async (req, res) => {
  try {
    const { id } = req.params;

    const bomActualResult = await pool.request()
      .input('BOM_Id', sql.Int, id)
      .query(`
        SELECT BOM_Id, Producto_Id, Version, CodigoBOM
        FROM ERP_BOM
        WHERE BOM_Id = @BOM_Id
      `);

    if (!bomActualResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'BOM no encontrado' });
    }

    const bomActual = bomActualResult.recordset[0];

    const bomPrevioResult = await pool.request()
      .input('Producto_Id', sql.Int, bomActual.Producto_Id)
      .input('VersionActual', sql.Int, bomActual.Version)
      .query(`
        SELECT TOP 1 BOM_Id, Version, CodigoBOM
        FROM ERP_BOM
        WHERE Producto_Id = @Producto_Id
          AND Version < @VersionActual
        ORDER BY Version DESC
      `);

    const bomPrevio = bomPrevioResult.recordset[0] || null;

    const matsActualResult = await pool.request()
      .input('BOM_Id', sql.Int, bomActual.BOM_Id)
      .query(`
        SELECT bm.MateriaPrima_Id, bm.CantidadTeorica, bm.MermaPct,
               mp.Codigo AS MateriaCodigo, mp.Nombre AS MateriaNombre,
               mp.CostoUnitario, mp.Moneda
        FROM ERP_BOM_MATERIALES bm
        LEFT JOIN ERP_MATERIA_PRIMA mp ON mp.MateriaPrima_Id = bm.MateriaPrima_Id
        WHERE bm.BOM_Id = @BOM_Id
      `);

    let matsPrevio = [];
    if (bomPrevio?.BOM_Id) {
      const matsPrevioResult = await pool.request()
        .input('BOM_Id', sql.Int, bomPrevio.BOM_Id)
        .query(`
          SELECT MateriaPrima_Id, CantidadTeorica, MermaPct
          FROM ERP_BOM_MATERIALES
          WHERE BOM_Id = @BOM_Id
        `);
      matsPrevio = matsPrevioResult.recordset || [];
    }

    const previoMap = new Map(matsPrevio.map((m) => [Number(m.MateriaPrima_Id), m]));

    let totalActual = 0;
    let totalPrevio = 0;

    const variaciones = (matsActualResult.recordset || []).map((m) => {
      const materiaPrimaId = Number(m.MateriaPrima_Id);
      const previo = previoMap.get(materiaPrimaId);

      const costoUnitario = Number(m.CostoUnitario || 0);
      const cantidadActual = Number(m.CantidadTeorica || 0);
      const mermaActual = Number(m.MermaPct || 0);
      const cantidadActualAjustada = cantidadActual * (1 + mermaActual / 100);
      const costoActual = cantidadActualAjustada * costoUnitario;

      const cantidadPrevia = Number(previo?.CantidadTeorica || 0);
      const mermaPrevia = Number(previo?.MermaPct || 0);
      const cantidadPreviaAjustada = cantidadPrevia * (1 + mermaPrevia / 100);
      const costoPrevio = cantidadPreviaAjustada * costoUnitario;

      const variacionAbs = costoActual - costoPrevio;
      const variacionPct = costoPrevio > 0 ? (variacionAbs / costoPrevio) * 100 : null;

      totalActual += costoActual;
      totalPrevio += costoPrevio;

      return {
        MateriaPrima_Id: materiaPrimaId,
        MateriaCodigo: m.MateriaCodigo,
        MateriaNombre: m.MateriaNombre,
        Moneda: m.Moneda || 'MXN',
        CostoUnitarioActual: costoUnitario,
        CantidadActual: cantidadActual,
        MermaActual: mermaActual,
        CostoActual: costoActual,
        CantidadPrevia: cantidadPrevia,
        MermaPrevia: mermaPrevia,
        CostoPrevio: costoPrevio,
        VariacionAbs: variacionAbs,
        VariacionPct: variacionPct
      };
    });

    const totalVariacion = totalActual - totalPrevio;
    const totalVariacionPct = totalPrevio > 0 ? (totalVariacion / totalPrevio) * 100 : null;

    return res.json({
      success: true,
      data: {
        bomActual,
        bomPrevio,
        resumen: {
          costoTotalActual: totalActual,
          costoTotalPrevio: totalPrevio,
          variacionAbs: totalVariacion,
          variacionPct: totalVariacionPct
        },
        variaciones
      }
    });
  } catch (error) {
    console.error('Error al obtener variación de costos BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener variación de costos', error: error.message });
  }
};

// DELETE /api/bom/operaciones/:operacionId - eliminar una operación específica
exports.deleteOperacionBOM = async (req, res) => {
  try {
    const { operacionId } = req.params;

    const opResult = await pool.request()
      .input('BOM_Operacion_Id', sql.Int, Number(operacionId))
      .query(`
        SELECT BOM_Operacion_Id, BOM_Id
        FROM ERP_BOM_OPERACIONES
        WHERE BOM_Operacion_Id = @BOM_Operacion_Id
      `);

    if (!opResult.recordset.length) {
      return res.status(404).json({ success: false, message: 'Operación no encontrada' });
    }

    const operacion = opResult.recordset[0];

    await pool.request()
      .input('BOM_Operacion_Id', sql.Int, operacion.BOM_Operacion_Id)
      .query('DELETE FROM ERP_BOM_OPERACIONES WHERE BOM_Operacion_Id = @BOM_Operacion_Id');

    return res.json({
      success: true,
      message: 'Operación eliminada de la receta',
      data: { BOM_Id: operacion.BOM_Id, BOM_Operacion_Id: operacion.BOM_Operacion_Id }
    });
  } catch (error) {
    console.error('Error al eliminar operación BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar operación', error: error.message });
  }
};

// POST /api/bom - Crear nuevo BOM
exports.createBOM = async (req, res) => {
  const { Producto_Id, CodigoBOM, Version, MermaPct, Descripcion, materiales, operaciones } = req.body;
  
  if (!Producto_Id) {
    return res.status(400).json({ success: false, message: 'Producto_Id es requerido' });
  }
  
  let transaction;
  
  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    const ptcRemaCompany = await getPTCRemaCompany(transaction);
    if (!ptcRemaCompany) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: 'No se encontró la empresa PTC REMA' });
    }
    
    // Crear BOM principal
    const reqBOM = new sql.Request(transaction);
    reqBOM
      .input('Company_Id', sql.Int, ptcRemaCompany.Company_Id)
      .input('Producto_Id', sql.Int, Producto_Id)
      .input('CodigoBOM', sql.NVarChar(50), CodigoBOM || `BOM-${Producto_Id}-${Date.now()}`)
      .input('Version', sql.Int, Version || 1)
      .input('Vigente', sql.Bit, 1)
      .input('MermaPct', sql.Decimal(5, 2), MermaPct || 0)
      .input('Descripcion', sql.NVarChar(500), Descripcion || null)
      .input('CreadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);
    
    const bomResult = await reqBOM.query(`
      INSERT INTO ERP_BOM (Company_Id, Producto_Id, CodigoBOM, Version, Vigente, MermaPct, Descripcion, CreadoPor, FechaCreacion)
      OUTPUT INSERTED.*
      VALUES (@Company_Id, @Producto_Id, @CodigoBOM, @Version, @Vigente, @MermaPct, @Descripcion, @CreadoPor, GETDATE())
    `);
    
    const bomId = bomResult.recordset[0].BOM_Id;
    
    // Insertar materiales
    if (materiales && Array.isArray(materiales)) {
      for (let i = 0; i < materiales.length; i++) {
        const m = materiales[i];
        const reqMat = new sql.Request(transaction);
        reqMat
          .input('BOM_Id', sql.Int, bomId)
          .input('MateriaPrima_Id', sql.Int, m.MateriaPrima_Id)
          .input('CantidadTeorica', sql.Decimal(18, 6), m.CantidadTeorica)
          .input('TipoComponente', sql.NVarChar(50), m.TipoComponente || 'Principal')
          .input('MermaPct', sql.Decimal(5, 2), m.MermaPct || 0)
          .input('Notas', sql.NVarChar(255), m.Notas || null);
        
        await reqMat.query(`
          INSERT INTO ERP_BOM_MATERIALES (BOM_Id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas)
          VALUES (@BOM_Id, @MateriaPrima_Id, @CantidadTeorica, @TipoComponente, @MermaPct, @Notas)
        `);
      }
    }
    
    // Insertar operaciones
    if (operaciones && Array.isArray(operaciones)) {
      for (let i = 0; i < operaciones.length; i++) {
        const o = operaciones[i];
        const reqOp = new sql.Request(transaction);
        reqOp
          .input('BOM_Id', sql.Int, bomId)
          .input('TipoCosto', sql.NVarChar(50), o.TipoCosto || 'MANO_OBRA')
          .input('CostoPorUnidad', sql.Decimal(18, 6), o.CostoPorUnidad || 0)
          .input('MinutosPorUnidad', sql.Decimal(18, 6), o.MinutosPorUnidad || 0)
          .input('CostoHoraReferencia', sql.Decimal(18, 6), o.CostoHoraReferencia || 0)
          .input('Notas', sql.NVarChar(255), o.NombreOperacion || null);
        
        await reqOp.query(`
          INSERT INTO ERP_BOM_OPERACIONES (BOM_Id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas)
          VALUES (@BOM_Id, @TipoCosto, @CostoPorUnidad, @MinutosPorUnidad, @CostoHoraReferencia, @Notas)
        `);
      }
    }
    
    await transaction.commit();
    
    return res.status(201).json({ success: true, data: { BOM_Id: bomId } });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Error al crear BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al crear BOM', error: error.message });
  }
};

// PUT /api/bom/:id - Actualizar BOM
exports.updateBOM = async (req, res) => {
  const { id } = req.params;
  const { Producto_Id, CodigoBOM, Version, MermaPct, Descripcion, Vigente, materiales, operaciones } = req.body;
  
  let transaction;
  
  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();

    const ptcRemaCompany = await getPTCRemaCompany(transaction);
    if (!ptcRemaCompany) {
      await transaction.rollback();
      return res.status(500).json({ success: false, message: 'No se encontró la empresa PTC REMA' });
    }
    
    // Actualizar BOM principal
    const reqBOM = new sql.Request(transaction);
    reqBOM
      .input('BOM_Id', sql.Int, id)
      .input('Company_Id', sql.Int, Number(ptcRemaCompany.Company_Id))
      .input('Producto_Id', sql.Int, Producto_Id ? Number(Producto_Id) : null)
      .input('CodigoBOM', sql.NVarChar(50), CodigoBOM)
      .input('Version', sql.Int, Version)
      .input('MermaPct', sql.Decimal(5, 2), MermaPct || 0)
      .input('Descripcion', sql.NVarChar(500), Descripcion || null)
      .input('Vigente', sql.Bit, Vigente !== undefined ? (Vigente ? 1 : 0) : 1);
    
    await reqBOM.query(`
      UPDATE ERP_BOM
        SET Company_Id = ISNULL(@Company_Id, Company_Id),
          Producto_Id = ISNULL(@Producto_Id, Producto_Id),
          CodigoBOM = @CodigoBOM,
          Version = @Version,
          MermaPct = @MermaPct,
          Descripcion = @Descripcion,
          Vigente = @Vigente
      WHERE BOM_Id = @BOM_Id
    `);
    
    // Actualizar materiales (eliminar y reinsertar)
    if (materiales && Array.isArray(materiales)) {
      await new sql.Request(transaction)
        .input('BOM_Id', sql.Int, id)
        .query('DELETE FROM ERP_BOM_MATERIALES WHERE BOM_Id = @BOM_Id');
      
      for (let i = 0; i < materiales.length; i++) {
        const m = materiales[i];
        const reqMat = new sql.Request(transaction);
        reqMat
          .input('BOM_Id', sql.Int, id)
          .input('MateriaPrima_Id', sql.Int, m.MateriaPrima_Id)
          .input('CantidadTeorica', sql.Decimal(18, 6), m.CantidadTeorica)
          .input('TipoComponente', sql.NVarChar(50), m.TipoComponente || 'Principal')
          .input('MermaPct', sql.Decimal(5, 2), m.MermaPct || 0)
          .input('Notas', sql.NVarChar(255), m.Notas || null);
        
        await reqMat.query(`
          INSERT INTO ERP_BOM_MATERIALES (BOM_Id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas)
          VALUES (@BOM_Id, @MateriaPrima_Id, @CantidadTeorica, @TipoComponente, @MermaPct, @Notas)
        `);
      }
    }
    
    // Actualizar operaciones (eliminar y reinsertar)
    if (operaciones && Array.isArray(operaciones)) {
      await new sql.Request(transaction)
        .input('BOM_Id', sql.Int, id)
        .query('DELETE FROM ERP_BOM_OPERACIONES WHERE BOM_Id = @BOM_Id');
      
      for (let i = 0; i < operaciones.length; i++) {
        const o = operaciones[i];
        const reqOp = new sql.Request(transaction);
        reqOp
          .input('BOM_Id', sql.Int, id)
          .input('TipoCosto', sql.NVarChar(50), o.TipoCosto || 'MANO_OBRA')
          .input('CostoPorUnidad', sql.Decimal(18, 6), o.CostoPorUnidad || 0)
          .input('MinutosPorUnidad', sql.Decimal(18, 6), o.MinutosPorUnidad || 0)
          .input('CostoHoraReferencia', sql.Decimal(18, 6), o.CostoHoraReferencia || 0)
          .input('Notas', sql.NVarChar(255), o.NombreOperacion || null);
        
        await reqOp.query(`
          INSERT INTO ERP_BOM_OPERACIONES (BOM_Id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas)
          VALUES (@BOM_Id, @TipoCosto, @CostoPorUnidad, @MinutosPorUnidad, @CostoHoraReferencia, @Notas)
        `);
      }
    }
    
    await transaction.commit();
    
    return res.json({ success: true, data: { BOM_Id: id } });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Error al actualizar BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar BOM', error: error.message });
  }
};

// DELETE /api/bom/:id - Eliminar BOM
exports.deleteBOM = async (req, res) => {
  const { id } = req.params;
  
  let transaction;
  
  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();
    
    // Verificar si hay órdenes de producción usando este BOM
    const checkOP = await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('SELECT COUNT(*) AS Total FROM ERP_OP_PRODUCCION WHERE BOM_Id = @BOM_Id');
    
    if (checkOP.recordset[0].Total > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el BOM porque tiene órdenes de producción asociadas' 
      });
    }
    
    // Eliminar materiales y operaciones
    await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('DELETE FROM ERP_BOM_MATERIALES WHERE BOM_Id = @BOM_Id');
    
    await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('DELETE FROM ERP_BOM_OPERACIONES WHERE BOM_Id = @BOM_Id');
    
    // Eliminar BOM
    await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('DELETE FROM ERP_BOM WHERE BOM_Id = @BOM_Id');
    
    await transaction.commit();
    
    return res.json({ success: true, message: 'BOM eliminado correctamente' });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Error al eliminar BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar BOM', error: error.message });
  }
};

// POST /api/bom/:id/clonar - Clonar BOM (nueva versión)
exports.clonarBOM = async (req, res) => {
  const { id } = req.params;
  const { nuevaVersion } = req.body;
  
  let transaction;
  
  try {
    const poolConn = await poolPromise;
    transaction = new sql.Transaction(poolConn);
    await transaction.begin();
    
    // Obtener BOM original
    const bomOriginal = await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('SELECT * FROM ERP_BOM WHERE BOM_Id = @BOM_Id');
    
    if (!bomOriginal.recordset || bomOriginal.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'BOM no encontrado' });
    }
    
    const bom = bomOriginal.recordset[0];
    
    // Marcar el BOM anterior como no vigente
    await new sql.Request(transaction)
      .input('BOM_Id', sql.Int, id)
      .query('UPDATE ERP_BOM SET Vigente = 0 WHERE BOM_Id = @BOM_Id');
    
    // Crear nuevo BOM
    const reqNuevo = new sql.Request(transaction);
    reqNuevo
      .input('Company_Id', sql.Int, bom.Company_Id)
      .input('Producto_Id', sql.Int, bom.Producto_Id)
      .input('CodigoBOM', sql.NVarChar(50), bom.CodigoBOM)
      .input('Version', sql.Int, nuevaVersion || (bom.Version + 1))
      .input('MermaPct', sql.Decimal(5, 2), bom.MermaPct)
      .input('Descripcion', sql.NVarChar(500), bom.Descripcion)
      .input('CreadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);
    
    const nuevoResult = await reqNuevo.query(`
      INSERT INTO ERP_BOM (Company_Id, Producto_Id, CodigoBOM, Version, Vigente, MermaPct, Descripcion, CreadoPor, FechaCreacion)
      OUTPUT INSERTED.*
      VALUES (@Company_Id, @Producto_Id, @CodigoBOM, @Version, 1, @MermaPct, @Descripcion, @CreadoPor, GETDATE())
    `);
    
    const nuevoBomId = nuevoResult.recordset[0].BOM_Id;
    
    // Copiar materiales
    await new sql.Request(transaction)
      .input('NuevoBOM_Id', sql.Int, nuevoBomId)
      .input('BOM_Id', sql.Int, id)
      .query(`
        INSERT INTO ERP_BOM_MATERIALES (BOM_Id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas)
        SELECT @NuevoBOM_Id, MateriaPrima_Id, CantidadTeorica, TipoComponente, MermaPct, Notas
        FROM ERP_BOM_MATERIALES
        WHERE BOM_Id = @BOM_Id
      `);
    
    // Copiar operaciones
    await new sql.Request(transaction)
      .input('NuevoBOM_Id', sql.Int, nuevoBomId)
      .input('BOM_Id', sql.Int, id)
      .query(`
        INSERT INTO ERP_BOM_OPERACIONES (BOM_Id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas)
        SELECT @NuevoBOM_Id, TipoCosto, CostoPorUnidad, MinutosPorUnidad, CostoHoraReferencia, Notas
        FROM ERP_BOM_OPERACIONES
        WHERE BOM_Id = @BOM_Id
      `);
    
    await transaction.commit();
    
    return res.status(201).json({ success: true, data: { BOM_Id: nuevoBomId } });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('Error al clonar BOM:', error);
    return res.status(500).json({ success: false, message: 'Error al clonar BOM', error: error.message });
  }
};

// GET /api/bom/materias-primas - Listar materias primas disponibles
exports.listMateriasPrimas = async (req, res) => {
  try {
    const { Company_Id } = req.query;
    
    let query = 'SELECT * FROM ERP_MATERIA_PRIMA WHERE Activo = 1';
    const request = pool.request();
    
    // Nota: Si ERP_MATERIA_PRIMA no tiene Company_Id, remover este filtro
    // if (Company_Id) {
    //   query += ' AND Company_Id = @Company_Id';
    //   request.input('Company_Id', sql.Int, Number(Company_Id));
    // }
    
    query += ' ORDER BY Nombre';
    
    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar materias primas:', error);
    return res.status(500).json({ success: false, message: 'Error al listar materias primas', error: error.message });
  }
};
