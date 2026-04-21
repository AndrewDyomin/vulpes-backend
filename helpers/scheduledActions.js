const cron = require("node-cron");
const axios = require("axios");
const sax = require("sax");
const { fork } = require("child_process");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const Product = require("../models/item");
const User = require("../models/user");
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
const { getAll } = require("../controllers/orders");
const { checkProductsUpdates } = require("../controllers/puig");
const { generateFeed } = require("../helpers/zakupka");

const PRODUCTS_URI = process.env.PRODUCTS_URI;
const chatId = process.env.ADMIN_CHAT_ID;
let isChild = false;

async function sendToSheets() {
  const targetId = "1zEvtEGpPQC3Zoc-5N_gVyfdOlNKPR3_ZHBaix-eyBAY";
  try {
    const client = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"],
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
        const product = await Product.findOne({ article: sku }).exec();
        if (product.category === "1167") {
          toTable.push([`${sku}-10`, ...row.slice(1)]);
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
  } catch (err) {
    console.log("Google feed table are not updated. Error:", err.response.data);
    sendTelegramMessage(
      `Во время обновления таблицы в Google MC feed возникла ошибка : ${JSON.stringify(err.response.data)}`,
      chatId,
    );
  }
}

async function importYMLtoGoogleFeed() {
  if (!PRODUCTS_URI) {
    // throw new Error("PRODUCTS_URI не указана в .env");
    sendTelegramMessage("ERROR!!! - PRODUCTS_URI не указана в .env", chatId);
    return;
  }

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
          currentProduct.quantity_in_stock || 0,
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
        `[${new Date().toISOString()}] Парсинг товаров в наличии завершён`,
      );
    });

    parser.on("error", (err) => {
      console.error("Ошибка парсинга:", err.message);
      sendTelegramMessage(
        `Во время обновления товаров в Google MC feed возникла ошибка парсинга: ${err.message}`,
        chatId,
      );
    });

    response.data.pipe(parser);
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта товаров в Google MC feed: ${err.message}`,
      chatId,
    );
  }
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
    statusLabel: "замовити (немає на складі МОТЕА)",
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
  } заказов со статусом "замовити (немає на складі МОТЕА)". 
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
      }`,
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
    statusLabel: "замовити",
  }).exec();
  let inStockNow = [];

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
У нас ${targetArray.length} заказов со статусом "замовити". 
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
      }`,
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

  targetArray = await OrdersArchive.find({
    statusLabel: "замовлено",
  }).exec();
  inStockNow = [];

  console.log("Проверим - замовлено...");

  for (const order of targetArray) {
    const inStock = [];

    if (order.products) {
      for (const product of order.products) {
        const dbItem = await Product.findOne({ article: product.sku }).exec();
        if (product?.isSet && product?.isSet[0] !== null) {
          for (const item of product.isSet) {
            const setItem = await Product.findOne({ article: item.sku }).exec();
            if (setItem?.quantityInStock >= 0) {
              inStock.push(true);
            } else {
              inStock.push(false);
            }
          }
        } else {
          if (dbItem?.quantityInStock >= 0) {
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
У нас ${targetArray.length} заказов со статусом "замовлено". 
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
      }`,
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
  const lowerPrice = [];

  const cursor = Product.find(
    {},
    { article: 1, price: 1, moteaPrice: 1, vendorprice: 1, _id: 0 },
  ).cursor();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Цены");
  worksheet.columns = [
    { header: "Артикул", key: "article", width: 25 },
    { header: "Наш прайс", key: "dbPrice", width: 15 },
    { header: "Прайс в Мотеа", key: "mPrice", width: 15 },
  ];

  console.log("writing price difference table...");

  for await (const item of cursor) {
    const db = Number(item?.price?.UAH);
    const mt = Number(item?.moteaPrice?.UAH) || 0;
    const vendor = Number(item?.vendorprice) || 0;
    let targetPrice = mt;

    if (!db) continue;

    if (vendor) {
      const minPrice = vendor * 1.9 >= db ? vendor * 1.9 : db;

      if (targetPrice < minPrice) {
        targetPrice = minPrice;
        const difference = Math.round((Math.abs(db - targetPrice) / db) * 100);

        if (difference >= 3) {
          lowerPrice.push(item.article);
        }
      }
    }

    if (targetPrice === 0) continue;

    const difference = Math.round((Math.abs(db - targetPrice) / db) * 100);

    if (difference >= 3) {
      c++;
      worksheet.addRow({
        article: item.article,
        dbPrice: item.price.UAH,
        mPrice: Math.round(targetPrice),
      });
    }
  }
  const fileName = `Обновление цен ${c}.xlsx`;
  const filePath = path.join(__dirname, "..", "tmp", fileName);

  await workbook.xlsx.writeFile(filePath);

  if (lowerPrice.length > 0) {
    const limit = 50;

    const text = `Вот список артикулов: ${lowerPrice
      .slice(0, limit)
      .join(", ")}${
      lowerPrice.length > limit
        ? " ...и ещё " + (lowerPrice.length - limit) + " шт."
        : ""
    }`;

    await sendTelegramFile(
      filePath,
      `Для ${lowerPrice.length} артикулов цена была автоматически поднята (т.к. прибыль < 100%).`,
      chatId,
    );
    await sendTelegramMessage(text, chatId);
  } else {
    await sendTelegramFile(filePath, "", chatId);
  }

  fs.unlinkSync(filePath);
}

