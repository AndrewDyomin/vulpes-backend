const mongoose = require("mongoose");

const puigProductsSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: [true, "Id is required"],
  },
  title: {
    type: String,
    default: '',
  },
  category_id: {
    type: Number,
    required: [true, "Category-id is required"],
  },
  description: {
    type: String,
    default: '',
  },
  zones: {
    type: Array,
    default: [],
  },
  functionalities: {
    type: Array,
    default: [],
  },
  technical: {
    type: Array,
    default: [],
  },
  references: {
    type: String,
    default: '',
  },
  multimedia: {
    type: String,
    default: '',
  },
  bikes: {
    type: String,
    default: '',
  },
  category: {
    id: {
      type: Number,
      default: null,
    },
    title: {
      type: String,
      default: '',
    },
  },
  articles: {
    type: Array,
    default: [],
  },
  images: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model("PuigProducts", puigProductsSchema);
