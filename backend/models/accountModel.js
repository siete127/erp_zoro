// Simple model helpers for the chart of accounts
const { pool, sql } = require('../config/db');

async function findByCompany(companyId) {
  try {
    await pool.connect();
    const r = await pool.request()
      .input('Company_Id', sql.Int, companyId)
      .query('SELECT * FROM ERP_ACCOUNTS WHERE Company_Id = @Company_Id ORDER BY AccountCode');
    return r.recordset || [];
  } catch (err) {
    console.warn('findByCompany warning', err.message || err);
    return [];
  }
}

module.exports = { findByCompany };
