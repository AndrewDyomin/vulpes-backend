const express = require("express");
const isAuth = require("../../middlewares/isAuth");

const OrdersController = require("../../controllers/orders");

const router = express.Router();

router.get("/all", isAuth, OrdersController.getAll);
router.post("/id", isAuth, OrdersController.getAll);
router.post("/by-filter", isAuth, OrdersController.getByFilter);
router.post("/by-article", isAuth, OrdersController.getByArticle);
router.post("/from-table", OrdersController.orderedStatus);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;