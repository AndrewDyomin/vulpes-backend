const express = require("express");
const isAuth = require("../../middlewares/isAuth");
const ProductsController = require("../../controllers/products");

const router = express.Router();

router.get("/all", ProductsController.getAll);
router.get("/compare-year", isAuth, ProductsController.compareYear);
router.post("/bybarcode", ProductsController.getByBarcode);
router.post("/byarticle", ProductsController.getByArticle);
router.post("/search", ProductsController.search);
router.post("/availability", isAuth, ProductsController.sendAvailabilityTable);
router.post("/update-prom-base", isAuth, ProductsController.updatePromBase);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;