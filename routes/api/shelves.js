const express = require("express");

const ShelvesController = require("../../controllers/shelves");

const router = express.Router();

router.get("/all", ShelvesController.getAllShelves);
router.get("/add", ShelvesController.addShelf);
router.post("/update", ShelvesController.updateShelf);

module.exports = router;