const axios = require("axios");
const cheerio = require("cheerio");
const OrdersArchive = require("../models/ordersArchive");
const Product = require("../models/item");
const ordersArchive = require("../models/ordersArchive");
const { google } = require("googleapis");
const updateSheets = require("../helpers/updateSheets");
require("dotenv").config();
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const chatId = process.env.ADMIN_CHAT_ID;

const url = "https://vulpes.salesdrive.me/api/order/list/";
const headers = {
  "Form-Api-Key": process.env.SD_API_KEY,
  "Content-Type": "application/json",
};

// [
//     { value: 1, text: 'новый'},
//     { value: 2, text: 'в обработке' },
//     { value: 3, text: 'На отправку' },
//     { value: 4, text: 'Отправлен' },
//     { value: 5, text: 'Продажа' },
//     { value: 6, text: 'Отказ' },
//     { value: 7, text: 'Возврат' },
//     { value: 8, text: 'Удален' },
//     { value: 9, text: 'Ожидает' },
//     { value: 10, text: 'оплачен ?' },
//     { value: 12, text: 'отменен' },
//     { value: 13, text: 'заказать' },
//     { value: 14, text: 'заказать (нет на складе МОТЕА)' },
//     { value: 15, text: 'Появилось в наличии' },
//     { value: 16, text: 'Замовити в МРА' },
//     { value: 17, text: 'Заказано' },
//   ]

async function getAll(req, res, next) {
  let allOrders = [];
  try {
    await OrdersArchive.collection.drop();

    const params = {
      page: 1,
      filter: {
        statusId: ["1", "2", "3", "4", "9", "10", "11", "13", "14", "15", "16", "17"],
      },
    };
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${params.page}...`);
      let response = await axios.get(url, { headers, params });
      const pagination = response.data.pagination;
      if (pagination.pageCount <= pagination.currentPage) {
        hasMore = false;
      }
      params.page++;
      const statusOptions = response.data.meta.fields.statusId.options;
      const ordersArray = response.data.data;

      for (const order of ordersArray) {
        const option = statusOptions.find(
          (status) => Number(status.value) === Number(order.statusId)
        );
        order.statusLabel = option.text;
        if (order?.products) {
          for (const product of order.products) {
            const target = await Product.findOne({
              article: product.sku,
            }).exec();
            if (target?.isSet && target.isSet[0] !== null) {
              product.isSet = target.isSet;
            }
          }
        }
      }

      response = null;
      allOrders.push(...ordersArray);
    }

    await OrdersArchive.insertMany(allOrders);
    allOrders = null;
    console.log("Заказы скопированы");
  } catch (error) {
    console.error("Error fetching orders:", error);
    sendTelegramMessage(`Ошибка при синхронизации заказов: ${error}`, chatId);
  }
}

async function getByArticle(req, res, next) {
  const targetArticle = req.body.article;
  const stopList = [4, 10, 5, 6, 7, 12, 8];
  const resultOrders = [];
  try {
    const archive = await ordersArchive.find({}).exec();
    for (const order of archive) {
      if (stopList.includes(Number(order.statusId))) {
        continue;
      }
      let bool = false;
      const doc = {
        number: order.id,
        articles: [],
        status: order?.statusLabel || null,
      };
      for (const product of order.products) {
        const parent = { article: product.sku, set: [] };
        if (product.sku === targetArticle) {
          bool = true;
        }
        if (product?.isSet && product.isSet[0] !== null) {
          parent.set.push(...product.isSet);
          // if (product.isSet.includes(targetArticle)) {
          if (product.isSet.some(item => item?.sku === targetArticle)) {
            bool = true;
          }
        }
        doc.articles.push(parent);
      }
      if (bool) {
        resultOrders.push(doc);
      }
    }
    return res.status(200).send({ result: resultOrders });
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
        filter: { statusId: "3" },
      };

      const response = await axios.get(url, { headers, params });

      for (const order of response.data.data) {
        const trackingNumber = order.ord_delivery_data[0].trackingNumber || "";
        const npMark = `https://my.novaposhta.ua/orders/printMarking85x85/orders[]/${trackingNumber}/type/html/apiKey/${process.env.NP_API_KEY}`;
        const res = await axios.get(npMark);
        const $ = cheerio.load(res.data);

        const $img = $(".Barcode img");
        const relativeSrc = $img.attr("src");
        const absoluteSrc = `https://my.novaposhta.ua${relativeSrc}`;

        order.ord_delivery_data[0].marking = absoluteSrc;
      }
      return res.status(200).send({ ...response.data });
    } else if (filter === "in-work" || filter === 0) {
      const params = {
        page: 1,
        filter: { statusId: ["1", "2", "3", "4", "9", "10", "11", "13", "14", "15", "16", "17"] },
      };

      const response = await axios.get(url, { headers, params });
      const statusOptions = response.data.meta.fields.statusId.options;
      const ordersArray = response.data.data;

      for (const order of ordersArray) {
        const option = statusOptions.find(
          (stat) => Number(stat.value) === Number(order.statusId)
        );
        order.statusLabel = option?.text;
      }

      return res.status(200).send({ ...response.data });
    } else {
      const params = {
        page: 1,
        filter: { statusId: filter },
      };

      const response = await axios.get(url, { headers, params });
      const statusOptions = response.data.meta.fields.statusId.options;
      const ordersArray = response.data.data;

      for (const order of ordersArray) {
        const option = statusOptions.find(
          (stat) => Number(stat.value) === Number(order.statusId)
        );
        order.statusLabel = option?.text;
      }

      return res.status(200).send({ ...response.data });
    }
  } catch (error) {
    console.log(error)
    next(error);
  }
}

