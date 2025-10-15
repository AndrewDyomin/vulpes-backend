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
});

module.exports = mongoose.model("Category", categorySchema);