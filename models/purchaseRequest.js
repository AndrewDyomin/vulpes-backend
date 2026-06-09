const mongoose = require("mongoose");

const purchaseRequest = new mongoose.Schema({
  name: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    default: "",
  },
  article: {
    type: String,
    default: "",
  },
});

module.exports = mongoose.model("PurchaseRequest", purchaseRequest);