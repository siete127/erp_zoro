const { pool, sql } = require('../config/db');

async function getAccounts(companies = [], query = {}) {
  try {
    await pool.connect();
    // Basic implementation: try to read from ERP_ACCOUNTS or fallback to empty
    const companyFilter = companies.length ? `WHERE Company_Id IN (${companies.join(',')})` : '';
    const q = `SELECT * FROM ERP_ACCOUNTS ${companyFilter} ORDER BY AccountCode`;
    const r = await pool.request().query(q);
    return r.recordset || [];
  } catch (err) {
    console.warn('getAccounts: tabla ERP_ACCOUNTS no disponible o error', err.message || err);
    return [];
  }
}

async function createAccount(payload) {
  try {
    await pool.connect();
    // Minimal insert - assumes columns: AccountCode, Name, Type, Company_Id, ParentAccount
    const { AccountCode, Name, Type, Company_Id, ParentAccount } = payload;
    const r = await pool.request()
      .input('AccountCode', sql.VarChar(50), AccountCode)
      .input('Name', sql.VarChar(255), Name)
      .input('Type', sql.VarChar(50), Type)
      .input('Company_Id', sql.Int, Company_Id)
      .input('ParentAccount', sql.VarChar(50), ParentAccount || null)
      .query(`INSERT INTO ERP_ACCOUNTS (AccountCode, Name, Type, Company_Id, ParentAccount)
              VALUES (@AccountCode, @Name, @Type, @Company_Id, @ParentAccount);
              SELECT SCOPE_IDENTITY() AS Account_Id;`);
    return r.recordset && r.recordset[0] ? r.recordset[0] : null;
  } catch (err) {
    console.error('createAccount error', err.message || err);
    throw err;
  }
}

