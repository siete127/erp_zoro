const { pool, sql } = require("../config/db");
const XLSX = require("xlsx");
const { searchProductsOrServices } = require("../services/facturamaService");
const {
  listProductoInventarioConfig,
  replaceProductoInventarioConfig,
  upsertProductoInventarioConfig,
  normalizeClasificacionInventario,
} = require("../services/inventoryControlService");

// Función para normalizar nombres de columnas del Excel
const normalizeKey = (key) => {
  if (!key) return "";
  return String(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-zA-Z0-9]/g, "") // quitar espacios y símbolos
    .toLowerCase();
};

// Mapeo de posibles nombres de columnas a los esperados por el sistema
const headerMap = {
  sku: "SKU",
  codigo: "SKU",
  codigoproducto: "SKU",
  clave: "SKU", // en tu Excel esta es la clave interna del producto

  nombre: "Nombre",
  nombreproducto: "Nombre",

  descripcion: "Descripcion", // "Descripción" del Excel

  precio: "Precio",
  preciounitario: "Precio",
  precioventa: "Precio",
  preciove: "Precio",

  tipomoneda: "TipoMoneda",
  moneda: "TipoMoneda",
  tipodemoneda: "TipoMoneda",
  currency: "TipoMoneda",
  divisa: "TipoMoneda",

  // Clave de producto/servicio SAT: "Clave sat" en tu Excel
  claveprodservsat: "ClaveProdServSAT",
  claveprodserv: "ClaveProdServSAT",
  claveproducto: "ClaveProdServSAT",
  clavesat: "ClaveProdServSAT",

  // Unidad SAT: "Unidad de" en tu Excel
  claveunidadsat: "ClaveUnidadSAT",
  claveunidad: "ClaveUnidadSAT",
  unidadsat: "ClaveUnidadSAT",
  unidadde: "ClaveUnidadSAT",
  unidad: "ClaveUnidadSAT",

  impuestoiva: "ImpuestoIVA",
  iva: "ImpuestoIVA",

  activo: "Activo",
  estatus: "Activo",
  status: "Activo"
};

const buildInventoryConfigPayload = (inventoryConfig, companies, body = {}) => {
  if (Array.isArray(inventoryConfig)) {
    return inventoryConfig;
  }

  const hasInlineConfig = body.Almacen_Id || body.ClasificacionInventario;
  if (!hasInlineConfig) {
    return undefined;
  }

  const companyIds = Array.isArray(companies) && companies.length > 0
    ? companies
    : [body.Company_Id || body.company_id].filter(Boolean);

  if (companyIds.length === 0) {
    return undefined;
  }

  return companyIds.map((companyId) => ({
    Company_Id: Number(companyId),
    Almacen_Id: body.Almacen_Id ? Number(body.Almacen_Id) : null,
    ClasificacionInventario: normalizeClasificacionInventario(body.ClasificacionInventario),
    Activo: body.ConfiguracionInventarioActiva !== false,
  }));
};

// GET /api/productos - Listar productos
exports.list = async (req, res) => {
  try {
    const { page, limit, search = "", activo, company_id } = req.query;

    let query = `SELECT * FROM ERP_PRODUCTOS WHERE 1=1`;
    const request = pool.request();

    if (search) {
      query += ` AND (SKU LIKE @search OR Nombre LIKE @search OR Descripcion LIKE @search)`;
      request.input("search", sql.VarChar, `%${search}%`);
    }

    // Por defecto mostrar solo productos activos, a menos que se especifique lo contrario
    if (activo !== undefined) {
      query += ` AND Activo = @activo`;
      request.input("activo", sql.Bit, activo === "true" ? 1 : 0);
    } else {
      query += ` AND Activo = 1`;
    }

    // Filtrar por empresa
    let companyFilter = company_id;
    if (!req.isAdmin && req.userCompanies && req.userCompanies.length > 0) {
      // Usuario no admin: solo sus empresas
      const placeholders = req.userCompanies.map((_, idx) => `@userCompany${idx}`).join(',');
      req.userCompanies.forEach((cid, idx) => {
        request.input(`userCompany${idx}`, sql.Int, cid);
      });
      query += ` AND EXISTS (SELECT 1 FROM ERP_PRODUCTO_EMPRESA pe WHERE pe.Producto_Id = ERP_PRODUCTOS.Producto_Id AND pe.Company_Id IN (${placeholders}))`;
    } else if (companyFilter && companyFilter !== "all") {
      // Admin con filtro específico
      query += " AND EXISTS (SELECT 1 FROM ERP_PRODUCTO_EMPRESA pe WHERE pe.Producto_Id = ERP_PRODUCTOS.Producto_Id AND pe.Company_Id = @company_id)";
      request.input("company_id", sql.Int, parseInt(companyFilter));
    }

    const countResult = await request.query(`SELECT COUNT(*) as total FROM (${query}) as T`);
    const total = countResult.recordset[0].total;

    query += ` ORDER BY Producto_Id DESC`;

    // Si se especifica paginación, aplicarla
    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
      request.input("offset", sql.Int, offset);
      request.input("limit", sql.Int, parseInt(limit));
    }

    const result = await request.query(query);

    const response = { data: result.recordset };

    // Solo incluir paginación si se solicitó
    if (page && limit) {
      response.pagination = {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      };
    } else {
      response.total = total;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener productos" });
  }
};

