const mongoose = require("mongoose");

const tableRowSchema = new mongoose.Schema({
  row: {
    type: Array,
    default: [''],
  },
});

module.exports = mongoose.model("TableRow", tableRowSchema);
