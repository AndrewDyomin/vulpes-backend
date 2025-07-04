const express = require("express");

const InventoryCheckController = require("../../controllers/inventoryCheck");

const router = express.Router();

router.get("/all", InventoryCheckController.getAll);
router.post("/byId", InventoryCheckController.getById);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;