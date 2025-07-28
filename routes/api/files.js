const express = require("express");

const filesController = require("../../controllers/files");
const { upload } = require("../../middlewares/upload");

const router = express.Router();

router.post("/invoiceParser", upload.single("invoice"), filesController.uploadInvoice)

module.exports = router;