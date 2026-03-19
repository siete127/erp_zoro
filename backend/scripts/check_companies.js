const { poolPromise } = require('../config/db');
(async () => {
  const p = await poolPromise;
  const r = await p.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ERP_COMPANY'");
  console.log('Columns:', r.recordset.map(c => c.COLUMN_NAME).join(', '));
  
  const c = await p.request().query('SELECT Company_Id, NameCompany FROM ERP_COMPANY ORDER BY Company_Id');
  console.log('Companies:', JSON.stringify(c.recordset, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
