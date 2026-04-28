const express = require("express");
const router = express.Router();
const { facturar, cancelarFactura, forceCancelarFactura } = require("../controllers/facturaController");
const authMiddleware = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

router.post("/facturar", authMiddleware, facturar);
router.post('/facturas/:id/cancelar', authMiddleware, cancelarFactura);
// Ruta de pruebas: forzar cancelación local (solo administradores)
router.post('/facturas/:id/force-cancel', authMiddleware, isAdmin, forceCancelarFactura);

module.exports = router;