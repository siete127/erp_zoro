const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;

    const antes = await pool.request()
      .query("SELECT Company_Id, RFC, LegalName, FiscalRegime FROM ERP_COMPANY WHERE RFC = 'CALI691111PX9'");
    console.log('ANTES:', JSON.stringify(antes.recordset, null, 2));

    await pool.request()
      .query("UPDATE ERP_COMPANY SET FiscalRegime = '612' WHERE RFC = 'CALI691111PX9'");

    const despues = await pool.request()
      .query("SELECT Company_Id, RFC, LegalName, FiscalRegime FROM ERP_COMPANY WHERE RFC = 'CALI691111PX9'");
    console.log('DESPUES:', JSON.stringify(despues.recordset, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
