const MoteaItem = require("../models/moteaItem");
const Product = require("../models/item");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const mongoose = require("mongoose");
const axios = require("axios");
const csv = require("csv-parser");

const MAIN_DB_URI = process.env.DB_URI;
const MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
const chatId = process.env.ADMIN_CHAT_ID;

async function saveMoteaFeedToDb() {
  try {
    await mongoose.connect(MOTEA_FEED_URI);
    console.log("Копирую фид МОТЕА");
    await MoteaItem.collection.drop();

    const url = process.env.MOTEA_FEED;
    let response = await axios.get(url, { responseType: "stream" });

    let batch = [];
    let totalCount = 0;
    let totalRows = 0;

    await new Promise((resolve, reject) => {
      response.data
        .pipe(csv({ separator: "|" }))
        .on("data", (row) => {
          totalRows++;
          if (totalRows % 1000 === 0) {
            console.log(totalRows);
          }
          
          if (row.link) {
            const item = {
              name: row.title,
              link: row.link,
              article: row.id,
              brand: row.brand,
              gtin: row.gtin,
              availability: row.availability,
            };

            batch.push(item);
            totalCount++;

            if (batch.length >= 1000) {
              response.data.pause();
              const toInsert = batch.splice(0);
              MoteaItem.insertMany(toInsert)
                .then(() => {
                  response.data.resume();
                })
                .catch((err) => {
                  console.error("Ошибка batch insert:", err);
                  sendTelegramMessage(`Ошибка копирования части фида в базу: ${err}`, chatId);
                  response.data.resume();
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
                `Ошибка финального insertMany в базу: ${err}`,
              );
              reject(err);
            }
          }

          console.log(`Обработка завершена. Всего записей: ${totalCount}`);
          sendTelegramMessage(
            `Я скопировал фид МОТЕА, новая информация уже в базе. Всего записей: ${totalCount}.`,
            chatId,
          );
          resolve();
        })
        .on("error", (err) => {
          console.error("Ошибка чтения CSV:", err);
          reject(err);
        });
    });

    response = null;
    await mongoose.disconnect();
  } catch (err) {
    console.error("Ошибка обработки:", err);
    await mongoose.disconnect();
  }
}

const fetchAvailability = async (array) => {
  await mongoose.disconnect();
  await mongoose.connect(MOTEA_FEED_URI);
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

  availabilityMap.clear();
  linkMap.clear();
  await mongoose.disconnect();
  await mongoose.connect(MAIN_DB_URI);
  return arrayCopy;
};

async function updateProductsAvailability() {
  await mongoose.connect(MAIN_DB_URI);
  const BATCH_SIZE = 1000;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`${skip / 1000}). Обновляем статус наличия товаров в Мотеа`);
    let batch = await Product.find({}, { article: 1 }).skip(skip).limit(BATCH_SIZE).lean();

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
  sendTelegramMessage(
    "Информация о наличии товаров в МОТЕА обновлена.",
    chatId,
  );
  await mongoose.disconnect();
}

async function queue() {
    try {
        await saveMoteaFeedToDb();
        await updateProductsAvailability();
        process.exit(0);
    } catch(err) {
        console.log(err)
        process.exit(1);
    }
}

queue();