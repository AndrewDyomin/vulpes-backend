const Product = require("../models/item");
const mongoose = require("mongoose");
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const MAIN_DB_URI = process.env.DB_URI;
const blackList = ['265984', 'A544007', '239859', '560012', '247557', 'A017124', '992918', 'A041129', '287483', '950647', 'A111768', 'A108957', 'A108939', 'A108973', 'A108985', 'A108949'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    const prices = $(li)
      .find('span.price-wrapper[data-price-amount]')
      .map((_, el) => Number($(el).attr('data-price-amount')))
      .get()
      .sort((a, b) => a - b);

    if (!url || prices.length === 0) return;

    const priceData = {
        price: prices[0],
        prices,
      };
    

    result.push({
      url,
      ...priceData,
    });
  });

  return result.length ? result : null;
}

async function extractHtml(body) {
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

async function checkPrice() {

  try {
    console.log("Price check started...");
    
    await mongoose.connect(MAIN_DB_URI);
    console.log("Connected to main DB");
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const exchangeRate = 49.5;
    const cursor = Product.find({}, { article: 1, price: 1, moteaPrice: 1, linkInMotea: 1, _id: 1 }).cursor();

    let c = 0;

    for await (const item of cursor) {
      c++
      if (c % 500 === 0) {
        console.log(c)
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

          data = await extractSearchData(search.body)
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

    }

    console.log(`Price check completed.`);
  } catch (error) {
    console.log(`Price check failed due to an error: ${error}.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  await mongoose.disconnect();
  process.exit(0);
}

checkPrice();