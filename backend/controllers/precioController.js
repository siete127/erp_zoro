const { pool, sql } = require('../config/db');
const emailService = require('../services/emailService');

// Generar código de aprobación aleatorio
const generarCodigo = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// POST /api/precios/solicitar - Crear solicitud de cambio de precio
exports.solicitarCambio = async (req, res) => {
  const { Producto_Id, PrecioNuevo, Motivo } = req.body;

  try {
    const producto = await pool.request()
      .input('id', sql.Int, Producto_Id)
      .query('SELECT Precio, Nombre FROM ERP_PRODUCTOS WHERE Producto_Id = @id');

    if (producto.recordset.length === 0) {
      return res.status(404).json({ msg: 'Producto no encontrado' });
    }

    const precioActual = producto.recordset[0].Precio;
    const nombreProducto = producto.recordset[0].Nombre;
    const codigo = generarCodigo();

    const result = await pool.request()
      .input('Producto_Id', sql.Int, Producto_Id)
      .input('PrecioActual', sql.Decimal(18, 2), precioActual)
      .input('PrecioNuevo', sql.Decimal(18, 2), PrecioNuevo)
      .input('Motivo', sql.VarChar, Motivo || null)
      .input('CodigoAprobacion', sql.VarChar, codigo)
      .input('SolicitadoPor', sql.Int, req.user?.User_Id || null)
      .query(`INSERT INTO ERP_SOLICITUD_CAMBIO_PRECIO (Producto_Id, PrecioActual, PrecioNuevo, Motivo, CodigoAprobacion, SolicitadoPor)
              VALUES (@Producto_Id, @PrecioActual, @PrecioNuevo, @Motivo, @CodigoAprobacion, @SolicitadoPor);
              SELECT SCOPE_IDENTITY() AS Solicitud_Id`);

    const solicitudId = result.recordset[0].Solicitud_Id;

    // Enviar correo con código de aprobación. Enviar a los correos configurados
    // en cada compañía que tenga asignado el producto; si no hay ninguno,
    // usar el valor de la variable de entorno como respaldo.
    let destinatarios = [];
    try {
      const compRes = await pool.request()
        .input('Producto_Id', sql.Int, Producto_Id)
        .query(`
          SELECT DISTINCT c.EmailAprobacion1, c.EmailAprobacion2
          FROM ERP_COMPANY c
          INNER JOIN ERP_PRODUCTO_EMPRESA pe ON pe.Company_Id = c.Company_Id
          WHERE pe.Producto_Id = @Producto_Id
        `);
      (compRes.recordset || []).forEach(r => {
        if (r.EmailAprobacion1) destinatarios.push(r.EmailAprobacion1);
        if (r.EmailAprobacion2) destinatarios.push(r.EmailAprobacion2);
      });
      // deduplicar
      destinatarios = [...new Set(destinatarios)];
    } catch (err) {
      console.error('Error obteniendo correos de empresas para aprobación', err);
    }
    if (destinatarios.length === 0) {
      const envEmail = process.env.EMAIL_APROBACION_PRECIOS;
      if (envEmail) destinatarios.push(envEmail);
    }

    if (destinatarios.length > 0) {
      await emailService.sendMail({
        to: destinatarios.join(','),
        subject: 'Solicitud de Cambio de Precio - Aprobación Requerida',
        html: `
        <h2>Solicitud de Cambio de Precio</h2>
        <p><strong>Producto:</strong> ${nombreProducto}</p>
        <p><strong>Precio Actual:</strong> $${precioActual}</p>
        <p><strong>Precio Nuevo:</strong> $${PrecioNuevo}</p>
        <p><strong>Motivo:</strong> ${Motivo || 'No especificado'}</p>
        <p><strong>Código de Aprobación:</strong> <span style="font-size: 20px; font-weight: bold; color: #092052;">${codigo}</span></p>
        <p>Para aprobar este cambio, ingrese el código en el sistema.</p>
      `
      });

      res.status(201).json({ msg: 'Solicitud creada. Se ha enviado un correo con el código de aprobación.', Solicitud_Id: solicitudId });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al crear solicitud' });
  }
};

// POST /api/precios/aprobar - Aprobar cambio con código
exports.aprobarCambio = async (req, res) => {
  const { Solicitud_Id, CodigoAprobacion } = req.body;

  try {
    const solicitud = await pool.request()
      .input('id', sql.Int, Solicitud_Id)
      .query('SELECT * FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Solicitud_Id = @id');

    if (solicitud.recordset.length === 0) {
      return res.status(404).json({ msg: 'Solicitud no encontrada' });
    }

    const sol = solicitud.recordset[0];

    if (sol.Estado !== 'PENDIENTE') {
      return res.status(400).json({ msg: 'La solicitud ya fue procesada' });
    }

    if (sol.CodigoAprobacion !== CodigoAprobacion) {
      return res.status(400).json({ msg: 'Código de aprobación incorrecto' });
    }

    // Actualizar precio del producto
    await pool.request()
      .input('id', sql.Int, sol.Producto_Id)
      .input('precio', sql.Decimal(18, 2), sol.PrecioNuevo)
      .query('UPDATE ERP_PRODUCTOS SET Precio = @precio WHERE Producto_Id = @id');

    // Actualizar solicitud
    await pool.request()
      .input('id', sql.Int, Solicitud_Id)
      .input('aprobador', sql.Int, req.user?.User_Id || null)
      .query('UPDATE ERP_SOLICITUD_CAMBIO_PRECIO SET Estado = \'APROBADO\', AprobadoPor = @aprobador, FechaAprobacion = GETDATE() WHERE Solicitud_Id = @id');

    res.json({ msg: 'Cambio de precio aprobado y aplicado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al aprobar cambio' });
  }
};

// GET /api/precios/solicitudes - Listar solicitudes
exports.listarSolicitudes = async (req, res) => {
  try {
    const result = await pool.request()
      .query(`SELECT s.*, p.SKU, p.Nombre, u.Username as Solicitante
              FROM ERP_SOLICITUD_CAMBIO_PRECIO s
              INNER JOIN ERP_PRODUCTOS p ON s.Producto_Id = p.Producto_Id
              LEFT JOIN ERP_USERS u ON s.SolicitadoPor = u.User_Id
              ORDER BY s.FechaSolicitud DESC`);

    res.json(result.recordset || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al listar solicitudes' });
  }
};

// DELETE /api/precios/solicitudes/:id - Eliminar solicitud
exports.eliminarSolicitud = async (req, res) => {
  try {
    const solicitudId = Number(req.params.id);
    
    const result = await pool.request()
      .input('id', sql.Int, solicitudId)
      .query('DELETE FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Solicitud_Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ msg: 'Solicitud no encontrada' });
    }

    res.json({ msg: 'Solicitud eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error al eliminar solicitud' });
  }
};

module.exports = exports;
