const mongoose = require("mongoose");

const campaignResult = new mongoose.Schema({
  week: {
      type: String,
      default: "",
  },
  campaigns: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model("CampaignResult", campaignResult);