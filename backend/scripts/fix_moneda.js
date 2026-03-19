const { pool, sql } = require('../config/db');

(async () => {
  try {
    await pool.connect();
    const r = await pool.request().query("UPDATE ERP_PRODUCTOS SET TipoMoneda = 'MXN' WHERE TipoMoneda IS NULL");
    console.log('Productos actualizados a MXN:', r.rowsAffected[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
