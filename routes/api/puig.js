const express = require("express");

const PuigController = require("../../controllers/puig");

const router = express.Router();
// const jsonParser = express.json();

router.get("/categories", PuigController.getCategories);
// router.post("/categories", jsonParser, PuigController.getCategories);

module.exports = router;