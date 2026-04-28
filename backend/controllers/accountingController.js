const accountingService = require('../services/accountingService');

async function listAccounts(req, res) {
  try {
    const companies = req.userCompanies || [];
    const q = req.query || {};
    const accounts = await accountingService.getAccounts(companies, q);
    res.json({ ok: true, data: accounts });
  } catch (err) {
    console.error('listAccounts error', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener catálogo de cuentas' });
  }
}

async function createAccount(req, res) {
  try {
    const payload = req.body;
    const result = await accountingService.createAccount(payload);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('createAccount error', err);
    res.status(500).json({ ok: false, msg: 'Error al crear cuenta' });
  }
}

async function getBalances(req, res) {
  try {
    const companies = req.userCompanies || [];
    const { from, to, accountId } = req.query;
    const balances = await accountingService.getBalances(companies, from, to, accountId);
    res.json({ ok: true, data: balances });
  } catch (err) {
    console.error('getBalances error', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener balanzas' });
  }
}

async function getIncomeStatement(req, res) {
  try {
    const companies = req.userCompanies || [];
    const { from, to } = req.query;
    const stmt = await accountingService.getIncomeStatement(companies, from, to);
    res.json({ ok: true, data: stmt });
  } catch (err) {
    console.error('getIncomeStatement error', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener estado de resultados' });
  }
}

async function getSupplierInvoiceRelations(req, res) {
  try {
    const companies = req.userCompanies || [];
    const { supplierId, from, to } = req.query;
    const relations = await accountingService.getSupplierInvoiceRelations(companies, supplierId, from, to);
    res.json({ ok: true, data: relations });
  } catch (err) {
    console.error('getSupplierInvoiceRelations error', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener relaciones con facturas de proveedor' });
  }
}

async function getOperationalReports(req, res) {
  try {
    const companies = req.userCompanies || [];
    const params = req.query || {};
    const reports = await accountingService.getOperationalReports(companies, params);
    res.json({ ok: true, data: reports });
  } catch (err) {
    console.error('getOperationalReports error', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener reportes operativos' });
  }
}

module.exports = {
  listAccounts,
  createAccount,
  getBalances,
  getIncomeStatement,
  getSupplierInvoiceRelations,
  getOperationalReports,
};
