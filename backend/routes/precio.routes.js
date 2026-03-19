const express = require('express');
const router = express.Router();
const precioController = require('../controllers/precioController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/solicitar', authMiddleware, precioController.solicitarCambio);
router.post('/aprobar', authMiddleware, precioController.aprobarCambio);
router.get('/solicitudes', authMiddleware, precioController.listarSolicitudes);
router.delete('/solicitudes/:id', authMiddleware, precioController.eliminarSolicitud);

module.exports = router;
