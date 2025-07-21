const cron = require("node-cron");
const axios = require("axios");
const sax = require("sax");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const { fork } = require("child_process");
const path = require("path");
const Product = require("../models/item");
const MoteaItem = require("../models/moteaItem");
require("dotenv").config();
const sendTelegramMessage = require("../helpers/sendTelegramMessage");

const CHUNK_SIZE = 500;
const PRODUCTS_URI = process.env.PRODUCTS_URI;
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

  const donorMap = new Map();
  for (const d of donors) {
    donorMap.set(d.article, d.availability);
  }

  const arrayCopy = array.map((product) => {
    const availability =
      donorMap.get(product.article) ||
      donorMap.get(`${product.article}-0`) ||
      "";
    return {
      ...product._doc,
      availabilityInMotea: availability,
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

    const existingDocs = await Product.find({}, "article _id");
    const existingArticlesMap = new Map(
      existingDocs.map((doc) => [doc.article, doc._id])
    );

    const newProducts = [];
    const productsToUpdate = [];

    let currentTag = null;
    let currentProduct = null;
    let textBuffer = "";

    const response = await axios.get(PRODUCTS_URI, { responseType: "stream" });

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

        const data = {
          price:
            currentProduct.currencyId === "UAH"
              ? {
                  UAH:
                    currentProduct.oldprice >= currentProduct.price
                      ? currentProduct.oldprice
                      : currentProduct.price,
                }
              : {},
          name: { UA: currentProduct.name },
          brand: currentProduct.vendor,
          article: currentProduct.article,
          category: currentProduct.categoryId,
          description: { UA: currentProduct.description },
          quantityInStock: currentProduct.quantity_in_stock,
          images: Array.isArray(currentProduct.picture)
            ? currentProduct.picture
            : currentProduct.picture
            ? [currentProduct.picture]
            : [],
        };

        if (currentProduct.barcode) {
          data.barcode = currentProduct.barcode;
        }

        if (existingArticlesMap.has(article)) {
          productsToUpdate.push({
            updateOne: {
              filter: { _id: existingArticlesMap.get(article) },
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

    response.data.pipe(parser);
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта обновлённых товаров: ${err.message}`,
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
    const response = await axios.get(url, { responseType: "stream" });

    let batch = [];
    let totalCount = 0;

    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv({ separator: "|" }))
        .on("data", (row) => {
          if (row.link) {
            const item = {
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
                  console.error("Ошибка batch insert:", "err");
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
              console.error("Ошибка финального insertMany:", "err");
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
    const batch = await Product.find({}).skip(skip).limit(BATCH_SIZE).exec();

    const updatedBatch = await fetchAvailability(batch);

    const operations = updatedBatch.map((product) => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: { availabilityInMotea: product.availabilityInMotea || null },
        },
      },
    }));

    if (operations.length > 0) {
      await Product.bulkWrite(operations);
    }

    skip += BATCH_SIZE;
    hasMore = batch.length === BATCH_SIZE;
  }
  sendTelegramMessage(
    "Информация о наличии товаров в МОТЕА обновлена.",
    chatId
  );
}

cron.schedule(
  "0 1 * * *",
  () => {
    const now = new Date();
    const today = format(now.getDate());
    const month = format(now.getMonth() + 1);
    const hours = format(now.getHours());
    const minutes = format(now.getMinutes());
    const seconds = format(now.getSeconds());
    console.log(
      `Scheduled function triggered at ${today}.${month} ${hours}:${minutes}:${seconds}.`
    );

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

cron.schedule(
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

cron.schedule(
  "30 20 * * *",
  () => {
    const checkPrice = path.join(__dirname, "checkPrice.js");
    console.log("Запуск проверки цен...");

    const child = fork(checkPrice);

    child.on("exit", (code) => {
      sendTelegramMessage(`Проверка цен завершёна с кодом ${code}`, chatId);
      console.log(`Проверка цен завершёна с кодом ${code}`);
    });

    child.on("error", (err) => {
      sendTelegramMessage(`Ошибка проверки цен: ${err}`, chatId);
      console.error("Ошибка проверки цен:", err);
    });
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);
