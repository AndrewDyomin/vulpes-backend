// const axios = require('axios');
// const xml2js = require('xml2js');
const ExcelJS = require("exceljs");
const Product = require("../models/item");
const MoteaItem = require("../models/moteaItem");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const sendTelegramFile = require("../helpers/sendTelegramFile");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const updateSheets = require("../helpers/updateSheets");
const chatId = process.env.ADMIN_CHAT_ID;
const DB_MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
const MAIN_DB_URI = process.env.DB_URI;

async function getAll(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find().skip(skip).limit(limit).exec(),
      Product.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getByBarcode(req, res, next) {
  const barcode = req.body.barcode;
  try {
    const product = await Product.findOne({ barcode }).exec();
    return res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
}

async function getByArticle(req, res, next) {
  const article = req.body.article;
  try {
    const product = await Product.findOne({ article }).exec();

    return res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    const value = req.body.value?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = { article: { $regex: value, $options: "i" } };

    let [products, total] = await Promise.all([
      Product.find(query).skip(skip).limit(limit).exec(),
      Product.countDocuments(query),
    ]);

    if (products?.length < 1) {
      query = { "name.UA": { $regex: value, $options: "i" } };

      [products, total] = await Promise.all([
        Product.find(query).skip(skip).limit(limit).exec(),
        Product.countDocuments(query),
      ]);
    }

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function sendAvailabilityTable(req, res, next) {
  const BATCH_SIZE = 5000;

  const { user } = req.user;

  if (!user.chatId) {
    return res
      .status(200)
      .send({ message: "you don’t have a chat with the bot in telegram" });
  }
  if (user.role !== "owner") {
    return res.status(200).send({ message: "you don’t have access" });
  }

  try {
    const fileName = `availability-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, "..", "tmp", fileName);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: filePath,
    });
    const worksheet = workbook.addWorksheet("Наличие");

    worksheet.columns = [
      { header: "Артикул", key: "article", width: 25 },
      { header: "Фид", key: "availabilityInMotea", width: 15 },
      { header: "Склад", key: "quantityInStock", width: 15 },
      { header: "Наличие", key: "availability", width: 15 },
    ];

    const total = await Product.countDocuments();
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const products = await Product.find({})
        .skip(i * BATCH_SIZE)
        .limit(BATCH_SIZE)
        .lean()
        .exec();

      for (const product of products) {
        worksheet
          .addRow({
            article: product.article,
            availabilityInMotea: product.availabilityInMotea || "",
            quantityInStock: product.quantityInStock || "",
            availability:
              product.quantityInStock > 0
                ? "В наявності"
                : product.availabilityInMotea === "in stock"
                ? "Доставка 10-18 днів"
                : "Немає в наявності",
          })
          .commit();
      }
    }

    await worksheet.commit();
    await workbook.commit();

    await sendTelegramFile(filePath, "Таблица наличия", user.chatId);
    fs.unlinkSync(filePath);

    return res
      .status(200)
      .send({ message: "the table will be sent to your telegram" });
  } catch (error) {
    next(error);
  }
}

async function updatePromBase(req, res, next) {
  try {
    console.log("Update PromBase started...");

    const client = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    await client.authorize();

    const sheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = "1yAU2eYr4CUg7V8Y7EJ6nYB7nOvoJyMd3adZTZHWAKVU";

    const cursor = Product.find({ quantityInStock: { $gt: 0 } })
      .lean()
      .cursor();
    let rowsA = [];
    let rowsI = [];
    let rowsM = [];

    for await (const product of cursor) {
      const price = product.price.UAH;
      rowsA.push([String(product.article)]);
      rowsI.push([price, "UAH", "шт."]);
      rowsM.push(["!", product.quantityInStock]);
    }

    const ranges = ["Лист1!A2:A", "Лист1!I2:K", "Лист1!M2:N"];
    const rowsArr = [rowsA, rowsI, rowsM];

    for (let i = 0; i < 3; i++) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: ranges[i],
      });
      await updateSheets(sheets, spreadsheetId, ranges[i], rowsArr[i]);
      rowsArr[i] = null;
    }

    rowsA = null;
    rowsI = null;
    rowsM = null;
    console.log("Prom base table updated...");

    await new Promise((resolve) => setTimeout(resolve, 60000));

    const parseCell = (cell) =>
      !cell || cell === "0" ? "" : parseFloat(cell.replace(",", "."));

    const sourceId = spreadsheetId;
    const targetId = "1fmGFTYbCZWn0I3K1-5BWd6nrTImytpyvRhW0Ufz53cw";
    let startRow = 1;
    const chunkSize = 1000;
    const noIdItems = [];

    await sheets.spreadsheets.values.clear({
      spreadsheetId: "1fmGFTYbCZWn0I3K1-5BWd6nrTImytpyvRhW0Ufz53cw",
      range: "Лист1!A1:BB",
    });

    while (true) {
      const endRow = startRow + chunkSize - 1;
      const range = `Лист1!A${startRow}:BB${endRow}`;

      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId: sourceId,
        range,
      });

      const rows = data.values || [];
      if (rows.length === 0) break;

      if (rows.every((row) => !row[0] || row[0].trim() === "")) {
        break;
      }

      const toWrite = rows.map((row, index) => {
        if (row[17] === '') {
          noIdItems.push(row[0])
        }
        if (startRow === 1 && index === 0) return row;
        row[8] = row[23] === "" ? row[8] : Math.round(Number(row[8] * 1.176));
        row[37] = parseCell(row[37]);
        row[38] = parseCell(row[38]);
        row[39] = parseCell(row[39]);
        row[40] = parseCell(row[40]);
        return row;
      });

      await updateSheets(sheets, targetId, range, toWrite);

      startRow = endRow + 1;
    }

    console.log("Prom base MIRROR updated");
    if (noIdItems.length > 0) {
      sendTelegramMessage(`Удали дубли в Проме. Я нашел артикулы без ID: ${noIdItems.join(', ')}.`, chatId)
    }

    if (res) {
      return res.status(200).send({ message: "Prom base MIRROR updated" });
    }
  } catch (err) {
    console.error(`Ошибка обновления базы Прома: ${err.message}`);
    sendTelegramMessage(
      `Ошибка обновления базы Прома: ${err.message}`,
      chatId
    );
  }
}

async function compareYear (req, res, next) {

  if (!req?.user?.user?.chatId || req?.user?.user?.chatId === '') {
    return res.status(200).send({ message: "you don't have chatid in our telegram bot" });
  }

  const batch = 1000;
  const total = await Product.countDocuments();       
  const totalBatches = Math.ceil(total / batch);
  let itemsWithYears = [];

  try {

  for (let i = 0; i < totalBatches; i++) {
    const products = await Product.find({})
      .skip(i * batch)
      .limit(batch)
      .lean()
      .exec();

    for(const product of products) {
      if (/\b\d{2}-\d{2}\b/.test(product?.name?.UA)) {
        itemsWithYears.push({article: product.article, name: product.name.UA})
      }
    }
  }

  await mongoose.disconnect();
  console.log("Disconnected from main DB");
  await mongoose.connect(DB_MOTEA_FEED_URI);
  console.log("Connected to Motea feed info DB");

  let allArticles = itemsWithYears.flatMap(item => [item.article, item.article + '-0']);

  let products = await MoteaItem.find({ article: { $in: allArticles } }).exec();

  let productMap = new Map(products.map(p => [p.article, p.name]));

  for (const item of itemsWithYears) {
    item.trueName = productMap.get(item.article + '-0') || productMap.get(item.article) || undefined;
  }

  allArticles = null;
  products = null;
  productMap = null;

  await mongoose.disconnect();
  console.log("Disconnected from Motea feed info DB");
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");
  
  let wrongYears = [];

  for (const item of itemsWithYears) {
    if (item.name && item.trueName) {
      const year = item.name.match(/\b(\d{2})-(\d{2})\b/);
      const trueYear = item.trueName.match(/\b(\d{2})-(\d{2})\b/);
      if (year && trueYear && year[0] !== trueYear[0]) {
        item.fixedName = item.name.replace(year[0], trueYear[0]);
        wrongYears.push(item)
      }
    }
  }

  if (wrongYears.length > 0) {
    const fileName = `fixed-names.xlsx`;
    const filePath = path.join(__dirname, "..", "tmp", fileName);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: filePath,
    });
    const worksheet = workbook.addWorksheet("Products");

    worksheet.columns = [
      { header: "Артикул", key: "article", width: 25 },
      { header: "Исправленное название", key: "fixedName", width: 35 },
      { header: "Название в базе", key: "name", width: 35 },
      { header: "Название у МОТЕА", key: "trueName", width: 35 },
    ];

    for (const product of wrongYears) {
      worksheet
        .addRow({
          article: product.article,
          fixedName: product.fixedName || "",
          name: product.name || "",
          trueName: product.trueName || "",
        })
        .commit();
    }

    await worksheet.commit();
    await workbook.commit();

    await sendTelegramFile(filePath, "Таблица с исправленными названиями", req.user.user.chatId);
    fs.unlinkSync(filePath);
  }
  
  const count = wrongYears.length
  itemsWithYears = null;
  wrongYears = null;
  if (count > 0) {
    return res.status(200).send({ message: `Found ${count} wrong names. The table will be sent to your telegram.` });
  } else {
    return res.status(200).send({ message: "invalid years not found" });
  }
} catch(error) {
  console.log(error);
  return res.status(200).send({ message: error });
}
}

module.exports = {
  getAll,
  getByBarcode,
  getByArticle,
  search,
  sendAvailabilityTable,
  updatePromBase,
  compareYear,
};
