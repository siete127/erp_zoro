const { pool, sql } = require("../config/db");
const { searchProductsOrServices, searchUnits } = require("../services/facturamaService");

// GET /api/sat/prodserv - Buscar productos/servicios SAT
exports.searchProdServ = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT Clave, Descripcion FROM SAT_CLAVE_PRODSERV WHERE 1=1`;
    const request = pool.request();

    if (search && String(search).trim().length >= 2) {
      query += ` AND (Clave LIKE @search OR Descripcion LIKE @search)`;
      request.input("search", sql.VarChar, `%${search}%`);
    }

    query += ` ORDER BY Clave OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, parseInt(limit));

    const result = await request.query(query);

    // Si hay resultados en nuestro catálogo local SAT, los devolvemos tal cual
    if (result.recordset && result.recordset.length > 0) {
      return res.json({
        data: result.recordset,
        hasMore: result.recordset.length === parseInt(limit)
      });
    }

    // Si no hay resultados locales y hay término de búsqueda,
    // consultamos directamente el catálogo de Facturama
    if (search && String(search).trim().length >= 2) {
      try {
        const remote = await searchProductsOrServices(search);

        // Mapeamos el formato de Facturama al esperado por el frontend
        // y filtramos la entrada genérica "No existe en el catálogo"
        const mapped = (remote || [])
          .filter(item => item?.Name && item.Name !== "No existe en el catálogo")
          .map(item => ({
            Clave: item.Value,
            Descripcion: item.Name
          }));

        return res.json({
          data: mapped,
          hasMore: false
        });
      } catch (remoteErr) {
        console.error("sat.searchProdServ Facturama fallback error", remoteErr);
        // Si falla Facturama, devolvemos lista vacía para que el frontend
        // solo muestre "No se encontraron resultados" sin romper
        return res.json({ data: [], hasMore: false });
      }
    }

    // Sin término de búsqueda o sin resultados, devolvemos lista vacía
    res.json({
      data: [],
      hasMore: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al buscar productos/servicios SAT" });
  }
};

// GET /api/sat/unidades - Buscar unidades SAT
exports.searchUnidades = async (req, res) => {
  try {
    const { search = "" } = req.query;

    // Si no hay término de búsqueda suficiente, no llamamos a Facturama
    if (!search || String(search).trim().length < 2) {
      return res.json({ data: [], hasMore: false });
    }

    // Consultar directamente el catálogo de unidades de Facturama
    const remote = await searchUnits(search);

    // Mapeamos al formato esperado por el frontend (Clave, Nombre, Descripcion, Simbolo)
    const mapped = (remote || []).map((item) => ({
      Clave: item.Value || item.Key || item.Clave || "",
      Nombre: item.Name || item.Nombre || "",
      Descripcion: item.Description || item.Descripcion || "",
      Simbolo: item.Symbol || item.Simbolo || null,
    })).filter(u => u.Clave && u.Nombre);

    return res.json({
      data: mapped,
      hasMore: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al buscar unidades SAT" });
  }
};

// GET /api/sat/prodserv/:clave - Obtener detalle de producto/servicio SAT
exports.getProdServ = async (req, res) => {
  try {
    const result = await pool.request()
      .input("clave", sql.VarChar, req.params.clave)
      .query("SELECT * FROM SAT_CLAVE_PRODSERV WHERE Clave = @clave");

    if (result.recordset.length === 0) {
      return res.status(404).json({ msg: "Clave no encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener producto/servicio SAT" });
  }
};

// GET /api/sat/unidades/:clave - Obtener detalle de unidad SAT
exports.getUnidad = async (req, res) => {
  try {
    const result = await pool.request()
      .input("clave", sql.VarChar, req.params.clave)
      .query("SELECT * FROM SAT_UNIDADES WHERE Clave = @clave");

    if (result.recordset.length === 0) {
      return res.status(404).json({ msg: "Clave no encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener unidad SAT" });
  }
};
