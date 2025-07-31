const mongoose = require("mongoose");

const ordersArchiveSchema = new mongoose.Schema({
  name: {
      type: String,
      default: "",
  },
  orders: {
    type: Array,
    default: [''],
  },
});

module.exports = mongoose.model("ordersArchive", ordersArchiveSchema);