const express = require("express");

const TelegramController = require("../../controllers/telegram");

const router = express.Router();

router.post("/telegram", TelegramController.bot);

module.exports = router;