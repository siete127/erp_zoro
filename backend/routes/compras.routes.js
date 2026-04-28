/**
 * compras.routes.js
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctrl = require('../controllers/comprasController');

// Proveedores (catálogo)
router.get('/proveedores',          auth, ctrl.listProveedores);

// Órdenes de compra
router.get('/ordenes',              auth, ctrl.listOrdenes);
router.get('/ordenes/:id',          auth, ctrl.getOrden);
router.post('/ordenes',             auth, ctrl.crearOrden);
router.put('/ordenes/:id',          auth, ctrl.actualizarOrden);
router.post('/ordenes/:id/enviar-autorizacion', auth, ctrl.enviarAutorizacion);
router.post('/ordenes/:id/autorizar',           auth, ctrl.autorizarOrden);
router.post('/ordenes/:id/comprar',             auth, ctrl.marcarComprada);
router.post('/ordenes/:id/factura',             auth, ctrl.cargarFactura);
router.post('/ordenes/:id/recibir',             auth, ctrl.recibirMercancia);
router.get('/ordenes/:id/recepciones',          auth, ctrl.listRecepciones);
router.post('/ordenes/:id/cancelar',            auth, ctrl.cancelarOrden);
router.get('/ordenes/:id/pdf',                  auth, ctrl.generarPDF);

// Registro directo con factura
router.post('/registro-directo/analizar-hoja', auth, ctrl.analizarHojaProveedorRegistroDirecto);
router.post('/registro-directo',    auth, ctrl.registroDirecto);

module.exports = router;
