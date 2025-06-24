const cron = require("node-cron");
const axios = require('axios');
const xml2js = require('xml2js');
const Product = require('../models/item');
// const weeklyReport = require("../models/weeklyReport");
// const User = require("../models/user");
// const nodemailer = require("nodemailer");
require("dotenv").config();

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
        return ('0' + number);
    } else {
        return number;
    }
}

async function importProductsFromYML() {
  const ymlUrl = process.env.PRODUCTS_URI;

  if (!ymlUrl) {
    throw new Error('PRODUCTS_URI не указана в .env');
  }

  try {
    console.log("Import started")

    const response = await axios.get(ymlUrl, { timeout: 10000 });
    const xml = response.data;

    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);

    const offers = result?.yml_catalog?.shop?.offers?.offer || [];
    const products = Array.isArray(offers) ? offers : [offers];

    if (products.length === 0) {
      console.log('В XML не найдено товаров');
      return;
    }

    console.log(products[1])

    await Product.deleteMany({});
    await Product.insertMany(products);

    console.log(`[${new Date().toISOString()}] Импортировано ${products.length} товаров`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка импорта:`, error.message);
  }
}


cron.schedule('0 1 * * *', () => {
    const now = new Date();
    const today = format(now.getDate())
    const month = format(now.getMonth() + 1)
    const hours = format(now.getHours())
    const minutes = format(now.getMinutes())
    const seconds = format(now.getSeconds())
  console.log(`Scheduled function triggered at ${today}.${month} ${hours}:${minutes}:${seconds}.`);
  
  importProductsFromYML()
}, {
  scheduled: true,
  timezone: "Europe/Kiev"
});

