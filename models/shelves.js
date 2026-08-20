const mongoose = require("mongoose");

const shelfSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "",
  },
  items: {
    type: Array,
    default: [],
  },
  room: {
    type: String,
    default: "",
  },
});

module.exports = mongoose.model("Shelf", shelfSchema);
