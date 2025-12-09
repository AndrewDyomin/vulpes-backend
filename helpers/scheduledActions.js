const cron = require("node-cron");
const axios = require("axios");
const sax = require("sax");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const { fork } = require("child_process");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const Product = require("../models/item");
const User = require("../models/user");
const MoteaItem = require("../models/moteaItem");
const TableRow = require("../models/tableRow");
const OrdersArchive = require("../models/ordersArchive");
require("dotenv").config();
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const sendTelegramFile = require("./sendTelegramFile");
const { getAdSpendDirect } = require("./checkAds");
const { reportToOwner } = require("./createWeeklyReport");
const { checkOrdersToOrder } = require("./checkOrders");
const { updatePromBase } = require("../controllers/products");
const CampaignResult = require("../models/campaignResult");
const updateSheets = require("../helpers/updateSheets");
const { google } = require("googleapis");
// const checkPrice = require('./checkPrice');

const CHUNK_SIZE = 500;
const PRODUCTS_URI = process.env.PRODUCTS_URI;
const MAIN_DB_URI = process.env.DB_URI;
const DB_MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
const chatId = process.env.ADMIN_CHAT_ID;
let isChild = false;

const fetchAvailability = async (array) => {
  await mongoose.disconnect();
  console.log("Disconnected from main DB");
  await mongoose.connect(DB_MOTEA_FEED_URI);
  console.log("Connected to Motea feed info DB");

  const articles = array.map((p) => p.article);
  const variantArticles = array.map((p) => `${p.article}-0`);

  const donors = await MoteaItem.find({
    article: { $in: [...articles, ...variantArticles] },
  }).lean();

  const availabilityMap = new Map();
  for (const d of donors) {
    availabilityMap.set(d.article, d.availability);
  }

  const linkMap = new Map();
  for (const d of donors) {
    linkMap.set(d.article, d.link);
  }

  const arrayCopy = array.map((product) => {
    const availability =
      availabilityMap.get(product.article) ||
      availabilityMap.get(`${product.article}-0`) ||
      "";

    const link =
      linkMap.get(product.article) || linkMap.get(`${product.article}-0`) || "";
    return {
      ...product._doc,
      availabilityInMotea: availability,
      linkInMotea: link,
    };
  });

  await mongoose.disconnect();
  console.log("Disconnected from Motea feed info DB");
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");

  return arrayCopy;
};

