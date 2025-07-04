const express = require("express");

const InventoryCheckController = require("../../controllers/inventoryCheck");

const router = express.Router();

router.get("/all", InventoryCheckController.getAll);
router.post("/by-id", InventoryCheckController.getById);
router.post("/add", InventoryCheckController.add);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;