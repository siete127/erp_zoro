const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');

// POST /api/users/register - Solo administradores
router.post("/register", authMiddleware, isAdmin, userController.register);

// Protected routes - require valid token and active user
router.get("/", authMiddleware, userController.list);
router.get('/:id', authMiddleware, userController.get);
router.put('/:id', authMiddleware, isAdmin, userController.update);
router.patch('/:id/active', authMiddleware, isAdmin, userController.toggleActive);
router.delete('/:id', authMiddleware, isAdmin, userController.remove);

module.exports = router;
