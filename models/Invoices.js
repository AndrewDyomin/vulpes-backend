const mongoose = require("mongoose");

const invoicesSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
    unique: true,
    index: true,
  },
  items: {
    type: Array,
    default: [],
  },
  total: {
    type: Number,
    default: 0,
  },
  verified: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Invoices", invoicesSchema);