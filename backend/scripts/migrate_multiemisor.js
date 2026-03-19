// Migración: agregar columnas para multiemisor Facturama
const { poolPromise } = require('../config/db');

(async () => {
  const p = await poolPromise;
  
  // Agregar CsdCargado
  try {
    await p.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdCargado')
      ALTER TABLE ERP_COMPANY ADD CsdCargado BIT NOT NULL DEFAULT 0
    `);
    console.log('CsdCargado: OK');
  } catch(e) { console.log('CsdCargado:', e.message); }
  
  // Agregar Email
  try {
    await p.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'Email')
      ALTER TABLE ERP_COMPANY ADD Email NVARCHAR(200) NULL
    `);
    console.log('Email: OK');
  } catch(e) { console.log('Email:', e.message); }
  
  // Agregar CsdPassword
  try {
    await p.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ERP_COMPANY' AND COLUMN_NAME = 'CsdPassword')
      ALTER TABLE ERP_COMPANY ADD CsdPassword NVARCHAR(100) NULL
    `);
    console.log('CsdPassword: OK');
  } catch(e) { console.log('CsdPassword:', e.message); }
  
  // Verificar
  const r = await p.request().query('SELECT Company_Id, NameCompany, RFC, LegalName, FiscalRegime, TaxZipCode, CsdCargado FROM ERP_COMPANY ORDER BY Company_Id');
  console.log(JSON.stringify(r.recordset, null, 2));
  
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
