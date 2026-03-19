const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas de ventas
router.get('/resumen/por-empresa', ventaController.getResumenVentasPorEmpresa);
router.post('/', ventaController.createVenta);
router.get('/', ventaController.getVentas);
router.get('/status', ventaController.getVentaStatus);
router.get('/:id', ventaController.getVentaDetalle);
router.get('/:id/factura/pdf', ventaController.getFacturaPDFUrl);
router.put('/:id', ventaController.updateVenta);
router.delete('/:id', ventaController.deleteVenta);
router.post('/:id/productos', ventaController.addProductosVenta);
router.post('/:id/facturar', ventaController.facturarVenta);
router.put('/:id/cancelar', ventaController.cancelarVenta);

// Rutas de producción desde ventas
router.post('/:id/ordenes-produccion', ventaController.crearOrdenesProduccion);
router.post('/entrada-produccion', ventaController.registrarEntradaProduccion);

module.exports = router;
