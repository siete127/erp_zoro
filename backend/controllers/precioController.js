const { pool, sql } = require('../config/db');
const emailService = require('../services/emailService');

const generarCodigo = () => Math.random().toString(36).substring(2, 8).toUpperCase();

async function ensurePriceTierTable() {
  await pool.request().query(`
    IF OBJECT_ID('dbo.ERP_PRECIO_NIVEL', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ERP_PRECIO_NIVEL (
        PrecioNivel_Id INT IDENTITY(1,1) PRIMARY KEY,
        Producto_Id INT NOT NULL,
        NombreLista NVARCHAR(120) NOT NULL,
        CantidadMinima DECIMAL(18,4) NOT NULL,
        CantidadMaxima DECIMAL(18,4) NULL,
        DescuentoPct DECIMAL(9,4) NOT NULL DEFAULT 0,
        PrecioFijo DECIMAL(18,6) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreadoPor INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL
      );
      CREATE INDEX IX_ERP_PRECIO_NIVEL_PRODUCTO
        ON dbo.ERP_PRECIO_NIVEL (Producto_Id, Activo, NombreLista, CantidadMinima);
    END
  `);
}

exports.solicitarCambio = async (req, res) => {
  const { Producto_Id, PrecioNuevo, Motivo } = req.body || {};

  try {
    const producto = await pool.request()
      .input('id', sql.Int, Producto_Id)
      .query('SELECT Precio, Nombre FROM ERP_PRODUCTOS WHERE Producto_Id = @id');

    if (!producto.recordset.length) {
      return res.status(404).json({ msg: 'Producto no encontrado' });
    }

    const precioActual = Number(producto.recordset[0].Precio || 0);
    const nombreProducto = producto.recordset[0].Nombre;
    const codigo = generarCodigo();

    const result = await pool.request()
      .input('Producto_Id', sql.Int, Producto_Id)
      .input('PrecioActual', sql.Decimal(18, 2), precioActual)
      .input('PrecioNuevo', sql.Decimal(18, 2), Number(PrecioNuevo))
      .input('Motivo', sql.VarChar, Motivo || null)
      .input('CodigoAprobacion', sql.VarChar, codigo)
      .input('SolicitadoPor', sql.Int, req.user?.User_Id || null)
      .query(`
        INSERT INTO ERP_SOLICITUD_CAMBIO_PRECIO (
          Producto_Id, PrecioActual, PrecioNuevo, Motivo, CodigoAprobacion, SolicitadoPor
        )
        VALUES (
          @Producto_Id, @PrecioActual, @PrecioNuevo, @Motivo, @CodigoAprobacion, @SolicitadoPor
        );
        SELECT SCOPE_IDENTITY() AS Solicitud_Id;
      `);

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
      (compRes.recordset || []).forEach((row) => {
        if (row.EmailAprobacion1) destinatarios.push(row.EmailAprobacion1);
        if (row.EmailAprobacion2) destinatarios.push(row.EmailAprobacion2);
      });
      destinatarios = [...new Set(destinatarios)];
    } catch (err) {
      console.error('precio.solicitarCambio destinatarios error', err);
    }

    if (destinatarios.length === 0 && process.env.EMAIL_APROBACION_PRECIOS) {
      destinatarios.push(process.env.EMAIL_APROBACION_PRECIOS);
    }

    if (destinatarios.length > 0) {
      await emailService.sendMail({
        to: destinatarios.join(','),
        subject: 'Solicitud de Cambio de Precio - Aprobacion Requerida',
        html: `
          <h2>Solicitud de Cambio de Precio</h2>
          <p><strong>Producto:</strong> ${nombreProducto}</p>
          <p><strong>Precio Actual:</strong> $${precioActual}</p>
          <p><strong>Precio Nuevo:</strong> $${Number(PrecioNuevo || 0)}</p>
          <p><strong>Motivo:</strong> ${Motivo || 'No especificado'}</p>
          <p><strong>Codigo de Aprobacion:</strong> <span style="font-size: 20px; font-weight: bold; color: #092052;">${codigo}</span></p>
        `,
      });
    }

    return res.status(201).json({
      msg: 'Solicitud creada. Se envio el codigo de aprobacion.',
      Solicitud_Id: result.recordset?.[0]?.Solicitud_Id || null,
    });
  } catch (err) {
    console.error('precio.solicitarCambio error', err);
    return res.status(500).json({ msg: 'Error al crear solicitud' });
  }
};

exports.aprobarCambio = async (req, res) => {
  const { Solicitud_Id, CodigoAprobacion } = req.body || {};

  try {
    const solicitud = await pool.request()
      .input('id', sql.Int, Solicitud_Id)
      .query('SELECT * FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Solicitud_Id = @id');

    if (!solicitud.recordset.length) {
      return res.status(404).json({ msg: 'Solicitud no encontrada' });
    }

    const sol = solicitud.recordset[0];
    if (sol.Estado !== 'PENDIENTE') {
      return res.status(400).json({ msg: 'La solicitud ya fue procesada' });
    }
    if (sol.CodigoAprobacion !== CodigoAprobacion) {
      return res.status(400).json({ msg: 'Codigo de aprobacion incorrecto' });
    }

    await pool.request()
      .input('id', sql.Int, sol.Producto_Id)
      .input('precio', sql.Decimal(18, 2), Number(sol.PrecioNuevo))
      .query('UPDATE ERP_PRODUCTOS SET Precio = @precio WHERE Producto_Id = @id');

    await pool.request()
      .input('id', sql.Int, Solicitud_Id)
      .input('aprobador', sql.Int, req.user?.User_Id || null)
      .query(`
        UPDATE ERP_SOLICITUD_CAMBIO_PRECIO
        SET Estado = 'APROBADO',
            AprobadoPor = @aprobador,
            FechaAprobacion = GETDATE()
        WHERE Solicitud_Id = @id
      `);

    return res.json({ msg: 'Cambio de precio aprobado y aplicado' });
  } catch (err) {
    console.error('precio.aprobarCambio error', err);
    return res.status(500).json({ msg: 'Error al aprobar cambio' });
  }
};

