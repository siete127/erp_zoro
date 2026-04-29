const express = require('express');
const router = express.Router();
const precioController = require('../controllers/precioController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/solicitar', authMiddleware, precioController.solicitarCambio);
router.post('/aprobar', authMiddleware, precioController.aprobarCambio);
router.get('/solicitudes', authMiddleware, precioController.listarSolicitudes);
router.delete('/solicitudes/:id', authMiddleware, precioController.eliminarSolicitud);
router.get('/niveles', authMiddleware, precioController.listarNiveles);
router.post('/niveles', authMiddleware, precioController.guardarNivel);
router.delete('/niveles/:id', authMiddleware, precioController.eliminarNivel);

module.exports = router;
