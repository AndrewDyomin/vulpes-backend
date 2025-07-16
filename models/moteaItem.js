const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  article: {
    type: String,
    required: [true, "Article is required"],
  },
  link: {
    type: String,
    default: '',
  },
  brand: {
    type: String,
    default: '',
  },
  gtin: {
    type: String,
    default: '',
  },
  availability: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model("MoteaItem", itemSchema);
