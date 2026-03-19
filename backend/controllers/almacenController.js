const { pool, sql } = require("../config/db");

// GET /api/almacenes - Listar almacenes
exports.list = async (req, res) => {
  try {
    const { company_id } = req.query;
    let query = `
      SELECT a.[Almacen_Id], a.[Nombre], a.[Codigo], a.[Direccion], a.[Activo], a.[FechaCreacion], a.[Company_Id],
             c.NameCompany
      FROM ERP_ALMACENES a
      LEFT JOIN ERP_COMPANY c ON a.Company_Id = c.Company_Id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    // Filtrar por empresa del usuario si no es admin
    // usuarios sin compañías ligadas no deben ver ningún almacén
    if (!req.isAdmin) {
      if (req.userCompanies && req.userCompanies.length > 0) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((cid, idx) => {
          request.input(`userCompany${idx}`, sql.Int, cid);
        });
        query += ` AND a.Company_Id IN (${placeholders})`;
      } else {
        // no hay empresas asignadas -> devolver lista vacía directamente
        return res.json([]);
      }
    } else if (company_id) {
      // administrador puede filtrar manualmente por query param
      query += ` AND a.Company_Id = @company_id`;
      request.input('company_id', sql.Int, company_id);
    }
    
    query += ` ORDER BY a.Nombre`;
    
    const result = await request.query(query);
    res.json(result.recordset || []);
  } catch (err) {
    console.error("almacenes.list error", err);
    res.status(500).json({ msg: "Error al obtener almacenes" });
  }
};

// GET /api/almacenes/:id - Obtener almacén por ID
exports.get = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: "Id inválido" });

  try {
    // incluir filtro de empresa en la consulta individual también
    let getQuery = `
        SELECT [Almacen_Id], [Nombre], [Codigo], [Direccion], [Activo], [FechaCreacion], Company_Id
        FROM ERP_ALMACENES
        WHERE Almacen_Id = @id`;

    const getRequest = pool.request().input("id", sql.Int, id);

    if (!req.isAdmin) {
      if (req.userCompanies && req.userCompanies.length > 0) {
        const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
        req.userCompanies.forEach((cid, idx) => {
          getRequest.input(`userCompany${idx}`, sql.Int, cid);
        });
        getQuery += ` AND Company_Id IN (${placeholders})`;
      } else {
        return res.status(404).json({ msg: "Almacén no encontrado" });
      }
    }

    const result = await getRequest.query(getQuery);

    const almacen = result.recordset && result.recordset[0];
    if (!almacen) return res.status(404).json({ msg: "Almacén no encontrado" });

    res.json(almacen);
  } catch (err) {
    console.error("almacenes.get error", err);
    res.status(500).json({ msg: "Error al obtener almacén" });
  }
};

// POST /api/almacenes - Crear almacén
exports.create = async (req, res) => {
  const { Nombre, Codigo, Direccion, Activo, Company_Id } = req.body || {};

  if (!Nombre || !Codigo) {
    return res.status(400).json({ msg: "Campos requeridos: Nombre, Codigo" });
  }

  try {
    const result = await pool.request()
      .input("Nombre", sql.VarChar, Nombre)
      .input("Codigo", sql.VarChar, Codigo)
      .input("Direccion", sql.VarChar, Direccion || null)
      .input("Activo", sql.Bit, Activo === false ? 0 : 1)
      .input("Company_Id", sql.Int, Company_Id || null)
      .query(`
        INSERT INTO ERP_ALMACENES (Nombre, Codigo, Direccion, Activo, Company_Id, FechaCreacion)
        VALUES (@Nombre, @Codigo, @Direccion, @Activo, @Company_Id, GETDATE());
        SELECT SCOPE_IDENTITY() AS Almacen_Id;
      `);

    const id = result.recordset[0].Almacen_Id;
    res.status(201).json({ msg: "Almacén creado", Almacen_Id: id });
  } catch (err) {
    console.error("almacenes.create error", err);
    if (err.number === 2627) {
      return res.status(409).json({ msg: "El código de almacén ya existe" });
    }
    res.status(500).json({ msg: "Error al crear almacén" });
  }
};

// PUT /api/almacenes/:id - Actualizar almacén
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: "Id inválido" });

  const { Nombre, Codigo, Direccion, Activo, Company_Id } = req.body || {};

  try {
    await pool.request()
      .input("id", sql.Int, id)
      .input("Nombre", sql.VarChar, Nombre)
      .input("Codigo", sql.VarChar, Codigo)
      .input("Direccion", sql.VarChar, Direccion || null)
      .input("Activo", sql.Bit, Activo === false ? 0 : 1)
      .input("Company_Id", sql.Int, Company_Id || null)
      .query(`
        UPDATE ERP_ALMACENES
        SET Nombre = @Nombre,
            Codigo = @Codigo,
            Direccion = @Direccion,
            Activo = @Activo,
            Company_Id = @Company_Id
        WHERE Almacen_Id = @id;
      `);

    res.json({ msg: "Almacén actualizado" });
  } catch (err) {
    console.error("almacenes.update error", err);
    res.status(500).json({ msg: "Error al actualizar almacén" });
  }
};

// DELETE /api/almacenes/:id - Eliminar almacén (opcionalmente físico)
exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ msg: "Id inválido" });

  try {
    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM ERP_ALMACENES WHERE Almacen_Id = @id;
      `);

    res.json({ msg: "Almacén eliminado" });
  } catch (err) {
    console.error("almacenes.remove error", err);
    res.status(500).json({ msg: "Error al eliminar almacén" });
  }
};