async function getBalances(companies = [], from, to, accountId) {
  try {
    await pool.connect();
    // Generic ledger query - expects ERP_LEDGER with columns: Date, AccountCode, Debit, Credit, Company_Id
    let where = [];
    if (companies.length) where.push(`Company_Id IN (${companies.join(',')})`);
    if (accountId) where.push(`AccountCode = '${accountId}'`);
    if (from) where.push(`Date >= '${from}'`);
    if (to) where.push(`Date <= '${to}'`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const q = `SELECT AccountCode, SUM(ISNULL(Debit,0)) as Debit, SUM(ISNULL(Credit,0)) as Credit
               FROM ERP_LEDGER ${whereSql}
               GROUP BY AccountCode`;
    const r = await pool.request().query(q);
    return r.recordset || [];
  } catch (err) {
    console.warn('getBalances: tabla ERP_LEDGER no disponible o error', err.message || err);
    return [];
  }
}

async function getIncomeStatement(companies = [], from, to) {
  try {
    await pool.connect();
    // Simplified income statement: sum revenues and expenses by account type
    const companyFilter = companies.length ? `AND Company_Id IN (${companies.join(',')})` : '';
    const q = `
      SELECT AccountType,
        SUM(ISNULL(Debit,0)) as TotalDebit,
        SUM(ISNULL(Credit,0)) as TotalCredit
      FROM (
        SELECT a.Type as AccountType, l.Debit, l.Credit, l.Company_Id
        FROM ERP_LEDGER l
        LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
      ) t
      WHERE 1=1 ${companyFilter}
      GROUP BY AccountType`;
    const r = await pool.request().query(q);
    return r.recordset || [];
  } catch (err) {
    console.warn('getIncomeStatement error', err.message || err);
    return [];
  }
}

async function getSupplierInvoiceRelations(companies = [], supplierId, from, to) {
  try {
    await pool.connect();
    let where = [];
    if (companies.length) where.push(`c.Company_Id IN (${companies.join(',')})`);
    if (supplierId) where.push(`c.Supplier_Id = ${supplierId}`);
    if (from) where.push(`c.Date >= '${from}'`);
    if (to) where.push(`c.Date <= '${to}'`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // Attempt to join purchases/compras with ledger entries - adjust to actual schema if needed
    const q = `
      SELECT c.Compra_Id, c.Folio, c.Date, c.Supplier_Id, c.Total,
             l.AccountCode, l.Debit, l.Credit
      FROM ERP_COMPRAS c
      LEFT JOIN ERP_LEDGER l ON l.Reference_Id = c.Compra_Id
      ${whereSql}
      ORDER BY c.Date DESC`;
    const r = await pool.request().query(q);
    return r.recordset || [];
  } catch (err) {
    console.warn('getSupplierInvoiceRelations error', err.message || err);
    return [];
  }
}

async function getOperationalReports(companies = [], params = {}) {
  try {
    await pool.connect();
    const companyIn = companies.length ? `(${companies.join(',')})` : null;

    async function tableExists(name) {
      const res = await pool.request()
        .input('tableName', sql.VarChar, name)
        .query("SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName");
      return res.recordset && res.recordset[0] && res.recordset[0].cnt > 0;
    }

    const results = [];

    // Receivables
    if (await tableExists('ERP_ACCOUNTS_RECEIVABLE')) {
      const q = `SELECT SUM(ISNULL(Balance,0)) as Value FROM ERP_ACCOUNTS_RECEIVABLE ${companies.length ? `WHERE Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Receivables', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    } else {
      // Fallback: try to compute from ledger/accounts where account type/name suggest receivables
      const q = `
        SELECT SUM(ISNULL(l.Debit,0) - ISNULL(l.Credit,0)) AS Value
        FROM ERP_LEDGER l
        LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
        WHERE (
          LOWER(ISNULL(a.Type,'')) LIKE '%receiv%' OR
          LOWER(ISNULL(a.Type,'')) LIKE '%cxc%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%por cobrar%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%cliente%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%clientes%'
        ) ${companies.length ? `AND l.Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Receivables', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    }

    // Payables
    if (await tableExists('ERP_ACCOUNTS_PAYABLE')) {
      const q = `SELECT SUM(ISNULL(Balance,0)) as Value FROM ERP_ACCOUNTS_PAYABLE ${companies.length ? `WHERE Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Payables', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    } else {
      const q = `
        SELECT SUM(ISNULL(l.Credit,0) - ISNULL(l.Debit,0)) AS Value
        FROM ERP_LEDGER l
        LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
        WHERE (
          LOWER(ISNULL(a.Type,'')) LIKE '%pay%' OR
          LOWER(ISNULL(a.Type,'')) LIKE '%cxp%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%por pagar%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%proveed%'
        ) ${companies.length ? `AND l.Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Payables', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    }

    // Cash
    if (await tableExists('ERP_CASH_BALANCES')) {
      const q = `SELECT SUM(ISNULL(Balance,0)) as Value FROM ERP_CASH_BALANCES ${companies.length ? `WHERE Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Cash', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    } else {
      const q = `
        SELECT SUM(ISNULL(l.Debit,0) - ISNULL(l.Credit,0)) AS Value
        FROM ERP_LEDGER l
        LEFT JOIN ERP_ACCOUNTS a ON a.AccountCode = l.AccountCode
        WHERE (
          LOWER(ISNULL(a.Type,'')) LIKE '%cash%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%caja%' OR
          LOWER(ISNULL(a.Name,'')) LIKE '%banco%'
        ) ${companies.length ? `AND l.Company_Id IN ${companyIn}` : ''}`;
      const r = await pool.request().query(q);
      results.push({ Metric: 'Cash', Value: (r.recordset[0] && r.recordset[0].Value) || 0 });
    }

    return results;
  } catch (err) {
    console.warn('getOperationalReports error', err.message || err);
    return [];
  }
}

module.exports = {
  getAccounts,
  createAccount,
  getBalances,
  getIncomeStatement,
  getSupplierInvoiceRelations,
  getOperationalReports,
};
