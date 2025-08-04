const mongoose = require("mongoose");

const ordersArchiveSchema = new mongoose.Schema({
  id: {
      type: Number,
      default: 0,
  },
  formId: {
    type: Number,
    default: 0,
  },
  version: {
    type: Number,
    default: 1,
  },
  ord_delivery_data: {
    type: Array,
  },
  primaryContact: {
    type: Object,
  },
  contacts: {
    type: Array,
  },
  externalId: {
    type: String,
  },
  sajt: {
    type: Number,
  },
  utmPage: {
    type: String,
  },
  utmMedium: {
    type: String,
  },
  campaignId: {
    type: Number,
  },
  utmSourceFull: {
    type: String,
  },
  utmSource: {
    type: String,
  },
  utmCampaign: {
    type: String,
  },
  utmContent: {
    type: String,
  },
  utmTerm: {
    type: String,
  },
  nePeredzvonuvati_2: {
    type: Number,
  },
  products: {
    type: Array,
  },
  arlik: {
    type: String,
  },
  shipping_method: {
    type: Number,
  },
  payment_method: {
    type: Number,
  },
  adresDostavki: {
    type: String,
  },
  comment: {
    type: String,
  },
  timeEntryOrder: {
    type: String,
  },
  holderTime: {
    type: String,
  },
  organizationId: {
    type: Number,
  },
  peredanoNaSklad: {
    type: Number,
  },
  orderTime: {
    type: String,
  },
  updateAt: {
    type: String,
  },
  statusId: {
    type: Number,
  },
  paymentDate: {
    type: String,
  },
  paymentAmount: {
    type: Number,
  },
  rejectionReason: {
    type: String,
  },
  userId: {
    type: String,
  },
  commissionAmount: {
    type: Number,
  },
  expensesAmount: {
    type: Number,
  },
  profitAmount: {
    type: Number,
  },
  costPriceAmount: {
    type: Number,
  },
  payedAmount: {
    type: Number,
  },
  shipping_costs: {
    type: Number,
  },
  restPay: {
    type: Number,
  },
  document_ord_check: {
    type: Number,
  },
  typeId: {
    type: Number,
  },
  call: {
    type: Number,
  },
  discountAmount: {
    type: Number,
  },
  token: {
    type: String,
  },
  statusLabel: {
    type: String,
  },
});

module.exports = mongoose.model("ordersArchive", ordersArchiveSchema);