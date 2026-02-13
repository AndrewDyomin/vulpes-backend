const mongoose = require("mongoose");

const puigArticlesSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, "Code is required"],
  },
  colour: {
    code: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
  },
  stock: {
    type: String,
    default: "no",
  },
  stock_prevision: {
    type: String,
    default: "",
  },
  outdated: {
    type: Number,
    default: 0,
  },
  mesures: {
    packaging: {
      weight: {
        type: String,
        default: null,
      },
      height: {
        type: String,
        default: null,
      },
      width: {
        type: String,
        default: null,
      },
      depth: {
        type: String,
        default: null,
      },
      plastic_weight: {
        type: String,
        default: null,
      },
      cardboard_weight: {
        type: String,
        default: null,
      },
    },
    article: {
      weight: {
        type: String,
        default: null,
      },
      height: {
        type: String,
        default: null,
      },
      height_max: {
        type: String,
        default: null,
      },
      width: {
        type: String,
        default: null,
      },
      depth: {
        type: String,
        default: null,
      },
      thickness: {
        type: String,
        default: null,
      },
    },
  },
  material: {
    type: String,
    default: "",
  },
  barcode: {
    type: String,
    default: "",
  },
  alternative: {
    type: String,
    default: null,
  },
  pvp: {
    type: String,
    default: "",
  },
  pvp_recommended: {
    type: String,
    default: "",
  },
  homologations: {
    abe: {
      type: String,
      default: null,
    },
    eu: {
      type: String,
      default: null,
    },
    dot: {
      type: String,
      default: null,
    },
  },
  origin: {
    type: String,
    default: "",
  },
  hs_code: {
    type: String,
    default: "",
  },
  product: {
    id: {
      type: Number,
      default: null,
    },
  },
  bikes: {
    type: String,
    default: "",
  },
  multimedia: {
    type: String,
    default: "",
  },
  images: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model("PuigArticles", puigArticlesSchema);
