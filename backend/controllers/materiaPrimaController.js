const { pool, sql, poolPromise } = require('../config/db');

// GET /api/materias-primas - Listar materias primas
exports.listMateriasPrimas = async (req, res) => {
  try {
    const { Activo, Tipo } = req.query;
    
    let query = 'SELECT * FROM ERP_MATERIA_PRIMA WHERE 1=1';
    const request = pool.request();
    
    if (Activo !== undefined) {
      query += ' AND Activo = @Activo';
      request.input('Activo', sql.Bit, Activo === '1' || Activo === 'true' ? 1 : 0);
    }
    
    if (Tipo) {
      query += ' AND Tipo = @Tipo';
      request.input('Tipo', sql.NVarChar(50), Tipo);
    }
    
    query += ' ORDER BY Nombre';
    
    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar materias primas:', error);
    return res.status(500).json({ success: false, message: 'Error al listar materias primas', error: error.message });
  }
};

// GET /api/materias-primas/:id - Detalle de materia prima
exports.getMateriaPrimaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.request()
      .input('MateriaPrima_Id', sql.Int, id)
      .query('SELECT * FROM ERP_MATERIA_PRIMA WHERE MateriaPrima_Id = @MateriaPrima_Id');
    
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Materia prima no encontrada' });
    }
    
    return res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error al obtener materia prima:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener materia prima', error: error.message });
  }
};

// POST /api/materias-primas - Crear materia prima
exports.createMateriaPrima = async (req, res) => {
  try {
    const {
      Codigo,
      Nombre,
      Descripcion,
      Tipo,
      UnidadCompra,
      UnidadConsumo,
      FactorConversion,
      Gramaje,
      CostoUnitario,
      Moneda
    } = req.body;
    
    if (!Codigo || !Nombre || !Tipo || !UnidadCompra || !UnidadConsumo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Codigo, Nombre, Tipo, UnidadCompra y UnidadConsumo son requeridos' 
      });
    }
    
    const request = pool.request();
    request
      .input('Codigo', sql.NVarChar(50), Codigo)
      .input('Nombre', sql.NVarChar(200), Nombre)
      .input('Descripcion', sql.NVarChar(500), Descripcion || null)
      .input('Tipo', sql.NVarChar(50), Tipo)
      .input('UnidadCompra', sql.NVarChar(20), UnidadCompra)
      .input('UnidadConsumo', sql.NVarChar(20), UnidadConsumo)
      .input('FactorConversion', sql.Decimal(18, 6), FactorConversion || 1)
      .input('Gramaje', sql.Decimal(18, 4), Gramaje || null)
      .input('CostoUnitario', sql.Decimal(18, 6), CostoUnitario || 0)
      .input('Moneda', sql.NVarChar(3), Moneda || 'MXN')
      .input('CreadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);
    
    const result = await request.query(`
      INSERT INTO ERP_MATERIA_PRIMA (
        Codigo, Nombre, Descripcion, Tipo, UnidadCompra, UnidadConsumo,
        FactorConversion, Gramaje, CostoUnitario, Moneda, Activo,
        FechaUltimoCosto, FechaCreacion, CreadoPor
      )
      OUTPUT INSERTED.*
      VALUES (
        @Codigo, @Nombre, @Descripcion, @Tipo, @UnidadCompra, @UnidadConsumo,
        @FactorConversion, @Gramaje, @CostoUnitario, @Moneda, 1,
        GETDATE(), GETDATE(), @CreadoPor
      )
    `);
    
    return res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error al crear materia prima:', error);
    if (error.message.includes('UX_ERP_MATERIA_PRIMA_Codigo')) {
      return res.status(400).json({ success: false, message: 'El código ya existe' });
    }
    return res.status(500).json({ success: false, message: 'Error al crear materia prima', error: error.message });
  }
};

// PUT /api/materias-primas/:id - Actualizar materia prima
exports.updateMateriaPrima = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Codigo,
      Nombre,
      Descripcion,
      Tipo,
      UnidadCompra,
      UnidadConsumo,
      FactorConversion,
      Gramaje,
      CostoUnitario,
      Moneda,
      Activo
    } = req.body;
    
    const request = pool.request();
    request
      .input('MateriaPrima_Id', sql.Int, id)
      .input('Codigo', sql.NVarChar(50), Codigo)
      .input('Nombre', sql.NVarChar(200), Nombre)
      .input('Descripcion', sql.NVarChar(500), Descripcion || null)
      .input('Tipo', sql.NVarChar(50), Tipo)
      .input('UnidadCompra', sql.NVarChar(20), UnidadCompra)
      .input('UnidadConsumo', sql.NVarChar(20), UnidadConsumo)
      .input('FactorConversion', sql.Decimal(18, 6), FactorConversion || 1)
      .input('Gramaje', sql.Decimal(18, 4), Gramaje || null)
      .input('CostoUnitario', sql.Decimal(18, 6), CostoUnitario || 0)
      .input('Moneda', sql.NVarChar(3), Moneda || 'MXN')
      .input('Activo', sql.Bit, Activo !== undefined ? (Activo ? 1 : 0) : 1)
      .input('ModificadoPor', sql.NVarChar(100), req.user?.username || req.user?.email || null);
    
    await request.query(`
      UPDATE ERP_MATERIA_PRIMA
      SET Codigo = @Codigo,
          Nombre = @Nombre,
          Descripcion = @Descripcion,
          Tipo = @Tipo,
          UnidadCompra = @UnidadCompra,
          UnidadConsumo = @UnidadConsumo,
          FactorConversion = @FactorConversion,
          Gramaje = @Gramaje,
          CostoUnitario = @CostoUnitario,
          Moneda = @Moneda,
          Activo = @Activo,
          FechaUltimoCosto = GETDATE(),
          ModificadoPor = @ModificadoPor,
          FechaModificacion = GETDATE()
      WHERE MateriaPrima_Id = @MateriaPrima_Id
    `);
    
    return res.json({ success: true, data: { MateriaPrima_Id: id } });
  } catch (error) {
    console.error('Error al actualizar materia prima:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar materia prima', error: error.message });
  }
};

// DELETE /api/materias-primas/:id - Eliminar materia prima
exports.deleteMateriaPrima = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si está en uso en algún BOM
    const checkBOM = await pool.request()
      .input('MateriaPrima_Id', sql.Int, id)
      .query('SELECT COUNT(*) AS Total FROM ERP_BOM_MATERIALES WHERE MateriaPrima_Id = @MateriaPrima_Id');
    
    if (checkBOM.recordset[0].Total > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar la materia prima porque está en uso en BOM' 
      });
    }
    
    await pool.request()
      .input('MateriaPrima_Id', sql.Int, id)
      .query('DELETE FROM ERP_MATERIA_PRIMA WHERE MateriaPrima_Id = @MateriaPrima_Id');
    
    return res.json({ success: true, message: 'Materia prima eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar materia prima:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar materia prima', error: error.message });
  }
};
