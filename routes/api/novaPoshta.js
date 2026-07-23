const express = require("express");

const NovaPoshtaController = require("../../controllers/novaPoshta");

const router = express.Router();

router.get("/cities/:value", NovaPoshtaController.getCities);
router.get("/branches/:ref/:value", NovaPoshtaController.getBranches);

module.exports = router;