async function importProductsFromYML() {
  if (!PRODUCTS_URI) throw new Error("PRODUCTS_URI не указана в .env");

  try {
    console.log("Импорт начат...");

    const existingArticlesMap = new Map();

    let cursor = Product.find({}, "article _id name").lean().cursor();
    for await (const doc of cursor) {
      existingArticlesMap.set(doc.article, doc);
    }

    let newProducts = [];
    let productsToUpdate = [];

    let currentTag = null;
    let currentProduct = null;
    let textBuffer = "";

    let response = await axios.get(PRODUCTS_URI, { responseType: "stream" });
    const parser = sax.createStream(true, { trim: true });

    parser.on("opentag", (node) => {
      if (node.name === "offer") {
        currentProduct = {};
      }
      currentTag = node.name;
    });

    parser.on("text", (text) => {
      if (currentProduct && currentTag) {
        textBuffer += text;
      }
    });

    parser.on("closetag", async (tagName) => {
      if (!currentProduct) return;

      if (tagName === "offer") {
        const article = currentProduct.article;
        if (!article) return;
        const target = existingArticlesMap.get(article);
        const oldPrice = Number(currentProduct?.oldprice) || null;
        const price = Number(currentProduct?.price) || null;
        let targetPrice = null;

        if (oldPrice && oldPrice > price) {
          targetPrice = oldPrice;
        } else {
          targetPrice = price;
        }

        const data = {
          price:
            currentProduct.currencyId === "UAH"
              ? {
                  UAH: targetPrice,
                }
              : {},
          name: {
            UA: currentProduct.name,
            DE: target?.name?.DE,
            RU: target?.name?.RU,
          },
          brand: currentProduct.vendor,
          article: currentProduct.article,
          category: currentProduct.categoryId,
          description: { UA: currentProduct.description },
          quantityInStock: Number(currentProduct.quantity_in_stock),
          images: Array.isArray(currentProduct.picture)
            ? currentProduct.picture
            : currentProduct.picture
            ? [currentProduct.picture]
            : [],
        };

        if (currentProduct.barcode) {
          data.barcode = currentProduct.barcode;
        }

        if (target) {
          productsToUpdate.push({
            updateOne: {
              filter: { _id: target._id },
              update: data,
            },
          });
        } else {
          newProducts.push(data);
        }

        currentProduct = null;

        if (newProducts.length >= CHUNK_SIZE) {
          await Product.insertMany(newProducts.splice(0, CHUNK_SIZE), {
            ordered: false,
          });
        }

        if (productsToUpdate.length >= CHUNK_SIZE) {
          await Product.bulkWrite(productsToUpdate.splice(0, CHUNK_SIZE), {
            ordered: false,
          });
        }
      } else if (currentProduct && currentTag && textBuffer) {
        currentProduct[currentTag] = textBuffer;
        textBuffer = "";
      }
    });

    parser.on("end", async () => {
      if (newProducts.length > 0) {
        await Product.insertMany(newProducts, { ordered: false });
      }

      if (productsToUpdate.length > 0) {
        await Product.bulkWrite(productsToUpdate, { ordered: false });
      }

      console.log(`[${new Date().toISOString()}] Импорт завершён`);
      sendTelegramMessage("База данных товаров успешно обновлена.", chatId);
    });

    parser.on("error", (err) => {
      console.error("Ошибка парсинга:", err.message);
      sendTelegramMessage(
        `Во время обновления товаров возникла ошибка парсинга: ${err.message}`,
        chatId
      );
    });

    await response.data.pipe(parser);
    response = null;
    cursor = null;
    newProducts = [];
    productsToUpdate = [];
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта обновлённых товаров: ${err.message}`,
      chatId
    );
  }
}

async function sendToSheets() {
  const targetId = "1zEvtEGpPQC3Zoc-5N_gVyfdOlNKPR3_ZHBaix-eyBAY";
  const client = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  await client.authorize();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: targetId,
    range: "Лист1!A2:V20200",
  });

  const batch = 100;
  let skip = 0;
  let hasMore = true;
  let startRow = 2;

  while (hasMore) {
    const rows = await TableRow.find({}).skip(skip).limit(batch).exec();

    if (!rows.length) break;

    const toTable = rows.map((item) => item.row);
    const endRow = startRow + toTable.length - 1;
    const range = `Лист1!A${startRow}:V${endRow}`;

    await updateSheets(sheets, targetId, range, toTable);

    startRow = endRow + 1;
    skip += batch;

    if (rows.length < batch) {
      hasMore = false;
    }
  }

  const tableOfCovers = "131RvA-bT2mnqc05jtJiN2S_SW5e9wLIa9beBs6rUWQo"; // Таблица с чехлами
  await sheets.spreadsheets.values.clear({
    spreadsheetId: tableOfCovers,
    range: "Лист1!A2:V20200",
  });
  skip = 0;
  hasMore = true;
  startRow = 2;

  while (hasMore) {
    const rows = await TableRow.find({}).skip(skip).limit(batch).exec();

    if (!rows.length) break;

    const toTable = [];

    for (const obj of rows) {
      const row = obj.row;
      const sku = row[0].replace("-9", "");
      const product = await Product.findOne({article: sku}).exec();
      if (product.category === "1167") {
        toTable.push([`${sku}-10`, ...row.slice(1)])
      }
    }

    const endRow = startRow + toTable.length - 1;
    const range = `Лист1!A${startRow}:V${endRow}`;

    await updateSheets(sheets, tableOfCovers, range, toTable);

    startRow = endRow + 1;
    skip += batch;

    if (rows.length < batch) {
      hasMore = false;
    }
  }
}

async function importYMLtoGoogleFeed() {
  if (!PRODUCTS_URI) throw new Error("PRODUCTS_URI не указана в .env");

  try {
    console.log("Импорт в Google MC feed начат...");
    await TableRow.collection.drop();

    let currentTag = null;
    let currentProduct = null;
    let currentParamName = null;
    let textBuffer = "";

    const response = await axios.get(PRODUCTS_URI, { responseType: "stream" });
    const parser = sax.createStream(true, { trim: true });

    parser.on("opentag", (node) => {
      currentTag = node.name;

      if (node.name === "offer") {
        currentProduct = { ...node.attributes, pictures: [], params: {} };
      }

      if (node.name === "param") {
        currentParamName = node.attributes.name;
      }
    });

    parser.on("text", (text) => {
      if (currentProduct && currentTag) textBuffer += text;
    });

    parser.on("cdata", (cdata) => {
      if (currentProduct && currentTag) textBuffer += cdata;
    });

    parser.on("closetag", async (tagName) => {
      if (!currentProduct) return;

      if (tagName === "offer") {
        currentProduct.quantity_in_stock = Number(
          currentProduct.quantity_in_stock || 0
        );
        currentProduct.price = Number(currentProduct.price || 0);
        currentProduct.oldprice = Number(currentProduct.oldprice || 0);

        if (!currentProduct.article) return;
        if (currentProduct.quantity_in_stock < 1) return;
        if (!currentProduct.url) return;
        if (currentProduct.url && !currentProduct.url.includes("vulpes.com.ua"))
          return;
        if (currentProduct.pictures.length === 0) return;

        const picturesString = currentProduct.pictures.slice(1).join(",");
        let upperPrice;
        let lowerPrice;

        if (!currentProduct.oldprice) {
          upperPrice = `${currentProduct.price} UAH`;
          lowerPrice = "";
        } else {
          upperPrice = `${currentProduct.oldprice} UAH`;
          lowerPrice = `${currentProduct.price} UAH`;
        }

        const row = [
          `${currentProduct.article}-9`,
          currentProduct.name,
          currentProduct.description || "",
          "in_stock",
          "",
          "",
          currentProduct.url,
          "",
          currentProduct.pictures[0] || "",
          upperPrice,
          lowerPrice,
          "",
          "no",
          "",
          "",
          currentProduct.vendor || "",
          "",
          "",
          picturesString,
          "new",
          "no",
        ];

        await TableRow.create({ row });

        currentProduct = null;
      } else if (textBuffer) {
        if (tagName === "picture") {
          currentProduct.pictures.push(textBuffer);
        } else if (tagName === "param" && currentParamName) {
          currentProduct.params[currentParamName] = textBuffer;
          currentParamName = null;
        } else if (tagName === "description") {
          currentProduct.description = textBuffer.trim();
        } else {
          currentProduct[tagName] = textBuffer.trim();
        }
        textBuffer = "";
      }
    });

    parser.on("end", async () => {
      console.log(
        `[${new Date().toISOString()}] Парсинг товаров в наличии завершён`
      );
    });

    parser.on("error", (err) => {
      console.error("Ошибка парсинга:", err.message);
      sendTelegramMessage(
        `Во время обновления товаров в Google MC feed возникла ошибка парсинга: ${err.message}`,
        chatId
      );
    });

    response.data.pipe(parser);
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта товаров в Google MC feed: ${err.message}`,
      chatId
    );
  }
}

