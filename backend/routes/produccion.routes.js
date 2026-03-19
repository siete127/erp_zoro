const express = require('express');
const router = express.Router();
const produccionController = require('../controllers/produccionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Listar órdenes de producción (tablero básico)
router.get('/ordenes', produccionController.listOrdenesProduccion);

// Detalle de orden de producción (incluye consumos y resultado si existe)
router.get('/ordenes/:id', produccionController.getOrdenProduccionDetalle);

// Resumen previo de cierre (consumos/costos teóricos)
router.get('/ordenes/:id/preview-cierre', produccionController.getPreviewCierreOrdenProduccion);

// Crear orden de producción manualmente (además de las generadas desde cotización/pedido)
router.post('/ordenes', produccionController.createOrdenProduccion);

// Actualizar estado de la OP (EN_ESPERA / EN_PROCESO / TERMINADA / CERRADA / CANCELADA)
router.put('/ordenes/:id/estado', produccionController.updateEstadoOrdenProduccion);

// Confirmación de factibilidad: solo usuarios de PTC pueden aprobar/rechazar
router.post('/ordenes/:id/confirm', produccionController.confirmOrdenProduccion);

// Registrar consumos reales de material y cierre de la OP
router.post('/ordenes/:id/cerrar', produccionController.cerrarOrdenProduccionConConsumos);

module.exports = router;
