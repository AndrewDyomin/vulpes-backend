const express = require("express");

const knowledgeController = require("../../controllers/knowledge");

const router = express.Router();

router.get("/all-nodes", knowledgeController.getAllNodes);
router.post("/update-node", knowledgeController.updateNode);
router.post("/add-child", knowledgeController.addChild);
router.post("/add-between", knowledgeController.addBetween);
router.post("/delete-node", knowledgeController.delNode);
router.post("/add-link", knowledgeController.addLink);

module.exports = router;