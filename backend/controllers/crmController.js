const sql = require('mssql');
const { poolPromise } = require('../config/db');

// Listar etapas de CRM
exports.getEtapas = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT *
      FROM ERP_CRM_ETAPA
      WHERE Activo = 1
      ORDER BY Orden
    `);

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener etapas CRM:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener etapas CRM', error: error.message });
  }
};

// Crear nueva oportunidad
exports.createOportunidad = async (req, res) => {
  try {
    const {
      Company_Id,
      Client_Id,
      NombreOportunidad,
      MontoEstimado,
      Moneda = 'MXN',
      Probabilidad,
      Origen,
      Etapa_Id,
      FechaCierreEstimada,
      Notas
    } = req.body || {};

    if (!Company_Id) {
      return res.status(400).json({ success: false, message: 'Company_Id es requerido' });
    }
    if (!NombreOportunidad) {
      return res.status(400).json({ success: false, message: 'NombreOportunidad es requerido' });
    }

    const pool = await poolPromise;

    // Si no se envía Etapa_Id, tomar la primera etapa activa por orden
    let etapaIdToUse = Etapa_Id || null;
    if (!etapaIdToUse) {
      const etapaResult = await pool.request()
        .query(`SELECT TOP 1 Etapa_Id FROM ERP_CRM_ETAPA WHERE Activo = 1 ORDER BY Orden`);
      if (etapaResult.recordset.length > 0) {
        etapaIdToUse = etapaResult.recordset[0].Etapa_Id;
      }
    }

    if (!etapaIdToUse) {
      return res.status(400).json({ success: false, message: 'No se encontró una etapa inicial para CRM' });
    }

    const result = await pool.request()
      .input('Company_Id', sql.Int, Company_Id)
      .input('Client_Id', sql.Int, Client_Id || null)
      .input('Etapa_Id', sql.Int, etapaIdToUse)
      .input('NombreOportunidad', sql.NVarChar(200), NombreOportunidad)
      .input('MontoEstimado', sql.Decimal(18, 2), MontoEstimado != null ? MontoEstimado : null)
      .input('Moneda', sql.NVarChar(3), Moneda)
      .input('Probabilidad', sql.Int, Probabilidad != null ? Probabilidad : null)
      .input('Origen', sql.NVarChar(100), Origen || null)
      .input('FechaCierreEstimada', sql.DateTime, FechaCierreEstimada || null)
      .input('Notas', sql.NVarChar(sql.MAX), Notas || null)
      .input('CreadoPor', sql.NVarChar(100), req.user?.username || null)
      .query(`
        INSERT INTO ERP_CRM_OPORTUNIDADES
        (Company_Id, Client_Id, Etapa_Id, NombreOportunidad, MontoEstimado, Moneda, Probabilidad, Origen,
         FechaCierreEstimada, Notas, CreadoPor)
        OUTPUT INSERTED.*
        VALUES (@Company_Id, @Client_Id, @Etapa_Id, @NombreOportunidad, @MontoEstimado, @Moneda, @Probabilidad,
                @Origen, @FechaCierreEstimada, @Notas, @CreadoPor)
      `);

    const nuevaOportunidad = result.recordset[0];

    // Notificar cambio de oportunidad en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:oportunidad:changed', { Oportunidad_Id: nuevaOportunidad.Oportunidad_Id });
    }

    return res.status(201).json({ success: true, data: nuevaOportunidad });
  } catch (error) {
    console.error('Error al crear oportunidad:', error);
    return res.status(500).json({ success: false, message: 'Error al crear oportunidad', error: error.message });
  }
};

// Listar oportunidades con filtros básicos
exports.getOportunidades = async (req, res) => {
  try {
    const { Company_Id, Etapa_Id, Status, Client_Id } = req.query;

    const pool = await poolPromise;
    let query = `
      SELECT o.*, e.Nombre AS EtapaNombre, c.LegalName AS ClientLegalName, c.CommercialName AS ClientCommercialName,
             c.RFC AS ClientRFC, v.Total AS VentaTotal, v.Status AS VentaStatus,
             cot.TOTAL AS CotizacionTotal
      FROM ERP_CRM_OPORTUNIDADES o
      LEFT JOIN ERP_CRM_ETAPA e ON o.Etapa_Id = e.Etapa_Id
      LEFT JOIN ERP_CLIENT c ON o.Client_Id = c.Client_Id
      LEFT JOIN ERP_VENTAS v ON o.Venta_Id = v.Venta_Id
      LEFT JOIN ERP_COTIZACIONES cot ON o.ID_COTIZACION = cot.ID_COTIZACION
      WHERE 1 = 1
    `;

    const request = pool.request();

    if (Company_Id) {
      query += ' AND o.Company_Id = @Company_Id';
      request.input('Company_Id', sql.Int, Company_Id);
    }
    if (Etapa_Id) {
      query += ' AND o.Etapa_Id = @Etapa_Id';
      request.input('Etapa_Id', sql.Int, Etapa_Id);
    }
    if (Status) {
      query += ' AND o.Status = @Status';
      request.input('Status', sql.NVarChar(50), Status);
    }
    if (Client_Id) {
      query += ' AND o.Client_Id = @Client_Id';
      request.input('Client_Id', sql.Int, Client_Id);
    }

    query += ' ORDER BY o.FechaCreacion DESC';

    const result = await request.query(query);
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar oportunidades:', error);
    return res.status(500).json({ success: false, message: 'Error al listar oportunidades', error: error.message });
  }
};

// Obtener oportunidad + actividades
exports.getOportunidadDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;

    const opResult = await pool.request()
      .input('Oportunidad_Id', sql.Int, id)
      .query(`
        SELECT o.*, e.Nombre AS EtapaNombre, e.Descripcion AS EtapaDescripcion,
               c.LegalName AS ClientLegalName, c.CommercialName AS ClientCommercialName, c.RFC AS ClientRFC
        FROM ERP_CRM_OPORTUNIDADES o
        LEFT JOIN ERP_CRM_ETAPA e ON o.Etapa_Id = e.Etapa_Id
        LEFT JOIN ERP_CLIENT c ON o.Client_Id = c.Client_Id
        WHERE o.Oportunidad_Id = @Oportunidad_Id
      `);

    if (opResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    }

    const actResult = await pool.request()
      .input('Oportunidad_Id', sql.Int, id)
      .query(`
        SELECT *
        FROM ERP_CRM_ACTIVIDADES
        WHERE Oportunidad_Id = @Oportunidad_Id
        ORDER BY FechaProgramada DESC, FechaCreacion DESC
      `);

    // Cargar productos de cada actividad si existen en Descripcion como JSON
    const actividades = actResult.recordset.map(act => {
      try {
        // Decodificar HTML entities y parsear productos desde Descripcion si está en formato JSON
        if (act.Descripcion) {
          // Decodificar &quot; a "
          let descripcionLimpia = act.Descripcion.replace(/&quot;/g, '"');
          
          if (descripcionLimpia.trim().includes('[{')) {
            // Extraer el JSON del texto
            const match = descripcionLimpia.match(/\[\{.*?\}\]/);
            if (match) {
              const productos = JSON.parse(match[0]);
              return { ...act, Productos: productos };
            }
          }
        }
      } catch (e) {
        console.error('Error parseando productos de actividad:', e);
      }
      return act;
    });

    return res.json({
      success: true,
      data: {
        oportunidad: opResult.recordset[0],
        actividades: actividades
      }
    });
  } catch (error) {
    console.error('Error al obtener oportunidad:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener oportunidad', error: error.message });
  }
};

// Actualizar oportunidad
exports.updateOportunidad = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Company_Id,
      Client_Id,
      NombreOportunidad,
      MontoEstimado,
      Moneda,
      Probabilidad,
      Origen,
      FechaCierreEstimada,
      Notas,
      Status
    } = req.body || {};

    const pool = await poolPromise;
    const request = pool.request().input('Oportunidad_Id', sql.Int, id);

    request.input('Company_Id', sql.Int, Company_Id || null);
    request.input('Client_Id', sql.Int, Client_Id || null);
    request.input('NombreOportunidad', sql.NVarChar(200), NombreOportunidad || null);
    request.input('MontoEstimado', sql.Decimal(18, 2), MontoEstimado != null ? MontoEstimado : null);
    request.input('Moneda', sql.NVarChar(3), Moneda || null);
    request.input('Probabilidad', sql.Int, Probabilidad != null ? Probabilidad : null);
    request.input('Origen', sql.NVarChar(100), Origen || null);
    request.input('FechaCierreEstimada', sql.DateTime, FechaCierreEstimada || null);
    request.input('Notas', sql.NVarChar(sql.MAX), Notas || null);
    request.input('Status', sql.NVarChar(50), Status || null);
    request.input('ModificadoPor', sql.NVarChar(100), req.user?.username || null);

    const result = await request.query(`
      UPDATE ERP_CRM_OPORTUNIDADES
      SET Company_Id = ISNULL(@Company_Id, Company_Id),
          Client_Id = ISNULL(@Client_Id, Client_Id),
          NombreOportunidad = ISNULL(@NombreOportunidad, NombreOportunidad),
          MontoEstimado = ISNULL(@MontoEstimado, MontoEstimado),
          Moneda = ISNULL(@Moneda, Moneda),
          Probabilidad = ISNULL(@Probabilidad, Probabilidad),
          Origen = ISNULL(@Origen, Origen),
          FechaCierreEstimada = ISNULL(@FechaCierreEstimada, FechaCierreEstimada),
          Notas = ISNULL(@Notas, Notas),
          Status = ISNULL(@Status, Status),
          ModificadoPor = @ModificadoPor,
          FechaModificacion = GETDATE()
      WHERE Oportunidad_Id = @Oportunidad_Id;

      SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id;
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    }

    const oportunidadActualizada = result.recordset[0];

    // Notificar cambio de oportunidad en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:oportunidad:changed', { Oportunidad_Id: oportunidadActualizada.Oportunidad_Id });
    }

    return res.json({ success: true, data: oportunidadActualizada });
  } catch (error) {
    console.error('Error al actualizar oportunidad:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar oportunidad', error: error.message });
  }
};

