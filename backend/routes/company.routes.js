const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, companyController.list);
router.get('/debug/csds', authMiddleware, companyController.debugCsds);
// Local-only public debug route (no auth) - accessible from localhost
router.get('/debug/csds/public', companyController.debugCsdsPublic);
router.get('/csds', authMiddleware, companyController.listarCSDs);
router.get('/:id/facturacion-status', authMiddleware, companyController.getFacturacionStatus);
router.get('/:id', authMiddleware, companyController.get);
router.post('/', authMiddleware, companyController.create);
router.post('/:id/logo', authMiddleware, companyController.uploadLogo);
router.put('/:id', authMiddleware, companyController.update);
router.put('/:id/fiscal', authMiddleware, companyController.updateFiscal);
router.put('/:id/facturama-credentials', authMiddleware, companyController.updateFacturamaCredentials);
router.post('/:id/csd', authMiddleware, companyController.subirCSD);
router.delete('/:id/csd', authMiddleware, companyController.eliminarCSD);
router.delete('/:id', authMiddleware, companyController.remove);

module.exports = router;
