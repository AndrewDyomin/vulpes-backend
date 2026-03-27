const Product = require("../models/item");
const mongoose = require("mongoose");
const axios = require("axios");
const sax = require("sax");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const CHUNK_SIZE = 500;
const PRODUCTS_URI = process.env.PRODUCTS_URI;
const MAIN_DB_URI = process.env.DB_URI;
const chatId = process.env.ADMIN_CHAT_ID;

async function importProductsFromYML() {
  if (!PRODUCTS_URI) throw new Error("PRODUCTS_URI не указана в .env");

  console.log("Импорт товаров из СД...");

  let operations = [];
  let totalProcessed = 0;
  let totalModified = 0;
  let totalUpserted = 0;
  const maxFlush = 3;
  let flushCount = 0;

  const flush = async () => {
    if (!operations.length) return;
    flushCount++;

    const chunk = operations.splice(0, CHUNK_SIZE);

    try {
      const result = await Product.bulkWrite(chunk, { ordered: false });

      totalProcessed += chunk.length;
      totalModified += result.modifiedCount;
      totalUpserted += result.upsertedCount;

      // console.log({
      //   processed: totalProcessed,
      //   matched: result.matchedCount,
      //   modified: result.modifiedCount,
      //   upserted: result.upsertedCount
      // });
    } catch (err) {
      console.log('bulkWrite error:', err)
    } finally {
      flushCount--;
    }
  };

  const response = await axios.get(PRODUCTS_URI, { responseType: "stream", timeout: 0 });

  const parser = sax.createStream(true, { trim: true });

  let currentTag = null;
  let currentProduct = null;
  let textBuffer = "";
  let currentParamName = null;
  let currentParamValue = "";

  parser.on("opentag", (node) => {
    textBuffer = "";

    if (node.name === "offer") {
      currentProduct = { picture: [], params: {} };
    }

    if (node.name === "param") {
      currentParamName =
        node.attributes.name === "Гарантія"
          ? "warranty"
          : node.attributes.name === "Країна-виробник товару"
          ? "countryOfOrigin"
          : node.attributes.name;

      currentParamValue = "";
    }

    currentTag = node.name;
  });

  parser.on("text", (text) => {
    if (currentProduct && currentTag) {
      textBuffer += text;
    }

    if (currentParamName) {
      currentParamValue += text;
    }
  });

  parser.on("cdata", (text) => {
    if (currentProduct && currentTag) {
      textBuffer += text;
    }
  });

  parser.on("closetag", (tagName) => {
    if (!currentProduct) return;

    if (tagName === "param") {
      currentProduct.params[currentParamName] = currentParamValue;
      currentParamName = null;
      currentParamValue = "";
    }

    if (tagName === "offer") {
      const article = currentProduct.article;
      if (!article) return;

      const oldPrice = Number(currentProduct?.oldprice) || null;
      const price = Number(currentProduct?.price) || null;
      const targetPrice = oldPrice && oldPrice > price ? oldPrice : price;

      const data = {
        "price.UAH": targetPrice,
        "name.UA": currentProduct.name,
        "description.UA": currentProduct.description || "",
        brand: currentProduct.vendor,
        article: currentProduct.article,
        category: currentProduct.categoryId,
        quantityInStock:
          Number(currentProduct.quantity_in_stock) || 0,
        images: Array.isArray(currentProduct.picture)
          ? currentProduct.picture
          : currentProduct.picture
          ? [currentProduct.picture]
          : [],
        params: currentProduct.params,
      };

      if (currentProduct.barcode) {
        data.barcode = currentProduct.barcode;
      }

      if (
        currentProduct?.vendorprice &&
        currentProduct.vendorprice !== "0"
      ) {
        data.vendorprice = Number(currentProduct.vendorprice);
      }

      operations.push({
        updateOne: {
          filter: { article },
          update: { $set: data },
          upsert: true,
        },
      });

      currentProduct = { picture: [], params: {} };
    } else if (currentTag && textBuffer) {
      if (currentTag !== "picture") {
        currentProduct[currentTag] = textBuffer;
      } else {
        currentProduct.picture.push(textBuffer);
      }

      textBuffer = "";
    }
  });

  for await (const chunk of response.data) {
    parser.write(chunk);

    if (operations.length >= CHUNK_SIZE) {
      while (flushCount >= maxFlush) {
        await new Promise(r => setTimeout(r, 50));
      }
      flush();
    }
  }

  parser.end();

  while (operations.length) {
    while (flushCount > 0) {
      await new Promise(r => setTimeout(r, 50));
    }
    await flush();
  }

  console.log("Импорт товаров из СД завершён");
  sendTelegramMessage(
    `База данных товаров успешно обновлена. Обработано ${totalProcessed} товаров (обновлено: ${totalModified}, добавлено: ${totalUpserted}).`,
    chatId
  );

  console.log({
    processed: totalProcessed,
    modified: totalModified,
    upserted: totalUpserted
  });
}


async function insertSDProducts() {
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");
  let retry = 0;

  while (retry <= 3) {
    retry ++;
    try {
      await importProductsFromYML();
      break;
    } catch(err) {
      console.error(`Попытка ${retry} не удалась:`, err);
      await new Promise(r => setTimeout(r, 2000));
      if (retry === 3) {
        sendTelegramMessage(
          `Попытка импорта товаров из СД не удалась: ${err}`,
          chatId
        );
      }
    }
  }

  await mongoose.disconnect();
}

insertSDProducts();