async function orderedStatus(req, res, next) {
  const ordersArray = req.body.orders
  console.log(ordersArray)

  try {
    const url = "https://vulpes.salesdrive.me/api/order/update/";
    const headers = {
      "X-Api-Key": process.env.X_API_KEY,
      "Content-Type": "application/json",
    };

    for (const order of ordersArray) {
      const data = {
        id: order,
        data: {
          statusId: "17",
        },
      };

      await axios.post(url, data, { headers });
    }

    
    res.status(200).send({ message: "OK" });
  } catch(err) {
    console.log(err)
  }
  
}

async function calcOrdersToMotea(req, res, next) {
  if (!req.body?.orders || req.body.orders.length === 0) {
    res.status(200).send({ message: "Список заказов пуст. Проверьте отметки 'JA/NEIN' на листе Bestellung, там не должно быть пустых ячеек." })
    return;
  }
  const ordersFromTable = req.body.orders;
  const rows = [["order №", "sku", "amount"]];
  const orderArray = [];

  for (const i of ordersFromTable) {
    const target = await OrdersArchive.findOne({ id: Number(i) }).exec();
    const order = {
      id: target.id,
      statusLabel: target.statusLabel,
      products: target.products.map((product) => ({
        amount: product.amount,
        sku: product.sku,
        isSet: product.isSet || [],
      })),
    };
    for (const product of order.products) {
      if (
        product.isSet &&
        product.isSet?.length > 0 &&
        product.isSet[0] !== null
      ) {
        for (const item of product.isSet) {
          const targetChild = orderArray.find(order => order.item === item.sku)
          if (!targetChild) {
              const child = { order: [order.id], item: item.sku, amount: product.amount * item.count};
              orderArray.push(child);
          } else {
              targetChild.order.push(order.id);
              targetChild.amount += product.amount * item.count;
          }
        }
      } else {
          const targetChild = orderArray.find(order => order.item === product.sku)
          if (!targetChild) {
              const child = { order: [order.id], item: product.sku, amount: product.amount};
              orderArray.push(child);
          } else {
              targetChild.order.push(order.id);
              targetChild.amount += product.amount;
          }
      }
    }
  }

  for (const i of orderArray) {
    const row = [`${i.order.join(', ')}`, `${i.item}`, i.amount]; 
    rows.push(row);
  }

  const client = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  await client.authorize();

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = "16kaSBC3xnJQON80jYzUE5ok7N37R_vXGUmpJHX4A6Uw";
  const range = "Endgültige Bestellung!A:Z";
  await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
  });

  await updateSheets(sheets, spreadsheetId, range, rows);

  res.status(200).send({ message: "Компоненты заказа пересчитаны" })
};

module.exports = { getAll, getByFilter, getByArticle, orderedStatus, calcOrdersToMotea };