const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/roles (protected)
router.get('/', authMiddleware, roleController.list);
// GET /api/roles/:id/modules - obtener módulos y estado para un rol
router.get('/:id/modules', authMiddleware, roleController.getModules);

// PUT /api/roles/:id/modules/:moduleKey - actualizar estado de un módulo para un rol
router.put('/:id/modules/:moduleKey', authMiddleware, roleController.updateModule);

// Permisos: listar permisos disponibles
// NOTE: Permission endpoints removed temporarily while permissions are deferred

module.exports = router;