// GET /api/productos/:id - Obtener producto por ID
exports.get = async (req, res) => {
  try {
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM ERP_PRODUCTOS WHERE Producto_Id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ msg: "Producto no encontrado" });
    }

    const producto = result.recordset[0];

    // Obtener empresas asignadas
    const empresas = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`SELECT c.Company_Id, c.NameCompany 
              FROM ERP_PRODUCTO_EMPRESA pe 
              INNER JOIN ERP_COMPANY c ON pe.Company_Id = c.Company_Id 
              WHERE pe.Producto_Id = @id`);

    producto.companies = empresas.recordset || [];
    producto.inventoryConfig = await listProductoInventarioConfig(req.params.id);

    res.json(producto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener producto" });
  }
};

// POST /api/productos - Crear producto
exports.create = async (req, res) => {
  const { SKU, Nombre, Descripcion, Precio, TipoMoneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo, companies, inventoryConfig } = req.body;
  let transaction;

  if (!SKU || !Nombre || !ClaveProdServSAT || !ClaveUnidadSAT) {
    return res.status(400).json({ msg: "Campos requeridos: SKU, Nombre, ClaveProdServSAT, ClaveUnidadSAT" });
  }

  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Validar claves SAT
    const validProdServ = await new sql.Request(transaction)
      .input("clave", sql.VarChar, ClaveProdServSAT)
      .query("SELECT Clave FROM SAT_CLAVE_PRODSERV WHERE Clave = @clave");

    if (validProdServ.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ msg: `ClaveProdServSAT ${ClaveProdServSAT} no existe en catálogo SAT` });
    }

    const validUnidad = await new sql.Request(transaction)
      .input("clave", sql.VarChar, ClaveUnidadSAT)
      .query("SELECT Clave FROM SAT_UNIDADES WHERE Clave = @clave");

    if (validUnidad.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ msg: `ClaveUnidadSAT ${ClaveUnidadSAT} no existe en catálogo SAT` });
    }

    const result = await new sql.Request(transaction)
      .input("SKU", sql.VarChar, SKU)
      .input("Nombre", sql.VarChar, Nombre)
      .input("Descripcion", sql.VarChar, Descripcion || null)
      .input("Precio", sql.Decimal(18, 2), Precio || 0)
      .input("TipoMoneda", sql.VarChar, TipoMoneda || null)
      .input("ClaveProdServSAT", sql.VarChar, ClaveProdServSAT)
      .input("ClaveUnidadSAT", sql.VarChar, ClaveUnidadSAT)
      .input("ImpuestoIVA", sql.Decimal(5, 2), ImpuestoIVA || 16.00)
      .input("Activo", sql.Bit, Activo !== false ? 1 : 0)
      .input("CreadoPor", sql.Int, req.user?.User_Id || null)
      .query(`INSERT INTO ERP_PRODUCTOS (SKU, Nombre, Descripcion, Precio, TipoMoneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo, CreadoPor)
              VALUES (@SKU, @Nombre, @Descripcion, @Precio, @TipoMoneda, @ClaveProdServSAT, @ClaveUnidadSAT, @ImpuestoIVA, @Activo, @CreadoPor);
              SELECT SCOPE_IDENTITY() AS Producto_Id`);

    const productoId = result.recordset[0].Producto_Id;

    // Asignar empresas
    if (companies && Array.isArray(companies) && companies.length > 0) {
      for (const companyId of companies) {
        await new sql.Request(transaction)
          .input("Producto_Id", sql.Int, productoId)
          .input("Company_Id", sql.Int, companyId)
          .query("INSERT INTO ERP_PRODUCTO_EMPRESA (Producto_Id, Company_Id) VALUES (@Producto_Id, @Company_Id)");
      }
    }

    const configPayload = buildInventoryConfigPayload(inventoryConfig, companies, req.body);
    if (configPayload) {
      await replaceProductoInventarioConfig(productoId, configPayload, req.user?.Username || req.user?.email || null, transaction);
    }

    await transaction.commit();

    res.status(201).json({ msg: "Producto creado", Producto_Id: productoId });
  } catch (err) {
    console.error(err);
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    if (err.number === 2627) {
      return res.status(409).json({ msg: "El SKU ya existe" });
    }
    res.status(500).json({ msg: "Error al crear producto", error: err.message });
  }
};

