const { poolPromise, sql } = require('../config/db');

(async () => {
  const p = await poolPromise;

  // Check if column exists
  const check = await p.request().query(`
    SELECT 1 AS Existe FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='ERP_OP_PRODUCCION' AND COLUMN_NAME='CompanySolicitante_Id'
  `);

  if (check.recordset.length === 0) {
    // Add column first
    await p.request().query(`ALTER TABLE ERP_OP_PRODUCCION ADD CompanySolicitante_Id INT NULL`);
    console.log('Columna CompanySolicitante_Id creada');

    // Now update existing data
    await p.request().query(`UPDATE ERP_OP_PRODUCCION SET CompanySolicitante_Id = Company_Id`);
    console.log('Datos migrados');
  } else {
    console.log('Columna CompanySolicitante_Id ya existe');
  }

  // Get PTC
  const r = await p.request().query("SELECT TOP 1 Company_Id, NameCompany FROM ERP_COMPANY WHERE EmpresaCodigo = 'PTC' OR NameCompany LIKE '%PTC%'");
  console.log('PTC Company:', JSON.stringify(r.recordset));

  // All companies
  const c = await p.request().query('SELECT Company_Id, NameCompany FROM ERP_COMPANY ORDER BY Company_Id');
  console.log('All Companies:', JSON.stringify(c.recordset));

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
