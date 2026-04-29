const express = require("express");
const router = express.Router();
const inventarioController = require("../controllers/inventarioController");
const verifyToken = require("../middleware/authMiddleware");

// ── Inventario consolidado (totales + estados operativos) ──────────────
router.get("/consolidado", verifyToken, inventarioController.listConsolidado);
router.put("/consolidado", verifyToken, inventarioController.updateEstadoConsolidado);
router.get("/planeacion/resumen", verifyToken, inventarioController.getPlaneacionResumen);
router.get("/planeacion/reabastecimiento", verifyToken, inventarioController.listReabastecimiento);

// ── Inventario de Materia Prima ─────────────────────────────────────────
router.get("/mp", verifyToken, inventarioController.listStockMP);
router.put("/mp", verifyToken, inventarioController.updateStockMP);
router.get("/mp/maquinas", verifyToken, inventarioController.listMateriaPrimaPorMaquina);
router.post("/mp/maquinas", verifyToken, inventarioController.saveMateriaPrimaPorMaquina);

// ── Lista de productos listos para recepción en almacén ────────────────
router.get("/recepcion/pendientes", verifyToken, inventarioController.listRecepcionPendiente);
router.post("/recepcion/registrar", verifyToken, inventarioController.registrarRecepcionPendiente);
router.post("/recepcion/cancelar", verifyToken, inventarioController.cancelarRecepcionPendiente);

// ── Stock actual por producto/almacén ──────────────────────────────────
router.get("/", verifyToken, inventarioController.listStock);
router.get("/producto/:productoId", verifyToken, inventarioController.getStockByProducto);

// ── Movimientos de inventario (kardex) ────────────────────────────────
router.post("/movimientos", verifyToken, inventarioController.registrarMovimiento);
router.get("/kardex", verifyToken, inventarioController.listKardex);

// ── Transferencias entre almacenes ────────────────────────────────────
router.post("/transferencias", verifyToken, inventarioController.transferir);

module.exports = router;
