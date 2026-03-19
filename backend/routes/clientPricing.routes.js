const express = require('express');
const router = express.Router();
const clientPricingController = require('../controllers/clientPricingController');
const authMiddleware = require('../middleware/authMiddleware');

// Obtener precios de un cliente
router.get('/client/:clientId/prices', authMiddleware, clientPricingController.getClientPrices);

// Crear solicitud de cambio de precio
router.post('/price-change-request', authMiddleware, clientPricingController.createPriceChangeRequest);

// Crear solicitud de cambio de precio para múltiples productos
router.post('/multi-price-change-request', authMiddleware, clientPricingController.createMultiPriceChangeRequest);

// Aprobar/Rechazar solicitud (GET para emails, POST para API)
router.get('/price-change-request/:requestId/approve', clientPricingController.approvePriceChange);
router.post('/price-change-request/:requestId/approve', clientPricingController.approvePriceChange);

// Obtener estado actual de solicitud
router.get('/price-change-request/:requestId/status', clientPricingController.getPriceRequestStatus);

// Obtener solicitudes pendientes
router.get('/price-change-requests/pending', authMiddleware, clientPricingController.getPendingRequests);

// Verificar solicitudes pendientes de una venta
router.get('/sale/:saleId/pending-requests', authMiddleware, clientPricingController.checkSalePendingRequests);

module.exports = router;
