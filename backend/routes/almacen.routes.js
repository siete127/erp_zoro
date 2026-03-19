const express = require("express");
const router = express.Router();
const almacenController = require("../controllers/almacenController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/", verifyToken, almacenController.list);
router.get("/:id", verifyToken, almacenController.get);
router.post("/", verifyToken, almacenController.create);
router.put("/:id", verifyToken, almacenController.update);
router.delete("/:id", verifyToken, almacenController.remove);

module.exports = router;
