const axios = require("axios");
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

      res.status(200).send({ ...response.data });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getByFilter };
