const express = require("express");

const StatController = require("../../controllers/statistic");

const router = express.Router();

router.get("/roi", StatController.getAll);

module.exports = router;