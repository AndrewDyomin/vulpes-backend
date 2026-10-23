const express = require("express");
const isAuth = require("../../middlewares/isAuth");
const partAuth = require("../../middlewares/partAuth");
const ProductsController = require("../../controllers/products");

const router = express.Router();

router.get("/all", partAuth, ProductsController.getAll);
router.get("/all-barcodes", partAuth, ProductsController.getAllBarcodes);
router.get("/compare-year", isAuth, ProductsController.compareYear);
router.post("/bybarcode", partAuth, ProductsController.getByBarcode);
router.post("/byarticle", partAuth, ProductsController.getByArticle);
router.post("/search", partAuth, ProductsController.search);
router.post("/availability", isAuth, ProductsController.sendAvailabilityTable);
router.post("/update-prom-base", isAuth, ProductsController.updatePromBase);
router.post("/update", isAuth, ProductsController.updateProduct);
router.post("/get-translate", isAuth, ProductsController.getProductTranslate);
router.get("/bikes", partAuth, ProductsController.getBikes)
router.post("/add-to-purchase-request", isAuth, ProductsController.addToPurchaseRequest);
router.post("/remove-from-purchase-request", isAuth, ProductsController.removeFromPurchaseRequest);
router.get("/all-purchase-requests", isAuth, ProductsController.getAllPurchaseRequests);
router.post("/update-category", isAuth, ProductsController.updateCategory);
router.get("/get-products-from-sd", isAuth, ProductsController.getProductsFromSd);
router.post("/sended-products", partAuth, ProductsController.chechSendedProducts);

module.exports = router;