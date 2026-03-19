const { pool, sql } = require('../config/db');

// GET /api/clients/:id/recurring-products - Obtener productos recurrentes del cliente
exports.getRecurringProducts = async (req, res) => {
  const clientId = Number(req.params.id);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ msg: 'Id inválido' });
  
  try {
    await pool.connect();
    const result = await pool.request()
      .input('clientId', sql.Int, clientId)
      .query(`
        SELECT 
          rp.RecurringProduct_Id,
          rp.Client_Id,
          rp.Producto_Id,
          rp.CreatedAt,
          p.SKU,
          p.Nombre,
          p.Descripcion,
          p.Precio,
          p.TipoMoneda,
          p.ClaveProdServSAT,
          p.ClaveUnidadSAT,
          p.ImpuestoIVA
        FROM ERP_CLIENT_RECURRING_PRODUCTS rp
        INNER JOIN ERP_PRODUCTOS p ON rp.Producto_Id = p.Producto_Id
        WHERE rp.Client_Id = @clientId AND p.Activo = 1
        ORDER BY p.Nombre
      `);
    
    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    console.error('getRecurringProducts error', err);
    res.status(500).json({ success: false, msg: 'Error obteniendo productos recurrentes' });
  }
};

// POST /api/clients/:id/recurring-products - Agregar producto recurrente
exports.addRecurringProduct = async (req, res) => {
  const clientId = Number(req.params.id);
  const { Producto_Id } = req.body;
  
  if (!clientId || isNaN(clientId)) return res.status(400).json({ msg: 'Id de cliente inválido' });
  if (!Producto_Id) return res.status(400).json({ msg: 'Producto_Id es requerido' });
  
  try {
    await pool.connect();
    
    // Verificar que el producto existe y está activo
    const producto = await pool.request()
      .input('productoId', sql.Int, Producto_Id)
      .query('SELECT Producto_Id FROM ERP_PRODUCTOS WHERE Producto_Id = @productoId AND Activo = 1');
    
    if (!producto.recordset || producto.recordset.length === 0) {
      return res.status(404).json({ msg: 'Producto no encontrado o inactivo' });
    }
    
    // Insertar producto recurrente (si ya existe, la constraint UNIQUE lo evitará)
    await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('productoId', sql.Int, Producto_Id)
      .query(`
        INSERT INTO ERP_CLIENT_RECURRING_PRODUCTS (Client_Id, Producto_Id)
        VALUES (@clientId, @productoId)
      `);
    
    res.status(201).json({ success: true, msg: 'Producto recurrente agregado' });
  } catch (err) {
    console.error('addRecurringProduct error', err);
    if (err.number === 2627) { // Duplicate key
      return res.status(409).json({ msg: 'El producto ya está en la lista de recurrentes' });
    }
    res.status(500).json({ msg: 'Error agregando producto recurrente' });
  }
};

// DELETE /api/clients/:id/recurring-products/:productId - Eliminar producto recurrente
exports.removeRecurringProduct = async (req, res) => {
  const clientId = Number(req.params.id);
  const productId = Number(req.params.productId);
  
  if (!clientId || isNaN(clientId)) return res.status(400).json({ msg: 'Id de cliente inválido' });
  if (!productId || isNaN(productId)) return res.status(400).json({ msg: 'Id de producto inválido' });
  
  try {
    await pool.connect();
    await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('productId', sql.Int, productId)
      .query('DELETE FROM ERP_CLIENT_RECURRING_PRODUCTS WHERE Client_Id = @clientId AND Producto_Id = @productId');
    
    res.json({ success: true, msg: 'Producto recurrente eliminado' });
  } catch (err) {
    console.error('removeRecurringProduct error', err);
    res.status(500).json({ msg: 'Error eliminando producto recurrente' });
  }
};

module.exports = exports;
