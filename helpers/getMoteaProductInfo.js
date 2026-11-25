const cheerio = require("cheerio");

async function extractHtml(body) {
  const MAX_SIZE = 500_000; // 500 KB
  let size = 0;
  const chunks = [];

  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAX_SIZE) break;
    chunks.push(chunk);
  }

  const html = Buffer.concat(chunks).toString("utf8");
  const $ = cheerio.load(html);
  let container = $(".product-info-price").first();

  if (!container.length) return null;

  const prices = [];
  let description = "";
  let delivery = "";

  container.find(".price").each((_, el) => {
    const text = $(el).text().trim();
    if (text) prices.push(text);
  });

  container.find("#motea-cart-box-info-delivery").each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      delivery += text;
    };
  })

  if (!prices.length) return null;

  prices.sort((a, b) => a - b);

  const parse = (t) => Number(t.replace("€", "").replace(",", ".").trim());

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

  container = $(".product-info-middleinfo").first();
  container.find(".value ul").each((_, el) => {
    const tags = $.html(el);
    if (tags) {
      description = tags;
    }
  });

  return {
    upper: upper ? parse(upper) : null,
    price: price ? parse(price) : null,
    lower: lower ? parse(lower) : null,
    currency: "EUR",
    raw: prices,
    description,
    delivery,
  };
}

async function getMoteaProductInfo(link) {
  try {
    const response = await fetch(link);
    let data = await extractHtml(response.body);
    return data;
  } catch (err) {
    console.log("getMoteaProductInfo.ERROR -> -> ->", err);
    return null;
  }
}

module.exports = {
  getMoteaProductInfo,
};
