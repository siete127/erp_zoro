const express = require('express');
const router = express.Router();
const complementoPagoController = require('../controllers/complementoPagoController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', complementoPagoController.crearComplementoPago);
router.post('/:id/timbrar', complementoPagoController.timbrarComplementoPago);
router.get('/', complementoPagoController.getComplementosPago);
router.get('/:id', complementoPagoController.getComplementoPagoDetalle);

module.exports = router;
