const mongoose = require("mongoose");

const inventoryCheckSchema = new mongoose.Schema({
  name: {
      type: String,
      default: "",
  },
  items: {
    type: Array,
    default: [''],
  },
});

module.exports = mongoose.model("InventoryCheck", inventoryCheckSchema);
