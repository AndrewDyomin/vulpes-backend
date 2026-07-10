const express = require("express");

const marketplacesController = require("../../controllers/marketplaces");

const router = express.Router();

router.get("/horoshop-check-update-price", marketplacesController.horoshopCheckUpdatePrice);
router.get("/horoshop-update-price", marketplacesController.horoshopUpdatePrice);
router.get("/horoshop-check-outdated-products", marketplacesController.horoshopGetOutdatedProducts);
router.get("/check-images-from-outdated-products", marketplacesController.checkImagesFromOutdatedProducts);
router.post("/horoshop-refresh-outdated-products", marketplacesController.horoshopRefreshOutdatedProducts);
router.post("/add", marketplacesController.addMarketplace);
router.get("/all", marketplacesController.getAllMarketplaces);
router.post("/update-marketplace", marketplacesController.updateMarketplace);
router.get("/generate-xml-for-marketplaces", marketplacesController.generateXmlForMarketplaces);
router.post("/refresh-google-oauth-token", marketplacesController.refreshOauthToken);

module.exports = router;