// Cambiar etapa de la oportunidad
exports.cambiarEtapaOportunidad = async (req, res) => {
  try {
    const { id } = req.params;
    const { Etapa_Id } = req.body || {};

    if (!Etapa_Id) {
      return res.status(400).json({ success: false, message: 'Etapa_Id es requerido' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Oportunidad_Id', sql.Int, id)
      .input('Etapa_Id', sql.Int, Etapa_Id)
      .input('ModificadoPor', sql.NVarChar(100), req.user?.username || null)
      .query(`
        UPDATE ERP_CRM_OPORTUNIDADES
        SET Etapa_Id = @Etapa_Id,
            FechaModificacion = GETDATE(),
            ModificadoPor = @ModificadoPor
        WHERE Oportunidad_Id = @Oportunidad_Id;

        SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    }

    const oportunidadEtapa = result.recordset[0];

    // Notificar cambio de oportunidad en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:oportunidad:changed', { Oportunidad_Id: oportunidadEtapa.Oportunidad_Id });
    }

    return res.json({ success: true, data: oportunidadEtapa });
  } catch (error) {
    console.error('Error al cambiar etapa de oportunidad:', error);
    return res.status(500).json({ success: false, message: 'Error al cambiar etapa de oportunidad', error: error.message });
  }
};

// Cerrar oportunidad (Ganada / Perdida). Si es Ganada y se indica, genera la venta y detalle desde la cotización.
exports.cerrarOportunidad = async (req, res) => {
  const { id } = req.params;
  const { Resultado, CrearVentaDesdeCotizacion = true } = req.body || {};

  if (!Resultado || !['Ganada', 'Perdida'].includes(Resultado)) {
    return res.status(400).json({ success: false, message: 'Resultado debe ser "Ganada" o "Perdida"' });
  }

  let transaction;

  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1) Leer oportunidad actual
    const opRequest = new sql.Request(transaction);
    const opResult = await opRequest
      .input('Oportunidad_Id', sql.Int, id)
      .query('SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id');

    if (opResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    }

    const oportunidad = opResult.recordset[0];
    let detallesCotizacion = [];
    
    // Validar que la oportunidad no esté ya cerrada
    if (oportunidad.Status === 'Ganada' || oportunidad.Status === 'Perdida') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Esta oportunidad ya fue cerrada como ${oportunidad.Status}${oportunidad.Venta_Id ? ` (Venta #${oportunidad.Venta_Id})` : ''}` 
      });
    }

    let nuevaVentaId = oportunidad.Venta_Id;

    // Si es Perdida, solo actualizar el status sin crear venta
    if (Resultado === 'Perdida') {
      const cierreReq = new sql.Request(transaction);
      const cierreRes = await cierreReq
        .input('Oportunidad_Id', sql.Int, id)
        .input('Status', sql.NVarChar(50), Resultado)
        .query(`
          UPDATE ERP_CRM_OPORTUNIDADES
          SET Status = @Status,
              FechaCierreReal = GETDATE(),
              FechaModificacion = GETDATE()
          WHERE Oportunidad_Id = @Oportunidad_Id;

          SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id;
        `);

      await transaction.commit();

      return res.json({
        success: true,
        data: {
          oportunidad: cierreRes.recordset[0],
          Venta_Id: null
        }
      });
    }

    // 2) Si es Ganada y se debe crear la venta desde la cotización (solo si aún no tiene Venta_Id)
    if (Resultado === 'Ganada' && CrearVentaDesdeCotizacion && !nuevaVentaId) {
      // Validar que tenga Client_Id
      if (!oportunidad.Client_Id) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Para crear una venta, la oportunidad debe tener un cliente asignado. Por favor, asigna un cliente antes de cerrar como Ganada.' 
        });
      }

      // Obtener datos del cliente
      const clienteReq = new sql.Request(transaction);
      const clienteRes = await clienteReq
        .input('Client_Id', sql.Int, oportunidad.Client_Id)
        .query('SELECT TOP 1 LegalName, CommercialName, RFC FROM ERP_CLIENT WHERE Client_Id = @Client_Id');

      if (clienteRes.recordset.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: 'Cliente no encontrado en la base de datos. Verifica que el cliente exista.' 
        });
      }

      const cliente = clienteRes.recordset[0];

      // Obtener detalle de cotización si existe
      let subtotal = 0;
      let iva = 0;
      let total = 0;

      if (oportunidad.ID_COTIZACION) {
        const cotReq = new sql.Request(transaction);
        const cotDetalleRes = await cotReq
          .input('ID_COTIZACION', sql.Int, oportunidad.ID_COTIZACION)
          .query('SELECT * FROM ERP_COTIZACION_DETALLE WHERE ID_COTIZACION = @ID_COTIZACION');

        detallesCotizacion = cotDetalleRes.recordset || [];

        for (const det of detallesCotizacion) {
          const sub = Number(det.SUBTOTAL) || 0;
          const ivaDet = sub * 0.16;
          const totalDet = sub + ivaDet;
          subtotal += sub;
          iva += ivaDet;
          total += totalDet;
        }
      } else {
        // Si no hay cotización vinculada, usar monto estimado
        const montoBase = Number(oportunidad.MontoEstimado) || 0;
        subtotal = montoBase / 1.16; // Descontar IVA del monto estimado
        iva = subtotal * 0.16;
        total = montoBase;
      }

      // Determinar status: si tiene productos de cotización = Completada, si no = Pendiente
      const statusId = detallesCotizacion.length > 0 ? 2 : 1;
      const statusNombre = detallesCotizacion.length > 0 ? 'Completada' : 'Pendiente';

      const ventaReq = new sql.Request(transaction);
      const ventaRes = await ventaReq
        .input('Company_Id', sql.Int, oportunidad.Company_Id)
        .input('Moneda', sql.VarChar(3), oportunidad.Moneda || 'MXN')
        .input('Subtotal', sql.Decimal(18, 2), subtotal)
        .input('IVA', sql.Decimal(18, 2), iva)
        .input('Total', sql.Decimal(18, 2), total)
        .input('Status_Id', sql.Int, statusId)
        .input('Status', sql.NVarChar(50), statusNombre)
        .input('ID_COTIZACION', sql.Int, oportunidad.ID_COTIZACION || null)
        .input('Client_Id', sql.Int, oportunidad.Client_Id)
        .query(`
          INSERT INTO ERP_VENTAS
            (Company_Id, Total, IVA, Subtotal, Moneda, Status_Id, FechaVenta, Status, ID_COTIZACION, Client_Id)
          OUTPUT INSERTED.Venta_Id
          VALUES
            (@Company_Id, @Total, @IVA, @Subtotal, @Moneda, @Status_Id, GETDATE(), @Status, @ID_COTIZACION, @Client_Id);
        `);

      nuevaVentaId = ventaRes.recordset[0].Venta_Id;

      // Insertar detalle de venta a partir de la cotización
      if (detallesCotizacion.length > 0) {
        for (const det of detallesCotizacion) {
          const sub = Number(det.SUBTOTAL) || 0;
          const ivaDet = sub * 0.16;
          const totalDet = sub + ivaDet;

          const detReq = new sql.Request(transaction);
          detReq
            .input('Venta_Id', sql.Int, nuevaVentaId)
            .input('Producto_Id', sql.Int, det.ID_PRODUCTO)
            .input('Cantidad', sql.Decimal(18, 2), det.CANTIDAD)
            .input('PrecioUnitario', sql.Decimal(18, 2), det.PRECIO_UNITARIO)
            .input('Subtotal', sql.Decimal(18, 2), sub)
            .input('IVA', sql.Decimal(18, 2), ivaDet)
            .input('Total', sql.Decimal(18, 2), totalDet);

          await detReq.query(`
            INSERT INTO ERP_VENTA_DETALLE
              (Venta_Id, Producto_Id, Cantidad, PrecioUnitario, Subtotal, IVA, Total)
            VALUES
              (@Venta_Id, @Producto_Id, @Cantidad, @PrecioUnitario, @Subtotal, @IVA, @Total);
          `);
        }
      }
    }

    // Si es Ganada pero NO se debe crear venta (o ya tiene Venta_Id), solo actualizar status
    // 3) Actualizar oportunidad como ganada/perdida y vincular venta si aplica
    const cierreReq = new sql.Request(transaction);
    const cierreRes = await cierreReq
      .input('Oportunidad_Id', sql.Int, id)
      .input('Status', sql.NVarChar(50), Resultado)
      .input('Venta_Id', sql.Int, nuevaVentaId || null)
      .query(`
        UPDATE ERP_CRM_OPORTUNIDADES
        SET Status = @Status,
            Venta_Id = @Venta_Id,
            FechaCierreReal = GETDATE(),
            FechaModificacion = GETDATE()
        WHERE Oportunidad_Id = @Oportunidad_Id;

        SELECT * FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id;
      `);

    await transaction.commit();

    // Notificar en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:oportunidad:changed', { Oportunidad_Id: id });
    }

    let mensaje = `Oportunidad cerrada como ${Resultado}`;
    if (Resultado === 'Ganada' && nuevaVentaId) {
      if (detallesCotizacion.length > 0) {
        mensaje = `Oportunidad cerrada como Ganada. Venta #${nuevaVentaId} creada con ${detallesCotizacion.length} producto(s) de la cotización.`;
      } else {
        mensaje = `Oportunidad cerrada como Ganada. Venta #${nuevaVentaId} creada en estado Pendiente. Agrega los productos manualmente desde el detalle de la venta.`;
      }
    }

    return res.json({
      success: true,
      message: mensaje,
      data: {
        oportunidad: cierreRes.recordset[0],
        Venta_Id: nuevaVentaId
      }
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { /* ignored */ }
    }
    console.error('Error al cerrar oportunidad:', error);
    console.error('Stack completo:', error.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al cerrar oportunidad', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Listar actividades de una oportunidad
exports.listarActividades = async (req, res) => {
  try {
    const { id } = req.params; // Oportunidad_Id
    const pool = await poolPromise;

    const result = await pool.request()
      .input('Oportunidad_Id', sql.Int, id)
      .query(`
        SELECT * FROM ERP_CRM_ACTIVIDADES
        WHERE Oportunidad_Id = @Oportunidad_Id
        ORDER BY FechaProgramada DESC, FechaCreacion DESC
      `);

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al listar actividades:', error);
    return res.status(500).json({ success: false, message: 'Error al listar actividades', error: error.message });
  }
};

// Crear actividad para una oportunidad
exports.crearActividad = async (req, res) => {
  try {
    const { id } = req.params; // Oportunidad_Id
    const {
      Tipo,
      Titulo,
      Descripcion,
      FechaProgramada,
      FechaReal,
      Resultado,
      Usuario_Id
    } = req.body || {};

    if (!Tipo) {
      return res.status(400).json({ success: false, message: 'Tipo es requerido' });
    }
    if (!Titulo) {
      return res.status(400).json({ success: false, message: 'Titulo es requerido' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Oportunidad_Id', sql.Int, id)
      .input('Tipo', sql.NVarChar(50), Tipo)
      .input('Titulo', sql.NVarChar(200), Titulo)
      .input('Descripcion', sql.NVarChar(sql.MAX), Descripcion || null)
      .input('FechaProgramada', sql.DateTime, FechaProgramada || null)
      .input('FechaReal', sql.DateTime, FechaReal || null)
      .input('Resultado', sql.NVarChar(255), Resultado || null)
      .input('Usuario_Id', sql.Int, Usuario_Id || null)
      .input('CreadoPor', sql.NVarChar(100), req.user?.username || null)
      .query(`
        INSERT INTO ERP_CRM_ACTIVIDADES
          (Oportunidad_Id, Tipo, Titulo, Descripcion, FechaProgramada, FechaReal, Resultado, Usuario_Id, CreadoPor)
        OUTPUT INSERTED.*
        VALUES
          (@Oportunidad_Id, @Tipo, @Titulo, @Descripcion, @FechaProgramada, @FechaReal, @Resultado, @Usuario_Id, @CreadoPor);
      `);

    const nuevaActividad = result.recordset[0];

    // Notificar cambio de actividades CRM en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:actividad:changed', {
        Actividad_Id: nuevaActividad.Actividad_Id,
        Oportunidad_Id: nuevaActividad.Oportunidad_Id,
      });
    }

    return res.status(201).json({ success: true, data: nuevaActividad });
  } catch (error) {
    console.error('Error al crear actividad:', error);
    return res.status(500).json({ success: false, message: 'Error al crear actividad', error: error.message });
  }
};

// Marcar actividad como completada
exports.completarActividad = async (req, res) => {
  try {
    const { actividadId } = req.params;
    const { FechaReal, Resultado } = req.body || {};

    const pool = await poolPromise;
    const result = await pool.request()
      .input('Actividad_Id', sql.Int, actividadId)
      .input('FechaReal', sql.DateTime, FechaReal || new Date())
      .input('Resultado', sql.NVarChar(255), Resultado || null)
      .query(`
        UPDATE ERP_CRM_ACTIVIDADES
        SET Completada = 1,
            FechaReal = ISNULL(@FechaReal, FechaReal),
            Resultado = ISNULL(@Resultado, Resultado)
        WHERE Actividad_Id = @Actividad_Id;

        SELECT * FROM ERP_CRM_ACTIVIDADES WHERE Actividad_Id = @Actividad_Id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Actividad no encontrada' });
    }

    const actividadCompletada = result.recordset[0];

    // Notificar cambio de actividades CRM en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('crm:actividad:changed', {
        Actividad_Id: actividadCompletada.Actividad_Id,
        Oportunidad_Id: actividadCompletada.Oportunidad_Id,
      });
    }

    return res.json({ success: true, data: actividadCompletada });
  } catch (error) {
    console.error('Error al completar actividad:', error);
    return res.status(500).json({ success: false, message: 'Error al completar actividad', error: error.message });
  }
};

// Eliminar oportunidad (y sus actividades). Sólo se permite si no tiene venta generada.
exports.eliminarOportunidad = async (req, res) => {
  const { id } = req.params;

  let transaction;

  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Verificar oportunidad y que no tenga venta ligada
    const opReq = new sql.Request(transaction);
    const opRes = await opReq
      .input('Oportunidad_Id', sql.Int, id)
      .query('SELECT TOP 1 Oportunidad_Id, Venta_Id FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id');

    if (opRes.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Oportunidad no encontrada' });
    }

    const op = opRes.recordset[0];
    if (op.Venta_Id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'No se puede eliminar una oportunidad que ya generó una venta' });
    }

    // Borrar actividades primero
    await new sql.Request(transaction)
      .input('Oportunidad_Id', sql.Int, id)
      .query('DELETE FROM ERP_CRM_ACTIVIDADES WHERE Oportunidad_Id = @Oportunidad_Id');

    // Borrar oportunidad
    await new sql.Request(transaction)
      .input('Oportunidad_Id', sql.Int, id)
      .query('DELETE FROM ERP_CRM_OPORTUNIDADES WHERE Oportunidad_Id = @Oportunidad_Id');

    await transaction.commit();

    return res.json({ success: true, message: 'Oportunidad eliminada correctamente' });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { /* ignored */ }
    }
    console.error('Error al eliminar oportunidad:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar oportunidad', error: error.message });
  }
};

// Enviar actividad de visita a producción
exports.enviarActividadAProduccion = async (req, res) => {
  const { actividadId } = req.params;
  const { productos } = req.body; // [{Producto_Id, Cantidad}]

  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ success: false, message: 'Debe proporcionar productos para enviar a producción' });
  }

  let transaction;

  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Obtener actividad y oportunidad
    const actReq = new sql.Request(transaction);
    const actRes = await actReq
      .input('Actividad_Id', sql.Int, actividadId)
      .query(`
        SELECT a.*, o.Company_Id, o.Client_Id
        FROM ERP_CRM_ACTIVIDADES a
        INNER JOIN ERP_CRM_OPORTUNIDADES o ON a.Oportunidad_Id = o.Oportunidad_Id
        WHERE a.Actividad_Id = @Actividad_Id
      `);

    if (actRes.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Actividad no encontrada' });
    }

    const actividad = actRes.recordset[0];
    const ordenesCreadas = [];

    // Obtener Company_Id de PTC (empresa productora)
    const ptcRes = await new sql.Request(transaction).query("SELECT TOP 1 Company_Id FROM ERP_COMPANY WHERE NameCompany LIKE '%PTC%'");
    const ptcCompanyId = ptcRes.recordset.length > 0 ? ptcRes.recordset[0].Company_Id : actividad.Company_Id;

    // Crear orden de producción por cada producto (asignada a PTC)
    for (const prod of productos) {
      const opReq = new sql.Request(transaction);
      opReq
        .input('PTC_Company_Id', sql.Int, ptcCompanyId)
        .input('Solicitante_Company_Id', sql.Int, actividad.Company_Id)
        .input('Producto_Id', sql.Int, prod.Producto_Id)
        .input('CantidadPlanificada', sql.Decimal(18, 2), prod.Cantidad);

      const opRes = await opReq.query(`
        INSERT INTO ERP_OP_PRODUCCION (
          NumeroOP, Company_Id, CompanySolicitante_Id, Producto_Id, BOM_Id,
          CantidadPlanificada, Estado, Prioridad, FechaCreacion
        )
        OUTPUT INSERTED.*
        SELECT
          'OP-' + CONVERT(VARCHAR(4), YEAR(GETDATE())) + '-' + RIGHT('00000' + CAST(ABS(CHECKSUM(NEWID())) % 100000 AS VARCHAR(5)), 5),
          @PTC_Company_Id, @Solicitante_Company_Id, @Producto_Id,
          (SELECT TOP 1 BOM_Id FROM ERP_BOM WHERE Producto_Id = @Producto_Id AND Vigente = 1 ORDER BY CASE WHEN Company_Id = @PTC_Company_Id THEN 0 ELSE 1 END, Version DESC),
          @CantidadPlanificada, 'EN_ESPERA', 'NORMAL', GETDATE();
      `);

      ordenesCreadas.push(opRes.recordset[0]);
    }

    // Marcar actividad como completada
    await new sql.Request(transaction)
      .input('Actividad_Id', sql.Int, actividadId)
      .input('Resultado', sql.NVarChar(255), `Enviado a producción: ${ordenesCreadas.map(o => o.NumeroOP).join(', ')}`)
      .query(`
        UPDATE ERP_CRM_ACTIVIDADES
        SET Completada = 1,
            FechaReal = GETDATE(),
            Resultado = @Resultado
        WHERE Actividad_Id = @Actividad_Id
      `);

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.emit('produccion:nueva', { ordenes: ordenesCreadas });
      io.emit('crm:actividad:changed', { Actividad_Id: actividadId });
    }

    return res.status(201).json({
      success: true,
      message: 'Órdenes de producción creadas desde actividad',
      data: ordenesCreadas
    });
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    console.error('Error al enviar actividad a producción:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar actividad a producción', error: error.message });
  }
};