// PUT /api/productos/:id - Actualizar producto
exports.update = async (req, res) => {
  const { Nombre, Descripcion, Precio, TipoMoneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo, companies, inventoryConfig } = req.body;
  let transaction;

  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    await new sql.Request(transaction)
      .input("id", sql.Int, req.params.id)
      .input("Nombre", sql.VarChar, Nombre)
      .input("Descripcion", sql.VarChar, Descripcion || null)
      .input("Precio", sql.Decimal(18, 2), Precio)
      .input("TipoMoneda", sql.VarChar, TipoMoneda || null)
      .input("ClaveProdServSAT", sql.VarChar, ClaveProdServSAT)
      .input("ClaveUnidadSAT", sql.VarChar, ClaveUnidadSAT)
      .input("ImpuestoIVA", sql.Decimal(5, 2), ImpuestoIVA)
      .input("Activo", sql.Bit, Activo ? 1 : 0)
      .input("ActualizadoPor", sql.Int, req.user?.User_Id || null)
      .query(`UPDATE ERP_PRODUCTOS SET Nombre = @Nombre, Descripcion = @Descripcion, Precio = @Precio, 
              TipoMoneda = @TipoMoneda, ClaveProdServSAT = @ClaveProdServSAT, ClaveUnidadSAT = @ClaveUnidadSAT,
              ImpuestoIVA = @ImpuestoIVA, Activo = @Activo, FechaActualizacion = GETDATE(), ActualizadoPor = @ActualizadoPor
              WHERE Producto_Id = @id`);

    // Actualizar empresas asignadas
    if (companies !== undefined && Array.isArray(companies)) {
      // Eliminar asignaciones existentes
      await new sql.Request(transaction)
        .input("id", sql.Int, req.params.id)
        .query("DELETE FROM ERP_PRODUCTO_EMPRESA WHERE Producto_Id = @id");

      // Insertar nuevas asignaciones
      for (const companyId of companies) {
        await new sql.Request(transaction)
          .input("Producto_Id", sql.Int, req.params.id)
          .input("Company_Id", sql.Int, companyId)
          .query("INSERT INTO ERP_PRODUCTO_EMPRESA (Producto_Id, Company_Id) VALUES (@Producto_Id, @Company_Id)");
      }
    }

    const configPayload = buildInventoryConfigPayload(inventoryConfig, companies, req.body);
    if (configPayload !== undefined) {
      await replaceProductoInventarioConfig(Number(req.params.id), configPayload, req.user?.Username || req.user?.email || null, transaction);
    } else if (companies !== undefined && Array.isArray(companies)) {
      const existingConfig = await listProductoInventarioConfig(req.params.id, transaction);
      const allowedCompanies = new Set(companies.map((companyId) => Number(companyId)));
      const filteredConfig = existingConfig.filter((config) => allowedCompanies.has(Number(config.Company_Id)));
      await replaceProductoInventarioConfig(Number(req.params.id), filteredConfig, req.user?.Username || req.user?.email || null, transaction);
    }

    await transaction.commit();

    res.json({ msg: "Producto actualizado" });
  } catch (err) {
    console.error(err);
    if (transaction) {
      try { await transaction.rollback(); } catch (_) { }
    }
    res.status(500).json({ msg: "Error al actualizar producto", error: err.message });
  }
};

