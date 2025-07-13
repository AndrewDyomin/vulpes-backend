const cron = require("node-cron");
const axios = require("axios");
const sax = require("sax");
// const xml2js = require('xml2js');
const Product = require("../models/item");
// const weeklyReport = require("../models/weeklyReport");
// const User = require("../models/user");
// const nodemailer = require("nodemailer");
require("dotenv").config();
const sendTelegramMessage = require('../helpers/sendTelegramMessage')

// async function reportMail(wReport, totalCost, noCostOrders, orderStatusMark) {
//   try {

//     const letterTitle = `Отчет за неделю`;
//     const letterHtml = `
//         <div>
//         <h3 style="margin: 0px;">Добрый день</h3>
//         <p style="margin: 0px; margin-top: 20px;">На этой неделе мы сделали ${wReport.ordersArray.length} заказ(ов).</p>
//         <p style="margin: 0px;">Сумма оборота составляет ${totalCost} грн.</p>
//         ${noCostOrders.length !== 0 ? `
//             <p style="margin: 0px; margin-top: 20px;">Заказы без цены:</p>
//             ${noCostOrders.map(order => `<p style="margin: 0px;">${order.name} №${order.number} заказчик: ${order.dealer}</p>`).join('')}
//         ` : ''}
//         <p style="margin: 0px; margin-top: 20px;">Статистика "Заказ готов":</p>
//         ${orderStatusMark.map(obj => `
//             <p style="margin: 0px; margin-top: 20px; text-align: left;">${obj.user?.name}</p>
//             <div style="margin: 0px;">
//                 ${obj.orders.map(order => `<p style="margin: 0px;">№${order.number} : ${order.name}</p>`).join('')}
//             </div>
//         `).join('')}
//         </div>
//     `;

//     const addresses = 'TARGET.ua@gmail.com';

//     const config = {
//       host: "smtp.meta.ua",
//       port: 465,
//       secure: true,
//       auth: {
//         user: "OUR.bot@meta.ua",
//         pass: process.env.PASSWORD,
//       },
//     };

//     const transporter = nodemailer.createTransport(config);
//     const emailOptions = {
//       from: "OUR.bot@meta.ua",
//       to: addresses,
//       subject: `${letterTitle}`,
//       html: `${letterHtml}`,
//     };

//     transporter
//       .sendMail(emailOptions)
//       .then(() => {console.log(`Letter to ${addresses} sended`)})
//       .catch((err) => console.log(err));
//   } catch (err) {
//     console.log(err);
//   }
// }

const format = (number) => {
  if (number < 10) {
    return "0" + number;
  } else {
    return number;
  }
};

const CHUNK_SIZE = 500;
const PRODUCTS_URI = process.env.PRODUCTS_URI;

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
              ? { UAH: currentProduct.price }
              : {},
          name: { UA: currentProduct.name },
          brand: currentProduct.vendor,
          article: currentProduct.article,
          category: currentProduct.categoryId,
          description: { UA: currentProduct.description },
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
          await Product.insertMany(newProducts.splice(0, CHUNK_SIZE), { ordered: false });
        }

        if (productsToUpdate.length >= CHUNK_SIZE) {
          await Product.bulkWrite(productsToUpdate.splice(0, CHUNK_SIZE), { ordered: false });
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
      sendTelegramMessage('База данных товаров успешно обновлена.')
    });

    parser.on("error", (err) => {
      console.error("Ошибка парсинга:", err.message);
      sendTelegramMessage(`Во время обновления товаров возникла ошибка парсинга: ${err.message}`)
    });

    response.data.pipe(parser);
  } catch (err) {
    console.error(`Ошибка импорта: ${err.message}`);
    sendTelegramMessage(`Ошибка импорта обновлённых товаров: ${err.message}`)
  }
}

// async function importProductsFromYML() {
//   const ymlUrl = process.env.PRODUCTS_URI;
//   if (!ymlUrl) throw new Error('PRODUCTS_URI не указана в .env');

//   try {
//     console.log("Импорт начат...");

//     const response = await axios.get(ymlUrl, { timeout: 10000 });
//     const xml = response.data;

//     const parser = new xml2js.Parser({ explicitArray: false });
//     const result = await parser.parseStringPromise(xml);

//     const offers = result?.yml_catalog?.shop?.offers?.offer || [];
//     const products = Array.isArray(offers) ? offers : [offers];

//     if (products.length === 0) {
//       console.log('В XML не найдено товаров');
//       return;
//     }

//     // Собираем список всех артикулов
//     const allArticles = products.map(p => p.article);

//     // Получаем все товары, которые уже есть в базе
//     const existingDocs = await Product.find({ article: { $in: allArticles } }, 'article _id');
//     const existingArticlesMap = new Map(existingDocs.map(doc => [doc.article, doc._id]));

//     // Делим на новые и существующие
//     const newProducts = [];
//     const productsToUpdate = [];

//     for (const product of products) {
//       const data = {
//         price: product.currencyId === 'UAH' ? { UAH: product.price } : {},
//         name: { UA: product.name },
//         brand: product.vendor,
//         barcode: product.barcode,
//         article: product.article,
//         category: product.categoryId,
//         description: { UA: product.description },
//         images: product.picture,
//       };

//       if (existingArticlesMap.has(product.article)) {
//         productsToUpdate.push({
//           updateOne: {
//             filter: { _id: existingArticlesMap.get(product.article) },
//             update: data,
//           }
//         });
//       } else {
//         newProducts.push(data);
//       }
//     }

//     console.log(`К созданию: ${newProducts.length}, к обновлению: ${productsToUpdate.length}`);

//     // ⚡ Создаём чанками
//     for (let i = 0; i < newProducts.length; i += CHUNK_SIZE) {
//       const chunk = newProducts.slice(i, i + CHUNK_SIZE);
//       await Product.insertMany(chunk, { ordered: false });
//       process.stdout.write(`\rСоздано ${Math.min(i + CHUNK_SIZE, newProducts.length)} из ${newProducts.length}`);
//     }

//     // ⚡ Обновляем чанками
//     for (let i = 0; i < productsToUpdate.length; i += CHUNK_SIZE) {
//       const chunk = productsToUpdate.slice(i, i + CHUNK_SIZE);
//       await Product.bulkWrite(chunk, { ordered: false });
//       process.stdout.write(`\rОбновлено ${Math.min(i + CHUNK_SIZE, productsToUpdate.length)} из ${productsToUpdate.length}`);
//     }

//     console.log(`\n[${new Date().toISOString()}] Импорт завершён: ${products.length} товаров обработано`);
//   } catch (error) {
//     console.error(`\n[${new Date().toISOString()}] Ошибка импорта:`, error.message);
//   }
// }

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

    importProductsFromYML()
  },
  {
    scheduled: true,
    timezone: "Europe/Kiev",
  }
);