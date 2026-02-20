const mongoose = require("mongoose");

const puigLastUpdateSchema = new mongoose.Schema({
  date: {
    type: String,
    required: [true, "Date is required"],
  },
  previousDate: {
    type: String,
    default: '2026-01-01 01:00:00',
  },
});

module.exports = mongoose.model("PuigLastUpdate", puigLastUpdateSchema);
