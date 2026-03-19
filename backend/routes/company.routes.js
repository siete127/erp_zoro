const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, companyController.list);
router.get('/csds', authMiddleware, companyController.listarCSDs);
router.get('/:id', authMiddleware, companyController.get);
router.post('/', authMiddleware, companyController.create);
router.put('/:id', authMiddleware, companyController.update);
router.put('/:id/fiscal', authMiddleware, companyController.updateFiscal);
router.post('/:id/csd', authMiddleware, companyController.subirCSD);
router.delete('/:id/csd', authMiddleware, companyController.eliminarCSD);
router.delete('/:id', authMiddleware, companyController.remove);

module.exports = router;
