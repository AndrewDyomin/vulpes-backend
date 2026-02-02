const Product = require("../models/item");
// const axios = require("axios");
const mongoose = require("mongoose");
const fetch = require('node-fetch');
// const MoteaItem = require("../models/moteaItem");
const cheerio = require('cheerio');

const MAIN_DB_URI = process.env.DB_URI;
// const DB_MOTEA_FEED_URI = process.env.DB_MOTEA_FEED_URI;
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

// const fetchLinks = async (array) => {
//   await mongoose.disconnect();
//   console.log("Disconnected from main DB");
//   await mongoose.connect(DB_MOTEA_FEED_URI);
//   console.log("Connected to Motea feed info DB");

//   const articles = array.map((p) => p.article);
//   const variantArticles = array.map((p) => `${p.article}-0`);

//   const donors = await MoteaItem.find({
//     article: { $in: [...articles, ...variantArticles] },
//   }).lean();

//   const donorMap = new Map();
//   for (const d of donors) {
//     donorMap.set(d.article, d.link);
//   }

//   const arrayCopy = array.map((product) => {
//     const link =
//       donorMap.get(product.article) ||
//       donorMap.get(`${product.article}-0`) ||
//       "";
//     return {
//       ...product._doc,
//       link: link,
//     };
//   });

//   await mongoose.disconnect();
//   console.log("Disconnected from Motea feed info DB");
//   await mongoose.connect(MAIN_DB_URI);
//   console.log("Connected to main DB");

//   return arrayCopy;
// };

// function extractGa4Data(html) {
//   const startToken = '<script type="text/x-magento-init">';
//   const endToken = "</script>";

//   const startIndex = html.indexOf(startToken);
//   const endIndex = html.indexOf(endToken, startIndex);

//   if (startIndex === -1 || endIndex === -1) {
//     console.log("Скрипт не найден");
//     return null;
//   }

//   const jsonScript = html
//     .slice(startIndex + startToken.length, endIndex)
//     .trim();

//   try {
//     const parsed = JSON.parse(jsonScript);
//     const data = parsed["*"]?.magepalGtmDatalayer?.data;
//     return data || null;
//   } catch (err) {
//     console.error("Ошибка при разборе JSON:", err.message);
//     return null;
//   }
// }

async function extractSearchData(body) {
  const MAX_SIZE = 500_000; // 500 KB
  let size = 0;
  const chunks = [];

  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAX_SIZE) break;
    chunks.push(chunk);
  }

  const html = Buffer.concat(chunks).toString('utf8');
  const $ = cheerio.load(html);

  const container = $('ol.products.list.items.product-items.motea-list').first();

  const result = [];

  container.find('li[data-producturl]').each((_, li) => {
    const url = $(li).attr('data-producturl');

    // собираем ВСЕ цены
    const prices = $(li)
      .find('span.price-wrapper[data-price-amount]')
      .map((_, el) => Number($(el).attr('data-price-amount')))
      .get()
      .sort((a, b) => a - b);

    if (!url || prices.length === 0) return;

    let priceData;

    if (prices.length === 1) {
      priceData = {
        price: prices[0],
      };
    } else {
      priceData = {
        minPrice: prices[0],
        maxPrice: prices[prices.length - 1],
        prices,
      };
    }

    result.push({
      url,
      ...priceData,
    });
  });

  return result.length ? result : null;
}

// function extractSearchData(html) {
//   const startToken = '<ol class="products list items product-items motea-list">';
//   const endToken = "</ol>";

//   const startIndex = html.indexOf(startToken);
//   const endIndex = html.indexOf(endToken, startIndex);

//   if (startIndex === -1 || endIndex === -1) {
//     console.log("Список не найден");
//     return null;
//   }

//   const listHtml = html.slice(startIndex, endIndex + endToken.length);

//   const $ = cheerio.load(listHtml);

//   const result = [];

//   $('li[data-producturl]').each((_, li) => {
//     const url = $(li).attr('data-producturl');

//     const price = $(li).find('span.special-price > span.price-container > span.price-wrapper[data-price-amount]').attr('data-price-amount') || null;

//     if (url && price) {
//       result.push({ url, price });
//     }
//   });

//   return result.length > 0 ? result : null;
// }

async function extractHtml(body) {
  let html = '';

  for await (const chunk of body) {
    html += chunk.toString();
  }

  const $ = cheerio.load(html);
  const container = $('.product-info-price').first();
  if (!container.length) return null;

  const prices = [];

  container.find('.price').each((_, el) => {
    const text = $(el).text().trim();
    if (text) prices.push(text);
  });

  if (!prices.length) return null;

  prices.sort((a, b) => a - b);

  const parse = (t) =>
    Number(t.replace('€', '').replace(',', '.').trim());

  let upper = null;
  let price = null;
  let lower = null;

  if (prices.length === 1) {
    price = prices[0];
  } else if (prices.length === 2) {
    price = prices[0];
    lower = prices[1];
  } else {
    const last = prices.slice(-3);
    [upper, price, lower] = last;
  }

  return {
    upper: upper ? parse(upper) : null,
    price: price ? parse(price) : null,
    lower: lower ? parse(lower) : null,
    currency: 'EUR',
    raw: prices
  };
}

//    OLD VERSION
// async function checkPrice() {

//   try {
//     console.log("Price check started...");
    
