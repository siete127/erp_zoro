const express = require("express");
const { pool, sql } = require("../config/db");

const router = express.Router();

// Middleware para verificar que es SuperAdmin
const checkSuperAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 1) {
    next();
  } else {
    return res.status(403).json({ msg: "Acceso denegado: requiere permisos de SuperAdmin" });
  }
};

// GET /api/superadmin/dashboard
router.get("/dashboard", checkSuperAdmin, async (req, res) => {
  try {
    await pool.connect();

    // Total de empresas
    const companiesResult = await pool.request()
      .query("SELECT COUNT(*) as total FROM ERP_COMPANY WHERE Activo = 1");
    const totalCompanies = companiesResult.recordset[0].total;

    // Total de usuarios
    const usersResult = await pool.request()
      .query("SELECT COUNT(*) as total FROM ERP_USERS WHERE IsActive = 1");
    const totalUsers = usersResult.recordset[0].total;

    // Total de ventas
    const ventasResult = await pool.request()
      .query("SELECT COALESCE(SUM(MontoTotal), 0) as total FROM ERP_VENTAS WHERE Estado != 'Cancelada'");
    const totalVentas = ventasResult.recordset[0].total;

    // Última actividad
    const lastActivityResult = await pool.request()
      .query("SELECT TOP 1 LastLogin FROM ERP_USERS WHERE LastLogin IS NOT NULL ORDER BY LastLogin DESC");
    const lastActivity = lastActivityResult.recordset.length > 0 
      ? lastActivityResult.recordset[0].LastLogin 
      : null;

    res.json({
      totalCompanies,
      totalUsers,
      totalVentas,
      lastActivity
    });
  } catch (err) {
    console.error("Error en /superadmin/dashboard:", err);
    res.status(500).json({ msg: "Error al cargar el dashboard", error: err.message });
  }
});

// GET /api/superadmin/empresas
router.get("/empresas", checkSuperAdmin, async (req, res) => {
  try {
    await pool.connect();

    const result = await pool.request()
      .query(`
        SELECT 
          Company_Id,
          CompanyName,
          RFC,
          Email,
          Activo,
          CreatedAt
        FROM ERP_COMPANY
        WHERE Activo = 1
        ORDER BY CreatedAt DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /superadmin/empresas:", err);
    res.status(500).json({ msg: "Error al cargar empresas", error: err.message });
  }
});

// GET /api/superadmin/auditoria
router.get("/auditoria", checkSuperAdmin, async (req, res) => {
  try {
    await pool.connect();

    const result = await pool.request()
      .query(`
        SELECT TOP 100
          Session_Id,
          User_Id,
          LoginTime,
          LogoutTime
        FROM ERP_USER_SESSIONS
        ORDER BY LoginTime DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /superadmin/auditoria:", err);
    res.status(500).json({ msg: "Error al cargar auditoría", error: err.message });
  }
});

module.exports = router;