async function saveMoteaFeedToDb() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("Disconnected from main DB");
    }

    await mongoose.connect(DB_MOTEA_FEED_URI);
    console.log("Connected to Motea feed info DB");
    await MoteaItem.collection.drop();

    const url = process.env.MOTEA_FEED;
    let response = await axios.get(url, { responseType: "stream" });

    let batch = [];
    let totalCount = 0;

    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv({ separator: "|" }))
        .on("data", (row) => {
          if (row.link) {
            const item = {
              name: row.title, // delete if errors.
              link: row.link,
              article: row.id,
              brand: row.brand,
              gtin: row.gtin,
              availability: row.availability,
            };

            batch.push(item);
            totalCount++;

            if (batch.length === 1000) {
              response.data.pause();
              MoteaItem.insertMany(batch)
                .then(() => {
                  batch = [];
                  batch.length = 0;
                  response.data.resume();
                })
                .catch((err) => {
                  console.error("Ошибка batch insert:", err);
                  sendTelegramMessage(`Ошибка копирования фида в базу: ${err}`);
                  reject(err);
                });
            }
          }
        })
        .on("end", async () => {
          if (batch.length > 0) {
            try {
              await MoteaItem.insertMany(batch);
            } catch (err) {
              console.error("Ошибка финального insertMany:", err);
              sendTelegramMessage(
                `Ошибка финального insertMany в базу: ${err}`
              );
              reject(err);
            }
          }

          console.log(`Обработка завершена. Всего записей: ${totalCount}`);
          sendTelegramMessage(
            `Я скопировал фид МОТЕА, новая информация уже в базе. Всего записей: ${totalCount}.`,
            chatId
          );
          resolve();
        })
        .on("error", (err) => {
          console.error("Ошибка чтения CSV:", "err");
          reject(err);
        });
    });

    response = null;

    await mongoose.disconnect();
    console.log("Disconnected from Motea feed info DB");

    await mongoose.connect(MAIN_DB_URI);
    console.log("Reconnected to main DB");
  } catch (err) {
    console.error("Ошибка обработки:", "err");
  }
}

