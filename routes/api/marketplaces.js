const express = require("express");

const marketplacesController = require("../../controllers/marketplaces");

const router = express.Router();

router.get("/horoshop-check-update-price", marketplacesController.horoshopCheckUpdatePrice);
router.get("/horoshop-update-price", marketplacesController.horoshopUpdatePrice);
router.get("/horoshop-check-outdated-products", marketplacesController.horoshopGetOutdatedProducts);
router.post("/horoshop-refresh-outdated-products", marketplacesController.horoshopRefreshOutdatedProducts);

module.exports = router;