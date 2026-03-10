const express = require("express");
const path = require("path");
const { generateFeed } = require("../../helpers/zakupka");

const filesController = require("../../controllers/files");
const { upload } = require("../../middlewares/upload");
const isAuth = require("../../middlewares/isAuth");

const router = express.Router();

router.post("/invoiceParser", isAuth, upload.single("invoice"), filesController.uploadInvoice);
router.post("/download-table-for-broker", isAuth, filesController.downloadBrokerTable);
router.get("/zakupka.xml", (req, res) => { const filePath = path.join(__dirname, "../../", "public", "xml", "zakupka.xml"); res.sendFile(filePath);})
router.get("/update-zakupka", async (req, res) => { await generateFeed(); res.status(200).send('ok');})

module.exports = router;