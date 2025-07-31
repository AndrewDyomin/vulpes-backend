const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  article: {
    type: String,
    required: [true, "Article is required"],
  },
  quantityInStock: {
    type: String,
    default: '0',
  },
  parentArt: {
    type: String,
    default: '',
  },
  name: {
    DE: {
      type: String,
      default: "",
    },
    RU: {
      type: String,
      default: "",
    },
    UA: {
      type: String,
      default: "",
    },
    translatedRU: {
      type: String,
      default: "",
    },
    translatedUA: {
      type: String,
      default: "",
    },
  },
  description: {
    DE: {
      type: String,
      default: '',
    },
    RU: {
      type: String,
      default: '',
    },
    UA: {
      type: String,
      default: '',
    },
    translatedRU: {
      type: String,
      default: "",
    },
    translatedUA: {
      type: String,
      default: "",
    },
  },
  shortDescription: {
    DE: {
      type: String,
      default: '',
    },
    RU: {
      type: String,
      default: '',
    },
    UA: {
      type: String,
      default: '',
    },
    translatedRU: {
      type: String,
      default: "",
    },
    translatedUA: {
      type: String,
      default: "",
    },
  },
  brand: {
    type: String,
    default: '',
  },
  barcode: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: '',
  },
  subCategory: {
    type: String,
    default: '',
  },
  price: {
    UAH: {
      type: Number,
      default: 0,
    },
    EUR: {
      type: Number,
      default: 0,
    },
  },
  oldPrice: {
    UAH: {
      type: Number,
      default: 0,
    },
    EUR: {
      type: Number,
      default: 0,
    },
  },
  images: {
    type: Array,
    default: [''],
  },
  color: {
    type: String,
    default: '',
  },
  htmlTitle: {
    RU: {
      type: String,
      default: '',
    },
    UA: {
      type: String,
      default: '',
    },
  },
  metaKeywords: {
    RU: {
      type: String,
      default: '',
    },
    UA: {
      type: String,
      default: '',
    },
  },
  metaDescription: {
    RU: {
      type: String,
      default: '',
    },
    UA: {
      type: String,
      default: '',
    },
  },
  dimensions: {
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    length: {
      type: Number,
      default: 0,
    },
    weight: {
      type: Number,
      default: 0,
    },
  },
  availabilityInMotea: {
    type: String,
    default: '',
  },
  linkInMotea: {
    type: String,
    default: '',
  },
  zoltarifNumber: {
    type: String,
    default: '',
  },
  isSet: {
    type: Array,
    default: [null],
  },
});

module.exports = mongoose.model("Item", itemSchema);
