const express = require("express");

const leversController = require("../../controllers/levers");
const isAuth = require("../../middlewares/isAuth");

const router = express.Router();

router.post("/update", isAuth, leversController.updateLever);
router.post("/get-by-bike", leversController.getByBike);
router.post("/get-image", leversController.getTopImage);

module.exports = router;