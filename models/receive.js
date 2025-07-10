const mongoose = require("mongoose");

const receiveSchema = new mongoose.Schema({
  name: {
      type: String,
      default: "",
  },
  items: {
    type: Array,
    default: [''],
  },
});

module.exports = mongoose.model("Receive", receiveSchema);