exports.listarSolicitudes = async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT s.*, p.SKU, p.Nombre, u.Username AS Solicitante
      FROM ERP_SOLICITUD_CAMBIO_PRECIO s
      INNER JOIN ERP_PRODUCTOS p ON s.Producto_Id = p.Producto_Id
      LEFT JOIN ERP_USERS u ON s.SolicitadoPor = u.User_Id
      ORDER BY s.FechaSolicitud DESC
    `);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('precio.listarSolicitudes error', err);
    res.status(500).json({ msg: 'Error al listar solicitudes' });
  }
};

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
    console.error('precio.eliminarSolicitud error', err);
    res.status(500).json({ msg: 'Error al eliminar solicitud' });
  }
};

exports.listarNiveles = async (req, res) => {
  try {
    await ensurePriceTierTable();
    const { productoId } = req.query || {};
    const request = pool.request();
    let where = 'WHERE n.Activo = 1';

    if (productoId) {
      where += ' AND n.Producto_Id = @Producto_Id';
      request.input('Producto_Id', sql.Int, Number(productoId));
    }

    const result = await request.query(`
      SELECT n.*, p.SKU, p.Nombre, p.Precio AS PrecioBase
      FROM ERP_PRECIO_NIVEL n
      INNER JOIN ERP_PRODUCTOS p ON p.Producto_Id = n.Producto_Id
      ${where}
      ORDER BY p.Nombre, n.NombreLista, n.CantidadMinima
    `);

    res.json(result.recordset || []);
  } catch (err) {
    console.error('precio.listarNiveles error', err);
    res.status(500).json({ msg: 'Error al obtener escalas de precio' });
  }
};

exports.guardarNivel = async (req, res) => {
  try {
    await ensurePriceTierTable();
    const {
      PrecioNivel_Id,
      Producto_Id,
      NombreLista,
      CantidadMinima,
      CantidadMaxima,
      DescuentoPct,
      PrecioFijo,
    } = req.body || {};

    if (!Producto_Id || !NombreLista || CantidadMinima === undefined) {
      return res.status(400).json({ msg: 'Producto_Id, NombreLista y CantidadMinima son requeridos' });
    }

    const result = await pool.request()
      .input('PrecioNivel_Id', sql.Int, PrecioNivel_Id ? Number(PrecioNivel_Id) : null)
      .input('Producto_Id', sql.Int, Number(Producto_Id))
      .input('NombreLista', sql.NVarChar(120), String(NombreLista).trim())
      .input('CantidadMinima', sql.Decimal(18, 4), Number(CantidadMinima))
      .input('CantidadMaxima', sql.Decimal(18, 4), CantidadMaxima !== '' && CantidadMaxima !== null && CantidadMaxima !== undefined ? Number(CantidadMaxima) : null)
      .input('DescuentoPct', sql.Decimal(9, 4), Number(DescuentoPct || 0))
      .input('PrecioFijo', sql.Decimal(18, 6), PrecioFijo !== '' && PrecioFijo !== null && PrecioFijo !== undefined ? Number(PrecioFijo) : null)
      .input('CreadoPor', sql.Int, req.user?.User_Id || null)
      .query(`
        IF @PrecioNivel_Id IS NULL
        BEGIN
          INSERT INTO ERP_PRECIO_NIVEL (
            Producto_Id, NombreLista, CantidadMinima, CantidadMaxima, DescuentoPct, PrecioFijo, CreadoPor
          )
          OUTPUT INSERTED.*
          VALUES (
            @Producto_Id, @NombreLista, @CantidadMinima, @CantidadMaxima, @DescuentoPct, @PrecioFijo, @CreadoPor
          );
        END
        ELSE
        BEGIN
          UPDATE ERP_PRECIO_NIVEL
          SET NombreLista = @NombreLista,
              CantidadMinima = @CantidadMinima,
              CantidadMaxima = @CantidadMaxima,
              DescuentoPct = @DescuentoPct,
              PrecioFijo = @PrecioFijo,
              UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE PrecioNivel_Id = @PrecioNivel_Id;
        END
      `);

    res.status(201).json(result.recordset?.[0] || null);
  } catch (err) {
    console.error('precio.guardarNivel error', err);
    res.status(500).json({ msg: 'Error al guardar la escala de precio' });
  }
};

exports.eliminarNivel = async (req, res) => {
  try {
    await ensurePriceTierTable();
    const id = Number(req.params.id);
    const result = await pool.request()
      .input('PrecioNivel_Id', sql.Int, id)
      .query(`
        UPDATE ERP_PRECIO_NIVEL
        SET Activo = 0,
            UpdatedAt = GETDATE()
        WHERE PrecioNivel_Id = @PrecioNivel_Id
      `);

    if (!result.rowsAffected?.[0]) {
      return res.status(404).json({ msg: 'Escala de precio no encontrada' });
    }

    res.json({ msg: 'Escala eliminada' });
  } catch (err) {
    console.error('precio.eliminarNivel error', err);
    res.status(500).json({ msg: 'Error al eliminar la escala de precio' });
  }
};

module.exports = exports;
