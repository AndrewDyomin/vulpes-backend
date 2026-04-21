const mongoose = require("mongoose");

const modelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Model name is required"],
    },
    years: {
      type: [Number],
      default: [],
    },
  },
  { _id: false }
);

const bikesSchema = new mongoose.Schema({
  brand: {
    type: String,
    required: [true, "Brand is required"],
    unique: true,
    index: true,
  },
  models: {
    type: [modelSchema],
    default: [],
  },
});

module.exports = mongoose.model("Bikes", bikesSchema);