async function updateProductsAvailability() {
  const BATCH_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`${skip / 1000}).`);
    let batch = await Product.find({}).skip(skip).limit(BATCH_SIZE).exec();

    const updatedBatch = await fetchAvailability(batch);

    const operations = updatedBatch.map((product) => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            availabilityInMotea: product.availabilityInMotea || null,
            linkInMotea: product.linkInMotea || null,
          },
        },
      },
    }));

    if (operations.length > 0) {
      await Product.bulkWrite(operations);
    }

    skip += BATCH_SIZE;
    hasMore = batch.length === BATCH_SIZE;
    batch = null;
  }
  sendTelegramMessage("Информация о наличии товаров в МОТЕА обновлена.", chatId);
}

function getLastWeeksRanges() {
  const result = [];
  const today = new Date();
  const endOfLastWeek = new Date(today);

  while (endOfLastWeek.getDay() !== 0) {
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
  }

  for (let i = 0; i < 6; i++) {
    const end = new Date(endOfLastWeek);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    result.unshift({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  }

  return result;
}

async function checkAvailabilityOrders() {
  let targetArray = await OrdersArchive.find({
    statusLabel: "заказать (нет на складе МОТЕА)",
  }).exec();
  const availableNow = [];

  for (const order of targetArray) {
    let isAvailable = false;

    if (order.products) {
      for (const product of order.products) {
        const dbItem = await Product.findOne({ article: product.sku }).exec();
        if (product?.isSet && product?.isSet[0] !== null) {
          for (const item of product.isSet) {
            const setItem = await Product.findOne({ article: item.sku }).exec();
            if (setItem?.availabilityInMotea === "in stock") {
              isAvailable = true;
            } else {
              isAvailable = false;
            }
          }
        } else {
          if (dbItem?.availabilityInMotea === "in stock") {
            isAvailable = true;
          } else {
            isAvailable = false;
          }
        }
      }
    }

    if (isAvailable) {
      availableNow.push(order);
    }
  }

  let message = `
Привет! 
У нас ${
    targetArray.length
  } заказов со статусом "заказать (нет на складе МОТЕА)". 
${
  availableNow?.length > 0
    ? `По моим данным для ${availableNow.length} заказов товары появились в наличии.`
    : ""
}
Вот информация о них:
${availableNow
  .map(
    (order, index) =>
      `${index + 1}). #${order.id} - (${order.products[0].sku})${
        order.products[0].text
      }`
  )
  .join("\n")}

Эти заказы еще актуальны?
Пожалуйста перепроверь.
`;

  if (availableNow?.length && availableNow.length > 0) {
    const managers = await User.find({ role: "manager" }).exec();
    sendTelegramMessage(message, chatId);
    if (managers[0].chatId) {
      sendTelegramMessage(message, managers[0].chatId);
    }
  }

  targetArray = await OrdersArchive.find({
    statusLabel: "заказать",
  }).exec();
  const inStockNow = [];

  for (const order of targetArray) {
    const inStock = [];

    if (order.products) {
      for (const product of order.products) {
        const dbItem = await Product.findOne({ article: product.sku }).exec();
        if (product?.isSet && product?.isSet[0] !== null) {
          for (const item of product.isSet) {
            const setItem = await Product.findOne({ article: item.sku }).exec();
            if (setItem?.quantityInStock > 0) {
              inStock.push(true);
            } else {
              inStock.push(false);
            }
          }
        } else {
          if (dbItem?.quantityInStock > 0) {
            inStock.push(true);
          } else {
            inStock.push(false);
          }
        }
      }
    }

    if (!inStock.includes(false)) {
      inStockNow.push(order);
    }
  }

  message = `
Привет! 
У нас ${
    targetArray.length
  } заказов со статусом "заказать". 
${
  inStockNow?.length > 0
    ? `По моим данным для ${inStockNow.length} заказов товары есть в наличии на складе.`
    : ""
}
Вот информация о них:
${inStockNow
  .map(
    (order, index) =>
      `${index + 1}). #${order.id} - (${order.products[0].sku})${
        order.products[0].text
      }`
  )
  .join("\n")}

Может я где-то ошибся?
Пожалуйста перепроверь.
`;

  if (inStockNow?.length && inStockNow.length > 0) {
    const managers = await User.find({ role: "manager" }).exec();
    sendTelegramMessage(message, chatId);
    if (managers[0].chatId) {
      sendTelegramMessage(message, managers[0].chatId);
    }
  }
}

