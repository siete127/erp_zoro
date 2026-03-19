const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas CRM requieren autenticación
router.use(authMiddleware);

// Etapas CRM
router.get('/etapas', crmController.getEtapas);

// Oportunidades
router.post('/oportunidades', crmController.createOportunidad);
router.get('/oportunidades', crmController.getOportunidades);
router.get('/oportunidades/:id', crmController.getOportunidadDetalle);
router.put('/oportunidades/:id', crmController.updateOportunidad);
router.put('/oportunidades/:id/etapa', crmController.cambiarEtapaOportunidad);
router.put('/oportunidades/:id/cerrar', crmController.cerrarOportunidad);
router.delete('/oportunidades/:id', crmController.eliminarOportunidad);

// Actividades ligadas a oportunidad
router.get('/oportunidades/:id/actividades', crmController.listarActividades);
router.post('/oportunidades/:id/actividades', crmController.crearActividad);
router.put('/actividades/:actividadId/completar', crmController.completarActividad);
router.post('/actividades/:actividadId/enviar-produccion', crmController.enviarActividadAProduccion);

module.exports = router;
