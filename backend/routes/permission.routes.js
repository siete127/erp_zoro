const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Módulos
router.get('/modules', permissionController.getModules);

// Permisos de usuario
router.get('/user/:userId', permissionController.getUserPermissions);
router.put('/user/:userId', permissionController.updateUserPermissions);
router.get('/check/:userId/:moduleKey', permissionController.checkPermission);

module.exports = router;
