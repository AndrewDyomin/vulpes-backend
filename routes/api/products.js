const express = require("express");
const isAuth = require("../../middlewares/isAuth");
const ProductsController = require("../../controllers/products");

const router = express.Router();

router.get("/all", ProductsController.getAll);
router.get("/all-barcodes", ProductsController.getAllBarcodes);
router.get("/compare-year", isAuth, ProductsController.compareYear);
router.post("/bybarcode", ProductsController.getByBarcode);
router.post("/byarticle", ProductsController.getByArticle);
router.post("/search", ProductsController.search);
router.post("/availability", isAuth, ProductsController.sendAvailabilityTable);
router.post("/update-prom-base", isAuth, ProductsController.updatePromBase);
router.post("/update", isAuth, ProductsController.updateProduct);
router.post("/get-translate", isAuth, ProductsController.getProductTranslate);
router.get("/bikes", ProductsController.getBikes)
router.post("/add-to-purchase-request", isAuth, ProductsController.addToPurchaseRequest);
router.post("/remove-from-purchase-request", isAuth, ProductsController.removeFromPurchaseRequest);
router.get("/all-purchase-requests", isAuth, ProductsController.getAllPurchaseRequests);

module.exports = router;