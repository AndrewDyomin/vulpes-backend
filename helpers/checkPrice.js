const Product = require("../models/item");
const axios = require("axios");
const mongoose = require("mongoose");
const MoteaItem = require("../models/moteaItem");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const sendTelegramFile = require("../helpers/sendTelegramFile");

const MAIN_DB_URI = process.env.DB_URI;
const DB_MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
const chatId = process.env.ADMIN_CHAT_ID;

const format = (number) => {
  if (number < 10) {
    return "0" + number;
  } else {
    return number;
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const fetchLinks = async (array) => {
  await mongoose.disconnect();
  console.log("Disconnected from main DB");
  await mongoose.connect(DB_MOTEA_FEED_URI);
  console.log("Connected to Motea feed info DB");

  const articles = array.map((p) => p.article);
  const variantArticles = array.map((p) => `${p.article}-0`);

  const donors = await MoteaItem.find({
    article: { $in: [...articles, ...variantArticles] },
  }).lean();

  const donorMap = new Map();
  for (const d of donors) {
    donorMap.set(d.article, d.link);
  }

  const arrayCopy = array.map((product) => {
    const link =
      donorMap.get(product.article) ||
      donorMap.get(`${product.article}-0`) ||
      "";
    return {
      ...product._doc,
      link: link,
    };
  });

  await mongoose.disconnect();
  console.log("Disconnected from Motea feed info DB");
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");

  return arrayCopy;
};

function extractGa4Data(html) {
  const startToken = '<script type="text/x-magento-init">';
  const endToken = "</script>";

  const startIndex = html.indexOf(startToken);
  const endIndex = html.indexOf(endToken, startIndex);

  if (startIndex === -1 || endIndex === -1) {
    console.log("Скрипт не найден");
    return null;
  }

  const jsonScript = html
    .slice(startIndex + startToken.length, endIndex)
    .trim();

  try {
    const parsed = JSON.parse(jsonScript);
    const data = parsed["*"]?.magepalGtmDatalayer?.data;
    return data || null;
  } catch (err) {
    console.error("Ошибка при разборе JSON:", err.message);
    return null;
  }
}

async function sendExcel(data, name) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Цены");
  worksheet.columns = [
    { header: "Артикул", key: "article", width: 25 },
    { header: "Наш прайс", key: "dbPrice", width: 15 },
    { header: "Motea", key: "mArticle", width: 15 },
    { header: "Прайс в Мотеа", key: "mPrice", width: 15 },
  ];
  for (const row of data) {
    worksheet.addRow({
      article: row[0],
      dbPrice: row[1],
      mArticle: row[2],
      mPrice: row[3],
    });
  }
  const fileName = `${name}.xlsx`;
  const filePath = path.join(__dirname, "..", "tmp", fileName);

  await workbook.xlsx.writeFile(filePath);
  await sendTelegramFile(filePath, "", chatId);
  fs.unlinkSync(filePath);
}

async function priceCheck() {
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");
  const now = new Date();
  const today = format(now.getDate());
  const month = format(now.getMonth() + 1);
  const exchangeRate = 48.5;
  const dbItems = await Product.find({}, { article: 1, price: 1, _id: 0 });
  const linksArray = await fetchLinks(dbItems);
  let excelData = [];
  const errors = [];
  let nameIndex = 1;
  let i = 0;

  for (const item of linksArray) {
    if (i >= 200) {
      await sleep(30000);
      i = 0;
    }

    const link = item.link;

    if (!link || link === "") {
      continue;
    }

    try {
      const response = await axios.get(link);
      const data = extractGa4Data(response.data);
      if (!data) continue;
      const mItem = data.find((i) => i?.product?.price)?.product;
      if (!mItem) continue;
      const currency = data.find((i) => i?.ecommerce)?.ecommerce?.currencyCode;
      mItem.currency = currency;

      const dbPrice = item.price.UAH;
      const mPrice = Math.round(mItem.price * exchangeRate);
      let difference = Math.round(
        ((Number(dbPrice) - Number(mPrice)) / Number(dbPrice)) * 100
      );

      if (Number(dbPrice) < Number(mPrice)) {
        difference = Math.round(
          ((Number(mPrice) - Number(dbPrice)) / Number(mPrice)) * 100
        );
      }

      if (difference < 3) {
        continue;
      }

      excelData.push([item.article, dbPrice, mItem.sku, mPrice]);

      if (excelData.length >= 5000) {
        await sendExcel(excelData, `Changed price ${today}.${month}(${nameIndex})`);
        nameIndex++;
        excelData.length = 0;
        excelData = [];
      }
    } catch (err) {
      if (err?.response?.status === 429) {
        console.log("Block 429!!!");
        await sleep(180000);
      }
      errors.push(['-', 'Ошибка при обработке артикула', item.article, err.message]);
    }
    i++;
  }

  await sendExcel(excelData, `Changed price ${today}.${month}(${nameIndex})`);
  await sendExcel(errors, `Errors ${today}.${month}`);

  await mongoose.disconnect();
  process.exit(0);
}

priceCheck();
