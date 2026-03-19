const express = require("express");
const router = express.Router();
const { facturar } = require("../controllers/facturaController");

router.post("/facturar", facturar);

module.exports = router;