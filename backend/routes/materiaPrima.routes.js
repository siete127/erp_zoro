const express = require('express');
const router = express.Router();
const materiaPrimaController = require('../controllers/materiaPrimaController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', materiaPrimaController.listMateriasPrimas);
router.get('/:id', materiaPrimaController.getMateriaPrimaDetalle);
router.post('/', materiaPrimaController.createMateriaPrima);
router.put('/:id', materiaPrimaController.updateMateriaPrima);
router.delete('/:id', materiaPrimaController.deleteMateriaPrima);

module.exports = router;
