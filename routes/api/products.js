const express = require("express");

const ProductsController = require("../../controllers/products");

const router = express.Router();

router.get("/all", ProductsController.getAll);
router.post("/bybarcode", ProductsController.getByBarcode);
router.post("/byarticle", ProductsController.getByArticle);
router.post("/search", ProductsController.search);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;