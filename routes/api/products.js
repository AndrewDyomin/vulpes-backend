const express = require("express");

const ProductsController = require("../../controllers/products");

const router = express.Router();

router.get("/all", ProductsController.getAll);
// router.post("/delete", ProductsController.deleteProduct);

module.exports = router;