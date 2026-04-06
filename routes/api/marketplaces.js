const express = require("express");

const marketplacesController = require("../../controllers/marketplaces");

const router = express.Router();

router.get("/horoshop-check-update-price", marketplacesController.horoshopCheckUpdatePrice);
router.get("/horoshop-update-price", marketplacesController.horoshopUpdatePrice);

module.exports = router;