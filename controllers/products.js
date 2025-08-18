// const axios = require('axios');
// const xml2js = require('xml2js');
const ExcelJS = require("exceljs");
const Product = require("../models/item");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const sendTelegramFile = require("../helpers/sendTelegramFile");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const updateSheets = require("../helpers/updateSheets");
const chatId = process.env.ADMIN_CHAT_ID;

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
  const BATCH_SIZE = 10000;

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
    const BATCH_SIZE = 5000;
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
                ? "Доставка 10 днів"
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
      rowsA.push([String(product.article)]);
      rowsI.push([product.price.UAH, "UAH", "шт."]);
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
        if (startRow === 1 && index === 0) return row;
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
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта обновлённых товаров: ${err.message}`,
      chatId
    );
  }
}

// async function updatePromBase(req, res, next) {
//   try {
//     console.log("Update PromBase started...");
//     let productsInStock = await Product.find({ quantityInStock: { $gt: 0 } }).exec();

//     const client = new google.auth.JWT(
//       process.env.GOOGLE_CLIENT_EMAIL,
//       null,
//       process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//       ["https://www.googleapis.com/auth/spreadsheets"]
//     );

//     await client.authorize();

//     const sheets = google.sheets({ version: "v4", auth: client });
//     const spreadsheetId = "1yAU2eYr4CUg7V8Y7EJ6nYB7nOvoJyMd3adZTZHWAKVU";
//     const ranges = ["Лист1!A2:A", "Лист1!I2:K", "Лист1!M2:N"];
//     let rows

//     for (let i = 0; i < 3; i++) {
//       if (i === 0) {
//         rows = productsInStock.map(product => [String(product.article)])
//       } else if (i === 1) {
//         rows = productsInStock.map(product => [product.price.UAH, 'UAH', 'шт.'])
//       }else if (i === 2) {
//         rows = productsInStock.map(product => ['!', product.quantityInStock])
//       }
//       await sheets.spreadsheets.values.clear({
//         spreadsheetId,
//         range: ranges[i],
//       });

//       await updateSheets(sheets, spreadsheetId, ranges[i], rows);
//     }

//     if (productsInStock.length < 1) {
//       sendTelegramMessage(`Ошибка обновления базы Прома - товары "в наличии" не найдены`, chatId);
//     }
//     productsInStock = null;
//     console.log('Prom base table updated')

//     function delay(ms) {
//       return new Promise(resolve => setTimeout(resolve, ms));
//     }

//     await delay(60000);

//     let { data } = await sheets.spreadsheets.values.get({
//       spreadsheetId,
//       range: "Лист1!A1:BB",
//     });

//     let resultArray = data.values || [];

//     let toWrite = resultArray.map((row, index) => {
//       if (index === 0) {
//         return row;
//       } else {
//         const newRow = [...row]
//         newRow[37] = newRow[37] === '0' ? '' : parseFloat(row[37].replace(",", "."));
//         newRow[38] = newRow[38] === '0' ? '' : parseFloat(row[38].replace(",", "."));
//         newRow[39] = newRow[39] === '0' ? '' : parseFloat(row[39].replace(",", "."));
//         newRow[40] = newRow[40] === '0' ? '' : parseFloat(row[40].replace(",", "."));
//         return newRow;
//       }
//     })

//     data = null;
//     resultArray = null;

//     await sheets.spreadsheets.values.clear({
//       spreadsheetId: "1fmGFTYbCZWn0I3K1-5BWd6nrTImytpyvRhW0Ufz53cw",
//       range: "Лист1!A1:BB",
//     });

//     await updateSheets(
//       sheets,
//       "1fmGFTYbCZWn0I3K1-5BWd6nrTImytpyvRhW0Ufz53cw",
//       "Лист1!A1:BB",
//       toWrite
//     );

//     toWrite = null
//     console.log("Prom base MIRROR updated");
//   } catch (err) {
//     console.error(`Ошибка импорта: ${err.message}`);
//     sendTelegramMessage(
//       `Ошибка импорта обновлённых товаров: ${err.message}`,
//       chatId
//     );
//   }
// }

module.exports = {
  getAll,
  getByBarcode,
  getByArticle,
  search,
  sendAvailabilityTable,
  updatePromBase,
};
