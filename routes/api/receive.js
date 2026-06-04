const express = require("express");

const receiveController = require("../../controllers/receiveProducts");

const router = express.Router();

router.get("/all", receiveController.getAll);
router.post("/get-by-id", receiveController.getById);
router.post("/add", receiveController.add);
router.post("/delete", receiveController.remove);
router.post("/update", receiveController.update);
router.post("/combine", receiveController.combine);
router.post("/download", receiveController.download);
router.post("/report", receiveController.report);
router.get("/all-invoices", receiveController.getAllInvoices);
router.post("/add-invoice", receiveController.addInvoice);
router.post("/del-invoice", receiveController.delInvoice);

module.exports = router;