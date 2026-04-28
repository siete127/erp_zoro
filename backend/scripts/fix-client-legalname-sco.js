const { poolPromise } = require('../config/db');

(async () => {
  try {
    const pool = await poolPromise;

    const before = await pool.request().query(`
      SELECT Client_Id, RFC, LegalName, CommercialName, TaxRegime
      FROM ERP_CLIENT
      WHERE RFC = 'SCO070223962'
    `);

    console.log('ANTES:', JSON.stringify(before.recordset, null, 2));

    await pool.request().query(`
      UPDATE ERP_CLIENT
      SET LegalName = 'SUPER COTTON'
      WHERE RFC = 'SCO070223962'
    `);

    const after = await pool.request().query(`
      SELECT Client_Id, RFC, LegalName, CommercialName, TaxRegime
      FROM ERP_CLIENT
      WHERE RFC = 'SCO070223962'
    `);

    console.log('DESPUES:', JSON.stringify(after.recordset, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message || error);
    process.exit(1);
  }
})();
