const mongoose = require("mongoose");

const puigBikesSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: [true, "Id is required"],
  },
  brand: {
    type: String,
    default: '',
  },
  brand_id: {
    type: Number,
    required: [true, "Brand-id is required"],
  },
  model: {
    type: String,
    default: '',
  },
  model_id: {
    type: Number,
    required: [true, "Model-id is required"],
  },
  year: {
    type: String,
    default: '',
  },
  typ: {
    type: String,
    default: '',
  },
  displacement: {
    type: Number,
    default: null,
  },
  articles: {
    type: String,
    default: '',
  },
  multimedia: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model("PuigBikes", puigBikesSchema);
