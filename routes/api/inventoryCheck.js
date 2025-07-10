const express = require("express");

const InventoryCheckController = require("../../controllers/inventoryCheck");

const router = express.Router();

router.get("/all", InventoryCheckController.getAll);
router.post("/by-id", InventoryCheckController.getById);
router.post("/add", InventoryCheckController.add);
router.post("/delete", InventoryCheckController.remove);
router.post("/update", InventoryCheckController.update);
router.post("/combine", InventoryCheckController.combine);

module.exports = router;