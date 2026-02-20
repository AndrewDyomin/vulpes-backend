const express = require("express");

const PuigController = require("../../controllers/puig");

const router = express.Router();
// const jsonParser = express.json();

router.get("/categories", PuigController.getCategories);
router.post("/categories", PuigController.updateCategory);
router.get("/categories/:id", PuigController.getCategoryById);
router.get("/products-by-category/:id", PuigController.getProductsByCategory);
router.get("/product-by-id/:id", PuigController.getProductById);
router.post("/translate/", PuigController.translateString);
router.post("/update-product/", PuigController.updateProduct);
router.get("/check-articles-updates", PuigController.checkProductsUpdates);

module.exports = router;