const express = require("express");
const router = express.Router();
const passwordController = require("../controllers/passwordController");

// POST /api/password/request-reset - Solicitar recuperación de contraseña
router.post("/request-reset", passwordController.requestPasswordReset);

// GET /api/password/verify-token/:token - Verificar si un token es válido
router.get("/verify-token/:token", passwordController.verifyResetToken);

// POST /api/password/reset - Restablecer contraseña
router.post("/reset", passwordController.resetPassword);

module.exports = router;
