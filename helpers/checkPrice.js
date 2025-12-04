const Product = require("../models/item");
const axios = require("axios");
const mongoose = require("mongoose");
const MoteaItem = require("../models/moteaItem");
const cheerio = require('cheerio');

const MAIN_DB_URI = process.env.DB_URI;
const DB_MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
let isWorkong = false;
const blackList = ['265984', 'A544007', '239859', '560012', '247557', 'A017124', '992918', 'A041129', '287483', '950647', 'A111768', 'A108957', 'A108939', 'A108973', 'A108985', 'A108949'];

// const format = (number) => {
//   if (number < 10) {
//     return "0" + number;
//   } else {
//     return number;
//   }
// };

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

function extractSearchData(html) {
  const startToken = '<ol class="products list items product-items motea-list">';
  const endToken = "</ol>";

  const startIndex = html.indexOf(startToken);
  const endIndex = html.indexOf(endToken, startIndex);

  if (startIndex === -1 || endIndex === -1) {
    console.log("Список не найден");
    return null;
  }

  const listHtml = html.slice(startIndex, endIndex + endToken.length);

  const $ = cheerio.load(listHtml);

  const result = [];

  $('li[data-producturl]').each((_, li) => {
    const url = $(li).attr('data-producturl');

    const price = $(li).find('span.special-price > span.price-container > span.price-wrapper[data-price-amount]').attr('data-price-amount') || null;

    if (url && price) {
      result.push({ url, price });
    }
  });

  return result.length > 0 ? result : null;
}

async function checkPrice() {

  if (isWorkong) {
    return; 
  }

  try {
    isWorkong = true;
    console.log("Price check started...");

    console.log("Connected to main DB");
    const now = new Date();
    const exchangeRate = 48.5;
    const dbItems = await Product.find({}, { article: 1, price: 1, moteaPrice: 1, _id: 0 });
    const linksArray = await fetchLinks(dbItems);
    const errors = [];
    let c = 0;

    for (const item of dbItems) {
      c++
      if (c % 100 === 0) {
        console.log(c, ' : ', dbItems.length)
      }

      if (blackList.includes(item.article)) {
        console.log(item.article, ' in black list!!!');
        continue;
      }

      const dateDifference = now - new Date(item.moteaPrice.date);
      if (dateDifference < 86400000 || blackList.includes(item.article)) {
        continue;
      }

      const link = linksArray.find(i => i.article === item.article)?.link || linksArray.find(i => i.article === `${item.article}-0`)?.link;
      if (!link) {
        continue;
      }

      try {
        const response = await axios.get(link);
        await sleep(1000);
        let data = extractGa4Data(response.data);
        if (!data) {
          console.log('GA4 data not found');
          const targetArray = await Product.find({article: item.article}).exec()
          for (const target of targetArray) {
            await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
          }
          continue;
        }
        const mItem = data.find((i) => i?.product?.price)?.product;
        let mPrice = Math.round(mItem?.price * exchangeRate) || null;

        if (!mItem) {
          const search = await axios.get(`https://www.motea.com/en/catalogsearch/result/?q=${item.article}`);
          data = extractSearchData(search.data)
          const t = data.find(i => i.url.includes(item.article.toLowerCase()));
          if (!t) {
            console.log('article not found')
            const targetArray = await Product.find({article: item.article}).exec()
            for (const target of targetArray) {
              await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
            }
            continue;
          }
          mPrice = Math.round(Number(t.price) * exchangeRate) || null
        }

        if (!mPrice) {
          const targetArray = await Product.find({article: item.article}).exec()
          for (const target of targetArray) {
            await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
          }
          continue;
        }

        const targetArray = await Product.find({article: item.article}).exec()
        for (const target of targetArray) {
          await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: mPrice, date: now }})
        }
      } catch (err) {
        if (err?.response?.status === 429) {
          console.log("Block 429!!!");
          await sleep(20000);
        }
        errors.push(['-', 'Ошибка при обработке артикула', item.article, err.message]);
      }
    }

    console.log(`Price check completed.`);
    isWorkong = false;

    return;
  } catch (error) {
    console.log(`Price check failed due to an error: ${error}.`);
    isWorkong = false;
  }
}

module.exports = checkPrice();