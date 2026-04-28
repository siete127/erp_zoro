const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');
const accountingController = require('../controllers/accountingController');

// Catálogo de cuentas
router.get('/accounts', auth, accountingController.listAccounts);
router.post('/accounts', auth, isAdmin, accountingController.createAccount);

// Balanzas y balances
router.get('/balances', auth, accountingController.getBalances);

// Estado de resultados
router.get('/income-statement', auth, accountingController.getIncomeStatement);

// Relación con facturas de proveedor
router.get('/supplier-invoices', auth, accountingController.getSupplierInvoiceRelations);

// Reportes operativos / administrativos
router.get('/reports/operational', auth, accountingController.getOperationalReports);

module.exports = router;
