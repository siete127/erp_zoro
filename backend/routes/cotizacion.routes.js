const express = require('express');
const router = express.Router();
const cotizacionController = require('../controllers/cotizacionController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas de cotizaciones requieren autenticación
router.use(authMiddleware);

// Crear cotización (cabecera + detalle en un solo paso)
router.post('/', cotizacionController.createCotizacion);

// Listar cotizaciones
router.get('/', cotizacionController.listCotizaciones);

// Obtener detalle de una cotización
router.get('/:id', cotizacionController.getCotizacionDetalle);

// Aprobar cotización (aplica reglas de margen y cambio de estado)
router.post('/:id/aprobar', cotizacionController.aprobarCotizacion);

// Confirmar pedido: convierte cotización en orden de venta
// y, para productos PTC, genera la orden de producción correspondiente.
router.post('/:id/confirmar-pedido', cotizacionController.confirmarPedidoDesdeCotizacion);

module.exports = router;
