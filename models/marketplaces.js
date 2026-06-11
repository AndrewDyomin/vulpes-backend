const mongoose = require("mongoose");

const marketplacesSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
    unique: true,
    index: true,
  },
  markup: {
    type: Number,
    default: 0,
  },
  xml: {
    path: {
      type: String,
      default: "",
    },
    generate: {
      type: Boolean,
      default: false,
    },
  },
  logo: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Marketplaces", marketplacesSchema);
