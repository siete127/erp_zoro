const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/email-aprobacion', verifyToken, configController.getEmailAprobacion);
router.put('/email-aprobacion', verifyToken, configController.updateEmailAprobacion);

// company specific approval emails
router.get('/precio-emails', verifyToken, configController.getPriceApprovalEmails);
router.put('/precio-emails', verifyToken, configController.updatePriceApprovalEmails);

module.exports = router;
