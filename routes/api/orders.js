const express = require("express");

const OrdersController = require("../../controllers/orders");

const router = express.Router();

router.get("/all", OrdersController.getAll);
router.post("/id", OrdersController.getAll);
router.post("/by-filter", OrdersController.getByFilter);
router.post("/by-article", OrdersController.getByArticle)
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;