// DELETE /api/productos/:id - Eliminar producto
exports.remove = async (req, res) => {
  try {
    const id = req.params.id;

    // Eliminar detalle de solicitudes de precio
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_SOLICITUD_PRECIO_DETALLE WHERE Producto_Id = @id");

    // Eliminar solicitudes de cambio de precio
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_SOLICITUD_CAMBIO_PRECIO WHERE Producto_Id = @id");

    // Eliminar precios cliente-producto
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_PRECIOS_CLIENTE_PRODUCTO WHERE Producto_Id = @id");

    // Eliminar productos recurrentes de clientes
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_CLIENT_RECURRING_PRODUCTS WHERE Producto_Id = @id");

    // Eliminar detalle de cotizaciones
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_COTIZACION_DETALLE WHERE ID_PRODUCTO = @id");

    // Eliminar movimientos de kardex
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_KARDEX WHERE Producto_Id = @id");

    // Eliminar stock
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_STOCK WHERE Producto_Id = @id");

    // Eliminar configuración de almacén por empresa
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_PRODUCTO_ALMACEN_CONFIG WHERE Producto_Id = @id");

    // Eliminar relaciones con empresas
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_PRODUCTO_EMPRESA WHERE Producto_Id = @id");

    // Eliminar el producto
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM ERP_PRODUCTOS WHERE Producto_Id = @id");

    res.json({ msg: "Producto eliminado" });
  } catch (err) {
    console.error("Error al eliminar producto:", err);
    res.status(500).json({ msg: "Error al eliminar producto", error: err.message });
  }
};

