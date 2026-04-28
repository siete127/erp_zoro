import api from './api';

function handleResponse(promise) {
  return promise.then(res => {
    const payload = res.data;
    // If backend returns wrapper { ok: true, data: ... } or { success:true, data: ... }
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return { data: payload.data };
    }
    // otherwise return the raw payload
    return { data: payload };
  }).catch(err => {
    throw err;
  });
}

export default {
  listAccounts: (params = {}) => handleResponse(api.get('/accounting/accounts', { params })),
  getBalances: ({ from, to, accountId, page, pageSize } = {}) => handleResponse(
    api.get('/accounting/balances', { params: { from, to, accountId, page, pageSize } })
  ),
  getIncomeStatement: ({ from, to } = {}) => handleResponse(
    api.get('/accounting/income-statement', { params: { from, to } })
  ),
  getSupplierInvoiceRelations: (params = {}) => handleResponse(
    api.get('/accounting/supplier-invoices', { params })
  ),
  getOperationalReports: (params = {}) => handleResponse(
    api.get('/accounting/reports/operational', { params })
  )
};