// Call check price helper
setInterval(() => {
  fetch('https://vulpes-backend-helper.onrender.com/actions/check-price')
    .then(() => {console.log('Helper called.')})
    .catch(() => {});
}, 15 * 60 * 1000);

cron.schedule(    // import products
  "30 */6 * * *",
  () => {
    const importProductsFromYML = path.join(__dirname, "insertSDProducts.js");
    console.log("Время проверить товары в СД");

    const child = fork(importProductsFromYML, [], {
      execArgv: ["--max-old-space-size=50"],
    });

    child.on("exit", async(code) => {
      console.log(`Проверка товаров в СД завершена с кодом ${code}`);
      await generateFeed();
    });

    child.on("error", (err) => {
      console.error("Ошибка проверки товаров в СД:", err);
      sendTelegramMessage(
        `Ошибка при выполнении проверки товаров в СД: ${err}`,
        chatId,
      );
    });
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    //  update prom base 1 per 3 hours
  "20 */3 * * *",
  () => {
    updatePromBase();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    // save Motea feed at 01:10
  "10 1 * * *",
  () => {
    const importMoteaFeed = path.join(__dirname, "moteaProducts.js");
    console.log("Время проверить фид Мотеа");

    const child = fork(importMoteaFeed, [], {
      execArgv: ["--max-old-space-size=50"],
    });

    child.on("exit", async(code) => {
      console.log(`Проверка фида Мотеа завершена с кодом ${code}`);
    });

    child.on("error", (err) => {
      console.error("Ошибка проверки фида:", err);
      sendTelegramMessage(
        `Ошибка при выполнении проверки фида: ${err}`,
        chatId,
      );
    });
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    // check price 1 per 3 hours
  "1 */3 * * *",
  () => {
    if (!isChild) {
      const checkPrice = path.join(__dirname, "checkPrice.js");
      console.log("Время проверить цены");
      isChild = true;

      const child = fork(checkPrice, [], {
        execArgv: ["--max-old-space-size=150"],
      });

      child.on("exit", (code) => {
        console.log(`Проверка цен завершена с кодом ${code}`);
        isChild = false;
      });

      child.on("error", (err) => {
        sendTelegramMessage(`Ошибка проверки цен: ${err}`, chatId);
        console.error("Ошибка проверки цен:", err);
        isChild = false;
      });
    } else {
      console.log("Price check has already started");
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    // orders copy
  "*/30 * * * *",
  async () => {
    try {
      console.log("Копирую заказы...");
      await getAll();
    } catch (err) {
      console.log("Orders copy error: ", err?.code || err);
    }
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
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
          { new: true },
        ).exec();
      }

      count++;
    }

    console.log("Обработано:", count, "недель");
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
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
  },
);

cron.schedule(    //  check not availability orders
  "0 10 * * 1-5",
  async () => {
    console.log(
      'Запуск задачи по проверке заказов в статусе "Заказать (нет на складе MOTEA)"...',
    );

    await checkAvailabilityOrders();

    console.log("Проверка заказов завершена.");

    await sendPriceDifference();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    //  weekly report to owner
  "59 17 * * 5",
  () => {
    reportToOwner();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    //  update rows in db to google feed "available"
  "49 19 * * *",
  () => {
    importYMLtoGoogleFeed();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);

cron.schedule(    //  update google MC feed table
  "55 19 * * *",
  () => {
    sendToSheets();
    checkProductsUpdates();
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  },
);