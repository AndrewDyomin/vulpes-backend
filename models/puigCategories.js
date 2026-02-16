const mongoose = require("mongoose");

const puigCategoriesSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: [true, "Id is required"],
  },
  title: {
    type: String,
    default: '',
  },
  title_ru: {
    type: String,
    default: '',
  },
  title_uk: {
    type: String,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model("PuigCategories", puigCategoriesSchema);