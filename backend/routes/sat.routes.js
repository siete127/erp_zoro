const express = require("express");
const router = express.Router();
const satController = require("../controllers/satController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/prodserv", verifyToken, satController.searchProdServ);
router.get("/prodserv/:clave", verifyToken, satController.getProdServ);
router.get("/unidades", verifyToken, satController.searchUnidades);
router.get("/unidades/:clave", verifyToken, satController.getUnidad);

module.exports = router;
