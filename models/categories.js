const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
  },
  id: {
    type: String,
    default: "",
  },
  parentId: {
    type: String,
    default: "",
  },
  promGroup: {
    type: String,
    default: null,
  },
  promCategory: {
    type: Number,
    default: null,
  },
});

module.exports = mongoose.model("Category", categorySchema);