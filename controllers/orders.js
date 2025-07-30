const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

const url = "https://vulpes.salesdrive.me/api/order/list/";
const headers = {
  "Form-Api-Key": process.env.SD_API_KEY,
  "Content-Type": "application/json",
};

async function getAll(req, res, next) {
  try {
    res.status(200).json({ orders: "All orders" });
  } catch (error) {
    next(error);
  }
}

async function getByFilter(req, res, next) {
  const { filter } = req.body;
  try {
    if (filter === "for-shipping") {
      const params = {
        page: 1,
        filter: {"statusId": '3'}
      };

      const response = await axios.get(url, { headers, params });

      for (const order of response.data.data) {
        const trackingNumber = order.ord_delivery_data[0].trackingNumber || '';
        const npMark = `https://my.novaposhta.ua/orders/printMarking85x85/orders[]/${trackingNumber}/type/html/apiKey/${process.env.NP_API_KEY}`
        const res = await axios.get(npMark);
        const $ = cheerio.load(res.data);

        const $img = $(".Barcode img");
        const relativeSrc = $img.attr("src");
        const absoluteSrc = `https://my.novaposhta.ua${relativeSrc}`;

        order.ord_delivery_data[0].marking = absoluteSrc;

      }
    return res.status(200).send({ ...response.data });
    } else if (filter === "in-work") {
      const params = {
        page: 1,
        filter: {"statusId": ['1','2']}
      };

      const response = await axios.get(url, { headers, params });
      const statusOptions = response.data.meta.fields.statusId.options;
      const ordersArray = response.data.data;

      for (const order of ordersArray) {
        const option = statusOptions.find(status => status.value === order.statusId)
        order.statusLabel = option.text;
      }

      return res.status(200).send({ ...response.data });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getByFilter };