async function sendPriceDifference() {
  let c = 0;
  const cursor = Product.find({}, { article: 1, price: 1, moteaPrice: 1, _id: 0 }).cursor();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Цены");
  worksheet.columns = [
    { header: "Артикул", key: "article", width: 25 },
    { header: "Наш прайс", key: "dbPrice", width: 15 },
    { header: "Прайс в Мотеа", key: "mPrice", width: 15 },
  ];

  console.log('writing price difference table...')

  for await(const item of cursor) {
    const db = Number(item?.price?.UAH);
    const mt = Number(item?.moteaPrice?.UAH);

    if (!db || !mt) continue;

    const difference = Math.round(Math.abs(db - mt) / db * 100);

    if (difference >= 5) {
      c++;
      worksheet.addRow({
        article: item.article,
        dbPrice: item.price.UAH,
        mPrice: item.moteaPrice.UAH,
      });
    }
  }
  const fileName = `Обновление цен ${c}.xlsx`;
  const filePath = path.join(__dirname, "..", "tmp", fileName);

  await workbook.xlsx.writeFile(filePath);
  await sendTelegramFile(filePath, "", chatId);
  fs.unlinkSync(filePath);
}

cron.schedule(    // import products at 01:00
  "0 1 * * *",
  () => {
    try {
      importProductsFromYML();
    } catch (error) {
      console.error("Ошибка при выполнении cron-задачи:", error);
      sendTelegramMessage(
        `Ошибка при выполнении cron-задачи: ${error}`,
        chatId
      );
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    // import products at 17:30
  "30 17 * * *",
  () => {
    try {
      importProductsFromYML();
    } catch (error) {
      console.error("Ошибка при выполнении cron-задачи:", error);
      sendTelegramMessage(
        `Ошибка при выполнении cron-задачи: ${error}`,
        chatId
      );
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(
  //  update prom base at 15:30
  "30 15 * * *",
  () => {
    updatePromBase();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(
  "10 1 * * *",
  () => {
    try {
      saveMoteaFeedToDb();
    } catch (error) {
      console.error("Ошибка при выполнении cron-задачи:", error);
      sendTelegramMessage(
        `Ошибка при выполнении cron-задачи: ${error}`,
        chatId
      );
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  update availability at 01:20
  "20 1 * * *",
  () => {
    try {
      updateProductsAvailability();
    } catch (error) {
      console.error("Ошибка при выполнении cron-задачи:", error);
      sendTelegramMessage(
        `Ошибка при выполнении cron-задачи: ${error}`,
        chatId
      );
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  update availability at 17:50
  "50 17 * * *",
  () => {
    try {
      updateProductsAvailability();
    } catch (error) {
      console.error("Ошибка при выполнении cron-задачи:", error);
      sendTelegramMessage(
        `Ошибка при выполнении cron-задачи: ${error}`,
        chatId
      );
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(
  "1 */3 * * *",
  () => {
    if (!isChild) {
      const checkPrice = path.join(__dirname, "checkPrice.js");
      console.log("Время проверить цены");
      isChild = true;

      const child = fork(checkPrice);

      child.on("exit", (code) => {
        sendTelegramMessage(`Проверка цен завершена с кодом ${code}`, chatId);
        console.log(`Проверка цен завершена с кодом ${code}`);
        isChild = false;
      });

      child.on("error", (err) => {
        sendTelegramMessage(`Ошибка проверки цен: ${err}`, chatId);
        console.error("Ошибка проверки цен:", err);
        isChild = false;
      });
    } else {
      console.log('Price check has already started')
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  check ad spend
  "0 15 * * 1",
  async () => {
    console.log("Запуск задачи по сбору расходов из Google Analitics");

    const weeks = getLastWeeksRanges();
    let count = 0;

    for (const week of weeks) {
      console.log(`Собираем данные за ${week.startDate} - ${week.endDate}`);
      const result = await getAdSpendDirect(week.startDate, week.endDate);

      if (!result || result.length === 0) continue;

      const weekKey = `${week.startDate}_${week.endDate}`;

      const weekReport = await CampaignResult.findOne({ week: weekKey }).exec();

      if (!weekReport) {
        await CampaignResult.create({
          week: weekKey,
          campaigns: result,
        });
      } else {
        await CampaignResult.findByIdAndUpdate(
          weekReport._id,
          { campaigns: result },
          { new: true }
        ).exec();
      }

      count++;
    }

    console.log("Обработано:", count, "недель");
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  check orders
  "5 10 * * 3",
  async () => {
    console.log('Запуск задачи по проверке заказов в статусе "Заказать"...');

    await checkOrdersToOrder();

    console.log("Проверка заказов завершена.");
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  check not availability orders
  "0 10 * * 1-5",
  async () => {
    console.log(
      'Запуск задачи по проверке заказов в статусе "Заказать (нет на складе MOTEA)"...'
    );

    await checkAvailabilityOrders();

    console.log("Проверка заказов завершена.");
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  weekly report to owner
  "59 17 * * 5",
  () => {
    reportToOwner();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  update available rows base
  "49 19 * * *",
  () => {
    importYMLtoGoogleFeed();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  update google MC feed table
  "55 19 * * *",
  () => {
    sendToSheets();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);

cron.schedule(    //  send updated price
  "45 10 * * 1-5",
  async () => {
    await sendPriceDifference();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);