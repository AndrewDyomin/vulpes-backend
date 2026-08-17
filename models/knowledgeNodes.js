const mongoose = require("mongoose");

const knowledgeNodesSchema = new mongoose.Schema({
  title: {
      type: String,
      default: "",
  },
  description: {
      type: String,
      default: "",
  },
  setStatus: {
      type: String,
      default: "",
  },
  parentIds: {
      type: Array,
      default: [],
  },
});

module.exports = mongoose.model("KnowledgeNodes", knowledgeNodesSchema);