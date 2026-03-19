const express = require('express');
const router = express.Router();
const reporteriaController = require('../controllers/reporteriaController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/facturas', reporteriaController.getFacturas);
router.get('/facturas/:id/pdf', reporteriaController.descargarPDF);
router.get('/facturas/:id/xml', reporteriaController.descargarXML);
router.get('/estadisticas', reporteriaController.getEstadisticas);

module.exports = router;
