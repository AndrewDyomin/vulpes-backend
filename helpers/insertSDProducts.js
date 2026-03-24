const Product = require("../models/item");
const mongoose = require("mongoose");
const axios = require("axios");
const sax = require("sax");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const CHUNK_SIZE = 300;
const PRODUCTS_URI = process.env.PRODUCTS_URI;
const MAIN_DB_URI = process.env.DB_URI;
const chatId = process.env.ADMIN_CHAT_ID;

let resolveAllDone;
const allDone = new Promise((resolve) => {
  resolveAllDone = resolve;
});

async function importProductsFromYML() {
  if (!PRODUCTS_URI) throw new Error("PRODUCTS_URI не указана в .env");

  try {
    console.log("Импорт начат...");

    let newProducts = [];
    let productsToUpdate = [];
    let activeTasks = 0;
    const MAX_ACTIVE = 3;
    let flushing = false;

    async function flush() {
      if (flushing) return;
      flushing = true;

      try {
        const insertChunk = newProducts.splice(0);
        const updateChunk = productsToUpdate.splice(0);

        if (insertChunk.length) {
          await Product.insertMany(insertChunk, { ordered: false });
        }

        if (updateChunk.length) {
          await Product.bulkWrite(updateChunk, { ordered: false });
        }
      } finally {
        flushing = false;
      }
    }

    async function processProduct(currentProduct) {
      const article = currentProduct.article;
      if (!article) return;

      const target = await Product.findOne({ article }, { name: 1, description: 1}).lean();

      const oldPrice = Number(currentProduct?.oldprice) || null;
      const price = Number(currentProduct?.price) || null;

      const targetPrice = oldPrice && oldPrice > price ? oldPrice : price;

      const data = {
        price: currentProduct.currencyId === "UAH"
          ? { UAH: targetPrice }
          : {},

        name: {
          UA: currentProduct.name,
          DE: target?.name?.DE,
          RU: target?.name?.RU,
        },

        description: {
          UA: currentProduct.description || "",
          DE: target?.description?.DE,
          RU: target?.description?.RU,
        },

        brand: currentProduct.vendor,
        article: currentProduct.article,
        category: currentProduct.categoryId,
        quantityInStock: Number(currentProduct.quantity_in_stock) || 0,

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

      if (currentProduct?.vendorprice && currentProduct.vendorprice !== '0') {
        // TO DO --------> VENDORPRICE IN UAH OR EURO???
        data.vendorprice = Number(currentProduct.vendorprice);
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

      if (newProducts.length >= CHUNK_SIZE) {
        await flush();
      }

      if (productsToUpdate.length >= CHUNK_SIZE) {
        await flush();
      }
    }

    async function handleProduct(productCopy) {
      activeTasks++;

      try {
        await processProduct(productCopy);
      } finally {
        activeTasks--;

        if (activeTasks < MAX_ACTIVE && response?.data) {
          response.data.resume();
        }
      }
    }

    let currentTag = null;
    let currentProduct = null;
    let textBuffer = "";
    let currentParamName = null;
    let currentParamValue = "";

    let response = await axios.get(PRODUCTS_URI, { responseType: "stream" });
    const parser = sax.createStream(true, { trim: true });

    parser.on("opentag", (node) => {
      textBuffer = "";
      if (node.name === "offer") {
        currentProduct = { picture: [], params: {} };
      } else if (node.name === "param") {
        currentParamName = node.attributes.name === 'Гарантія' ? 'warranty' : node.attributes.name === 'Країна-виробник товару' ? 'countryOfOrigin' : '???';
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
        currentParamValue = '';
      }

      if (tagName === "offer") {
        const productCopy = currentProduct;

        handleProduct(productCopy).catch(console.error);

        if (activeTasks >= MAX_ACTIVE) {
          response.data.pause();
        }

        currentProduct = { picture: [], params: {} };

      } else if (currentProduct && currentTag && textBuffer) {
        if (currentTag !== 'picture') {
          currentProduct[currentTag] = textBuffer;
          textBuffer = "";
        } else {
          currentProduct.picture.push(textBuffer);
          textBuffer = "";
        }
      }
    });

    parser.on("end", async () => {
        const checkDone = setInterval(async () => {
        if (activeTasks === 0 && !flushing) {
          clearInterval(checkDone);

          if (newProducts.length > 0 || productsToUpdate.length > 0) {
            await flush();
          }

          resolveAllDone();
        }
      }, 100);
      console.log(`[${new Date().toISOString()}] Импорт завершён`);
      sendTelegramMessage("База данных товаров успешно обновлена.", chatId);
    });

    parser.on("error", (err) => {
      parser.removeAllListeners();
      response.data.destroy();
      console.error("Ошибка парсинга:", err.message);
      sendTelegramMessage(
        `Во время обновления товаров возникла ошибка парсинга: ${err.message}`,
        chatId,
      );
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(parser);
      parser.on("end", resolve);
      parser.on("error", reject);
    });

    await allDone;
    newProducts.length = 0;
    productsToUpdate.length = 0;
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(
      `Ошибка импорта обновлённых товаров: ${err.message}`,
      chatId,
    );
  }
}


async function insertSDProducts() {
  await mongoose.connect(MAIN_DB_URI);
  console.log("Connected to main DB");
  await importProductsFromYML();
  await mongoose.disconnect();
}

insertSDProducts();