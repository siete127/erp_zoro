const express = require("express");
const router = express.Router();
const productoController = require("../controllers/productoController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/", verifyToken, productoController.list);
router.get("/:id", verifyToken, productoController.get);
router.post("/", verifyToken, productoController.create);
router.put("/:id", verifyToken, productoController.update);
router.delete("/:id", verifyToken, productoController.remove);
router.post("/importar", verifyToken, productoController.importar);

module.exports = router;
