const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 10
        v.Venta_Id,
        v.Client_Id,
        v.Company_Id,
        v.Status_Id,
        v.Status,
        c.RFC,
        c.LegalName,
        c.TaxRegime
      FROM ERP_VENTAS v
      LEFT JOIN ERP_CLIENT c ON c.Client_Id = v.Client_Id
      ORDER BY v.Venta_Id DESC
    `);

    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
