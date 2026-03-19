const express = require('express');
const router = express.Router();
const constanciaController = require('../controllers/constanciaController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/parse', authMiddleware, constanciaController.parseConstancia);

module.exports = router;
