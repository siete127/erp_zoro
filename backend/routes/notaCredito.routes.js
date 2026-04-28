const express = require('express');
const router = express.Router();
const notaCreditoController = require('../controllers/notaCreditoController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', notaCreditoController.crearNotaCredito);
router.post('/:id/timbrar', notaCreditoController.timbrarNotaCredito);
router.get('/', notaCreditoController.getNotasCredito);
router.get('/factura/:facturaId/productos', notaCreditoController.getProductosFactura);
router.get('/:id', notaCreditoController.getNotaCreditoDetalle);
router.get('/:id/pdf', notaCreditoController.descargarPdf);

module.exports = router;
