const express = require('express');
const router = express.Router();
const bomController = require('../controllers/bomController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Listar materias primas
router.get('/materias-primas', bomController.listMateriasPrimas);

// Listar BOM
router.get('/', bomController.listBOM);

// Analítica de variación de costos por materia prima en BOM
router.get('/:id/variacion-costos', bomController.getVariacionCostosBOM);

// Detalle de BOM
router.get('/:id', bomController.getBOMDetalle);

// Crear BOM
router.post('/', bomController.createBOM);

// Actualizar BOM
router.put('/:id', bomController.updateBOM);

// Eliminar BOM
router.delete('/:id', bomController.deleteBOM);

// Clonar BOM (nueva versión)
router.post('/:id/clonar', bomController.clonarBOM);

// Eliminar operación puntual dentro de una receta
router.delete('/operaciones/:operacionId', bomController.deleteOperacionBOM);

module.exports = router;