//     await mongoose.connect(MAIN_DB_URI);
//     console.log("Connected to main DB");
//     const now = new Date();
//     const exchangeRate = 49.5;
//     const dbItems = await Product.find({}, { article: 1, price: 1, moteaPrice: 1, _id: 0 });
//     let linksArray = await fetchLinks(dbItems);
//     const linksMap = new Map(linksArray.map(i => [i.article, i.link]));
//     linksArray = null;
//     let c = 0;

//     for (let i = 0; i < dbItems.length; i++) {
//       const item = dbItems[i];
//       c++
//       if (c % 100 === 0) {
//         console.log(c, ' : ', dbItems.length)
//       }

//       if (blackList.includes(item.article)) {
//         console.log(item.article, ' in black list!!!');
//         continue;
//       }

//       const dateDifference = now - new Date(item.moteaPrice.date);
//       if (dateDifference < 86400000 || blackList.includes(item.article)) {
//         continue;
//       }

//       const link = linksMap.get(item.article) || linksMap.get(`${item.article}-0`);
//       if (!link) {
//         continue;
//       }

//       try {
//         const targetArray = await Product.find({article: item.article}).exec()
//         for (const target of targetArray) {
//           await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: target?.moteaPrice?.UAH, date: now }})
//         }
//         let response = await axios.get(link);
//         await sleep(1000);
//         let data = extractGa4Data(response.data);
//         if (!data) {
//           console.log('GA4 data not found');
//           for (const target of targetArray) {
//             await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
//           }
//           continue;
//         }
//         response = null;
//         const mItem = data.find((i) => i?.product?.price)?.product;
//         let mPrice = Math.round(mItem?.price * exchangeRate) || null;

//         if (!mItem) {
//           const search = await axios.get(`https://www.motea.com/en/catalogsearch/result/?q=${item.article}`);
//           data = extractSearchData(search.data)
//           const t = data.find(i => i.url.includes(item.article.toLowerCase()));
//           if (!t) {
//             console.log('article not found')
//             for (const target of targetArray) {
//               await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
//             }
//             continue;
//           }
//           mPrice = Math.round(Number(t.price) * exchangeRate) || null
//         }

//         if (!mPrice) {
//           for (const target of targetArray) {
//             await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: null, date: now }})
//           }
//           continue;
//         }

//         for (const target of targetArray) {
//           await Product.findByIdAndUpdate(target._id, {moteaPrice: { UAH: mPrice, date: now }})
//         }
//       } catch (err) {
//         if (err?.response?.status === 429) {
//           console.log("Block 429!!!");
//           await sleep(20000);
//         } else if (err.message === 'Client must be connected before running operations') {
//           await sleep(300000);
//         }
//         console.log('-', 'Ошибка при обработке артикула', item.article, err.message);
//       }

//       dbItems[i] = null;
//     }

//     console.log(`Price check completed.`);
//   } catch (error) {
//     console.log(`Price check failed due to an error: ${error}.`);
//   }
//   await mongoose.disconnect();
//   process.exit(0);
// }

async function checkPrice() {

  try {
    console.log("Price check started...");
    
    await mongoose.connect(MAIN_DB_URI);
    console.log("Connected to main DB");
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const exchangeRate = 49.5;
    const dbItems = await Product.find({}, { article: 1, price: 1, moteaPrice: 1, linkInMotea: 1, _id: 1 });
    let c = 0;

    for (let i = 0; i < dbItems.length; i++) {
      const item = dbItems[i];
      c++
      if (c % 500 === 0) {
        console.log(c, ' : ', dbItems.length)
      }

      if (blackList.includes(item.article)) {
        console.log(item.article, ' in black list!!!');
        continue;
      }

      const dateDifference = now - new Date(item.moteaPrice.date);
      if (dateDifference < 86400000) {
        continue;
      }

      const link = item?.linkInMotea;
      if (!link) {
        continue;
      }

      try {
        await Product.findByIdAndUpdate(item._id, {moteaPrice: { UAH: item?.moteaPrice?.UAH, date: now }})
        let response = await fetch(link);
        await sleep(1000);
        let data = await extractHtml(response.body);
        response = null;
        
        let mPrice = data?.price || null;

        if (!mPrice) {
          console.log('search starting')
          const search = await fetch(`https://www.motea.com/en/catalogsearch/result/?q=${item.article}`);

          data = extractSearchData(search.body)
          const t = data.find(i => i.url.includes(item.article.toLowerCase()));
          if (!t) {
            console.log(item.article, 'article not found')
            await Product.findByIdAndUpdate(item._id, {moteaPrice: { UAH: null, date: now }})
            continue;
          }
          mPrice = Math.round(Number(t.price) * exchangeRate) || null
        }

        if (!mPrice) {
          await Product.findByIdAndUpdate(item._id, {moteaPrice: { UAH: null, date: now }})
          continue;
        }

        await Product.findByIdAndUpdate(item._id, {moteaPrice: { UAH: mPrice, date: now }})

      } catch (err) {
        if (err?.response?.status === 429) {
          console.log("Block 429!!!");
          await Product.findByIdAndUpdate(item._id, {moteaPrice: { UAH: item?.moteaPrice?.UAH, date: yesterday }})
          await sleep(20000);
        } else if (err.message === 'Client must be connected before running operations') {
          await sleep(300000);
        }
        console.log('-', 'Ошибка при обработке артикула', item.article, err.message);
      }

      dbItems[i] = null;
    }

    console.log(`Price check completed.`);
  } catch (error) {
    console.log(`Price check failed due to an error: ${error}.`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

checkPrice();