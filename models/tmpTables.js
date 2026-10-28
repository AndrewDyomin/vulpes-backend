const mongoose = require("mongoose");

const tmpTablesSchema = new mongoose.Schema({
  rows: {
    type: Array,
    default: [],
  },
  status: {
    type: String,
    enum: ["confirmed", "processing"],
    default: "processing",
    required: [true, "status is required"],
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  }
});

tmpTablesSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("TmpTables", tmpTablesSchema);