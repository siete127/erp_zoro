const express = require('express');
const router = express.Router();
const rhController = require('../controllers/rhController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/perfiles/:userId', rhController.getPerfil);
router.get('/perfiles', rhController.listPerfiles);
router.put('/perfiles/:userId', rhController.upsertPerfil);
router.post('/perfiles/:userId/foto', rhController.uploadFotoPerfil);
router.get('/perfiles/:userId/documentos', rhController.listDocumentos);
router.post('/perfiles/:userId/documentos', rhController.uploadDocumento);
router.delete('/documentos/:documentoId', rhController.deleteDocumento);

router.post('/perfiles/:userId/contactos-emergencia', rhController.createContactoEmergencia);
router.put('/contactos-emergencia/:contactoId', rhController.updateContactoEmergencia);
router.delete('/contactos-emergencia/:contactoId', rhController.deleteContactoEmergencia);

router.post('/perfiles/:userId/cuentas-bancarias', rhController.createCuentaBancaria);
router.put('/cuentas-bancarias/:cuentaId', rhController.updateCuentaBancaria);
router.delete('/cuentas-bancarias/:cuentaId', rhController.deleteCuentaBancaria);

module.exports = router;