// POST /api/productos/importar - Importar desde Excel
exports.importar = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ msg: "No se recibió archivo" });
    }

    const companyIdRaw = req.body?.Company_Id || req.body?.company_id;
    const companyId = companyIdRaw ? Number(companyIdRaw) : null;

    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({ msg: "Debe indicar Company_Id para asociar los productos importados a una empresa" });
    }

    const file = req.files.file;
    const workbook = XLSX.read(file.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ msg: "El archivo está vacío" });
    }

    const errores = [];
    let exitosas = 0;
    let conError = 0;

    // Cargar catálogos SAT una sola vez
    const [prodServCat, unidadesCat] = await Promise.all([
      pool.request().query("SELECT Clave FROM SAT_CLAVE_PRODSERV"),
      pool.request().query("SELECT Clave, Nombre, Simbolo FROM SAT_UNIDADES")
    ]);

    const satProdServSet = new Set(
      (prodServCat.recordset || []).map((r) => String(r.Clave).trim().toUpperCase())
    );
    const satUnidadesSet = new Set(
      (unidadesCat.recordset || []).map((r) => String(r.Clave).trim().toUpperCase())
    );

    // Diccionarios auxiliares para mapear símbolos (PZA, KG, etc.) o nombres a la clave SAT
    const satUnidadesBySimbolo = new Map();
    const satUnidadesByNombre = new Map();
    for (const r of unidadesCat.recordset || []) {
      const clave = String(r.Clave).trim().toUpperCase();
      if (r.Simbolo) {
        satUnidadesBySimbolo.set(String(r.Simbolo).trim().toUpperCase(), clave);
      }
      if (r.Nombre) {
        satUnidadesByNombre.set(String(r.Nombre).trim().toUpperCase(), clave);
      }
    }
    const satUnidadesNombreEntries = Array.from(satUnidadesByNombre.entries());

    // Normalizar todas las filas y recolectar SKUs únicos
    const filasNormalizadas = [];
    const skuValores = new Set();

    for (let i = 0; i < data.length; i++) {
      const originalRow = data[i];
      const row = { ...originalRow };

      for (const [key, value] of Object.entries(originalRow)) {
        const nk = normalizeKey(key);
        let target = headerMap[nk];

        if (!target && nk.includes("unidad")) {
          target = "ClaveUnidadSAT";
        }

        if (!target && (nk.includes("claveprodserv") || nk.includes("clavesat"))) {
          target = "ClaveProdServSAT";
        }

        if (target && row[target] === undefined) {
          row[target] = value;
        }
      }

      if (!row.Nombre) {
        if (row.Descripcion) {
          row.Nombre = String(row.Descripcion).substring(0, 200);
        } else if (row.SKU) {
          row.Nombre = String(row.SKU);
        }
      }

      const fila = i + 2; // +2 porque Excel empieza en 1 y tiene header

      if (row.SKU) {
        skuValores.add(String(row.SKU));
      }

      filasNormalizadas.push({ fila, row });
    }

    // Cargar todos los SKUs existentes en un solo query
    const skuArray = Array.from(skuValores);
    let skusExistentes = new Set();

    if (skuArray.length > 0) {
      const requestSku = pool.request();
      const placeholders = skuArray.map((sku, idx) => {
        const paramName = `sku${idx}`;
        requestSku.input(paramName, sql.VarChar, String(sku));
        return `@${paramName}`;
      });

      const skuQuery = `SELECT SKU FROM ERP_PRODUCTOS WHERE SKU IN (${placeholders.join(",")})`;
      const skuResult = await requestSku.query(skuQuery);
      skusExistentes = new Set(
        (skuResult.recordset || []).map((r) => String(r.SKU))
      );
    }

    for (const item of filasNormalizadas) {
      const { fila, row } = item;

      try {
        // Derivar Nombre si viene vacío: usar Descripcion o SKU
        if (!row.Nombre) {
          if (row.Descripcion) {
            row.Nombre = String(row.Descripcion).substring(0, 200);
          } else if (row.SKU) {
            row.Nombre = String(row.SKU);
          }
        }

        let { SKU, Nombre, Descripcion, Precio, TipoMoneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo } = row;

        // Normalizar moneda: mapear variaciones comunes a código SAT
        if (TipoMoneda) {
          const monedaUpper = String(TipoMoneda).trim().toUpperCase();
          const monedaMap = {
            'MXN': 'MXN', 'PESOS': 'MXN', 'PESO': 'MXN', 'PESO MEXICANO': 'MXN', 'PESOS MEXICANOS': 'MXN', 'MX': 'MXN', 'M.N.': 'MXN', 'MN': 'MXN',
            'USD': 'USD', 'DOLAR': 'USD', 'DOLARES': 'USD', 'DÓLAR': 'USD', 'DÓLARES': 'USD', 'DOLLAR': 'USD', 'DOLLARS': 'USD', 'US': 'USD',
            'EUR': 'EUR', 'EURO': 'EUR', 'EUROS': 'EUR'
          };
          TipoMoneda = monedaMap[monedaUpper] || monedaUpper;
          row.TipoMoneda = TipoMoneda;
        } else {
          // Si no viene moneda en el Excel, asignar MXN por defecto
          TipoMoneda = 'MXN';
          row.TipoMoneda = 'MXN';
        }

        // Validaciones de campos requeridos con detalle de cuáles faltan
        const camposFaltantes = [];
        if (!SKU) camposFaltantes.push("SKU");
        if (!Nombre) camposFaltantes.push("Nombre");
        if (!ClaveProdServSAT) camposFaltantes.push("ClaveProdServSAT");
        if (!ClaveUnidadSAT) camposFaltantes.push("ClaveUnidadSAT");

        if (camposFaltantes.length > 0) {
          errores.push({
            fila,
            error: `Campos requeridos faltantes: ${camposFaltantes.join(", ")}`,
            datos: row
          });
          conError++;
          continue;
        }

        // Normalizar y validar ClaveProdServSAT contra catálogo (case-insensitive).
        // Si no existe en nuestro catálogo local, intentamos:
        // 1) Buscar una clave por descripción en SAT_CLAVE_PRODSERV
        // 2) Consultar Facturama; si la clave existe allá, la insertamos en el catálogo local
        // Si después de esto la clave sigue sin existir, NO intentamos insertar el producto
        // para no violar la FK.
        let claveProdServNorm = String(ClaveProdServSAT).trim().toUpperCase();
        if (!satProdServSet.has(claveProdServNorm)) {
          // Paso 1: intentar encontrar una clave por descripción en el catálogo local
          try {
            const textoBusqueda = `${Nombre || ""} ${Descripcion || ""}`.trim();
            if (textoBusqueda) {
              const reqAlt = pool.request();
              reqAlt.input("search", sql.VarChar, `%${textoBusqueda.substring(0, 40)}%`);
              const altResult = await reqAlt.query(
                "SELECT TOP 1 Clave FROM SAT_CLAVE_PRODSERV WHERE Descripcion LIKE @search ORDER BY Clave"
              );
              if (altResult.recordset && altResult.recordset.length > 0) {
                const altClave = String(altResult.recordset[0].Clave).trim().toUpperCase();
                ClaveProdServSAT = altClave;
                row.ClaveProdServSAT = altClave;
                claveProdServNorm = altClave;
              }
            }
          } catch (e) {
            // Ignorar errores en la búsqueda alternativa local
          }

          // Paso 2: si aún no existe en nuestro catálogo, verificar contra Facturama
          if (!satProdServSet.has(claveProdServNorm)) {
            try {
              const remote = await searchProductsOrServices(ClaveProdServSAT);
              const match = (remote || []).find((item) => {
                const val = String(item.Value || item.Clave || "").trim().toUpperCase();
                return val === claveProdServNorm;
              });

              if (match && match.Name && match.Name !== "No existe en el catálogo") {
                // Insertar la clave faltante en SAT_CLAVE_PRODSERV si no existe
                const reqInsert = pool.request();
                reqInsert
                  .input("Clave", sql.VarChar, claveProdServNorm)
                  .input("Descripcion", sql.VarChar, String(match.Name).substring(0, 500));
                await reqInsert.query(`
                  IF NOT EXISTS (SELECT 1 FROM SAT_CLAVE_PRODSERV WHERE Clave = @Clave)
                  BEGIN
                    INSERT INTO SAT_CLAVE_PRODSERV (Clave, Descripcion)
                    VALUES (@Clave, @Descripcion);
                  END
                `);

                satProdServSet.add(claveProdServNorm);
              }
            } catch (e) {
              // Si Facturama falla, solo registramos el evento y seguimos a la validación final
              console.error(`Error consultando Facturama para ClaveProdServSAT ${ClaveProdServSAT}:`, e.message || e);
            }
          }

          // Validación final: si después de todo la clave sigue sin existir, no intentamos insertar
          if (!satProdServSet.has(claveProdServNorm)) {
            errores.push({
              fila,
              error: `ClaveProdServSAT ${ClaveProdServSAT} no existe en catálogo SAT (ni local ni en Facturama)`,
              datos: row
            });
            conError++;
            continue;
          }
        }

        // Normalizar y validar ClaveUnidadSAT contra catálogo.
        // Si viene símbolo (PZA, KG, etc.) o nombre, lo intentamos mapear a la clave.
        let claveUnidadNorm = String(ClaveUnidadSAT).trim().toUpperCase();
        if (!satUnidadesSet.has(claveUnidadNorm)) {
          // Sinónimos comunes que suelen venir en archivos externos
          if (claveUnidadNorm === "PZ") {
            claveUnidadNorm = "PZA";
          }

          let mappedFromSymbol = satUnidadesBySimbolo.get(claveUnidadNorm);
          let mappedFromName = satUnidadesByNombre.get(claveUnidadNorm);
          let mapped = mappedFromSymbol || mappedFromName;

          // Si no se pudo mapear directamente por símbolo/nombre, intentar inferir
          // una unidad SAT basada en la descripción/nombre del producto.
          if (!mapped) {
            const texto = `${Nombre || ""} ${Descripcion || ""}`.toLowerCase();

            if (/kilo|kilogram|kg\b/.test(texto)) {
              mapped = satUnidadesBySimbolo.get("KG") || satUnidadesByNombre.get("KILOGRAMO") || "KGM";
            } else if (/litro|lt\b|ltr\b/.test(texto)) {
              mapped = satUnidadesByNombre.get("LITRO") || "LTR";
            } else if (/pieza|pza/.test(texto)) {
              mapped = satUnidadesBySimbolo.get("PZA") || satUnidadesByNombre.get("PIEZA") || "H87";
            } else if (/servicio/.test(texto)) {
              mapped = satUnidadesByNombre.get("UNIDAD DE SERVICIO") || "E48";
            } else if (/millares?/.test(texto) || claveUnidadNorm.includes("MILLAR")) {
              // Buscar en catálogo una unidad cuyo nombre contenga MILLAR
              for (const [nombreUpper, claveSat] of satUnidadesNombreEntries) {
                if (nombreUpper.includes("MILLAR")) {
                  mapped = claveSat;
                  break;
                }
              }
            }
          }

          // Último fallback: si sigue sin mapa (por ejemplo T3 u otros códigos internos),
          // usar una unidad genérica válida (PIEZA H87 si existe)
          if (!mapped) {
            if (satUnidadesSet.has("H87")) {
              mapped = "H87";
            } else if (satUnidadesSet.has("E48")) {
              mapped = "E48";
            }
          }

          if (mapped) {
            const mappedNorm = String(mapped).trim().toUpperCase();
            if (satUnidadesSet.has(mappedNorm)) {
              // Reemplazar por la clave oficial para que respete la FK
              ClaveUnidadSAT = mappedNorm;
              row.ClaveUnidadSAT = mappedNorm;
              claveUnidadNorm = mappedNorm;
            } else {
              errores.push({ fila, error: `ClaveUnidadSAT ${ClaveUnidadSAT} no existe en catálogo SAT (mapeo inválido)`, datos: row });
              conError++;
              continue;
            }
          } else {
            errores.push({ fila, error: `ClaveUnidadSAT ${ClaveUnidadSAT} no existe en catálogo SAT y no se pudo inferir por descripción`, datos: row });
            conError++;
            continue;
          }
        }

        // Verificar si existe el SKU usando conjunto precargado
        const skuKey = String(SKU);
        if (skusExistentes.has(skuKey)) {
          let existingProductoId = null;

          // Actualizar datos del producto
          await pool.request()
            .input("SKU", sql.VarChar, String(SKU))
            .input("Nombre", sql.VarChar, String(Nombre))
            .input("Descripcion", sql.VarChar, Descripcion ? String(Descripcion) : null)
            .input("Precio", sql.Decimal(18, 2), parseFloat(Precio) || 0)
            .input("TipoMoneda", sql.VarChar, TipoMoneda ? String(TipoMoneda) : null)
            .input("ClaveProdServSAT", sql.VarChar, String(ClaveProdServSAT))
            .input("ClaveUnidadSAT", sql.VarChar, String(ClaveUnidadSAT))
            .input("ImpuestoIVA", sql.Decimal(5, 2), parseFloat(ImpuestoIVA) || 16.00)
            .input("Activo", sql.Bit, Activo === false || Activo === 0 || Activo === "0" ? 0 : 1)
            .input("ActualizadoPor", sql.Int, req.user?.User_Id || null)
            .query(`UPDATE ERP_PRODUCTOS SET Nombre = @Nombre, Descripcion = @Descripcion, Precio = @Precio,
                    TipoMoneda = @TipoMoneda, ClaveProdServSAT = @ClaveProdServSAT, ClaveUnidadSAT = @ClaveUnidadSAT,
                    ImpuestoIVA = @ImpuestoIVA, Activo = @Activo, FechaActualizacion = GETDATE(), ActualizadoPor = @ActualizadoPor
                    WHERE SKU = @SKU`);

          // Asociar producto existente a la empresa indicada (si no lo está ya)
          const relationResult = await pool.request()
            .input("SKU", sql.VarChar, skuKey)
            .input("Company_Id", sql.Int, companyId)
            .query(`
              INSERT INTO ERP_PRODUCTO_EMPRESA (Producto_Id, Company_Id)
              SELECT p.Producto_Id, @Company_Id
              FROM ERP_PRODUCTOS p
              WHERE p.SKU = @SKU
                AND NOT EXISTS (
                  SELECT 1 FROM ERP_PRODUCTO_EMPRESA pe
                  WHERE pe.Producto_Id = p.Producto_Id AND pe.Company_Id = @Company_Id
                );

              SELECT TOP 1 p.Producto_Id
              FROM ERP_PRODUCTOS p
              WHERE p.SKU = @SKU;
            `);

          existingProductoId = relationResult.recordset?.[0]?.Producto_Id || null;

          if (existingProductoId && (row.Almacen_Id || row.ClasificacionInventario)) {
            await upsertProductoInventarioConfig(existingProductoId, {
              Company_Id: companyId,
              Almacen_Id: row.Almacen_Id ? Number(row.Almacen_Id) : null,
              ClasificacionInventario: row.ClasificacionInventario,
            }, req.user?.Username || req.user?.email || null);
          }
        } else {
          // Insertar nuevo producto
          const insertResult = await pool.request()
            .input("SKU", sql.VarChar, skuKey)
            .input("Nombre", sql.VarChar, String(Nombre))
            .input("Descripcion", sql.VarChar, Descripcion ? String(Descripcion) : null)
            .input("Precio", sql.Decimal(18, 2), parseFloat(Precio) || 0)
            .input("TipoMoneda", sql.VarChar, TipoMoneda ? String(TipoMoneda) : null)
            .input("ClaveProdServSAT", sql.VarChar, String(ClaveProdServSAT))
            .input("ClaveUnidadSAT", sql.VarChar, String(ClaveUnidadSAT))
            .input("ImpuestoIVA", sql.Decimal(5, 2), parseFloat(ImpuestoIVA) || 16.00)
            .input("Activo", sql.Bit, Activo === false || Activo === 0 || Activo === "0" ? 0 : 1)
            .input("CreadoPor", sql.Int, req.user?.User_Id || null)
            .query(`INSERT INTO ERP_PRODUCTOS (SKU, Nombre, Descripcion, Precio, TipoMoneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo, CreadoPor)
                    VALUES (@SKU, @Nombre, @Descripcion, @Precio, @TipoMoneda, @ClaveProdServSAT, @ClaveUnidadSAT, @ImpuestoIVA, @Activo, @CreadoPor);
                    SELECT SCOPE_IDENTITY() AS Producto_Id;`);

          const newProductoId = insertResult.recordset?.[0]?.Producto_Id;

          if (newProductoId) {
            // Asociar nuevo producto a la empresa indicada
            await pool.request()
              .input("Producto_Id", sql.Int, newProductoId)
              .input("Company_Id", sql.Int, companyId)
              .query("INSERT INTO ERP_PRODUCTO_EMPRESA (Producto_Id, Company_Id) VALUES (@Producto_Id, @Company_Id)");

            if (row.Almacen_Id || row.ClasificacionInventario) {
              await upsertProductoInventarioConfig(newProductoId, {
                Company_Id: companyId,
                Almacen_Id: row.Almacen_Id ? Number(row.Almacen_Id) : null,
                ClasificacionInventario: row.ClasificacionInventario,
              }, req.user?.Username || req.user?.email || null);
            }
          }

          // Añadir el nuevo SKU al conjunto para que si aparece de nuevo
          // en el mismo archivo se trate como actualización y no vuelva a intentar INSERT
          skusExistentes.add(skuKey);
        }

        exitosas++;
      } catch (err) {
        console.error(`Error en fila ${fila}:`, err);
        errores.push({ fila, error: err.message, datos: row });
        conError++;
      }
    }

    // Guardar log de importación
    await pool.request()
      .input("NombreArchivo", sql.VarChar, file.name)
      .input("TotalFilas", sql.Int, data.length)
      .input("FilasExitosas", sql.Int, exitosas)
      .input("FilasConError", sql.Int, conError)
      .input("Usuario_Id", sql.Int, req.user?.User_Id || null)
      .input("Errores", sql.VarChar, JSON.stringify(errores))
      .query(`INSERT INTO ERP_IMPORTACIONES_LOG (NombreArchivo, TotalFilas, FilasExitosas, FilasConError, Usuario_Id, Errores)
              VALUES (@NombreArchivo, @TotalFilas, @FilasExitosas, @FilasConError, @Usuario_Id, @Errores)`);

    res.json({
      msg: "Importación completada",
      total: data.length,
      exitosas,
      conError,
      errores: errores.slice(0, 100) // Limitar errores en respuesta
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al importar productos", error: err.message });
  }
};
