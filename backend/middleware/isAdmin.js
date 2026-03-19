const { pool, sql } = require('../config/db');

// Middleware para verificar si el usuario es administrador
const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.User_Id || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ msg: 'No autorizado' });
    }

    await pool.connect();
    const result = await pool.request()
      .input('User_Id', sql.Int, userId)
      .query(`
        SELECT u.User_Id, r.Name as RolName
        FROM ERP_USERS u
        LEFT JOIN ERP_ROL r ON u.RolId = r.Rol_Id
        WHERE u.User_Id = @User_Id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const rolName = result.recordset[0].RolName || '';
    
    // Verificar si es administrador o superadministrador
    if (!/administrador|admin/i.test(rolName)) {
      return res.status(403).json({ msg: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
    }

    next();
  } catch (error) {
    console.error('Error en middleware isAdmin:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

module.exports = isAdmin;
