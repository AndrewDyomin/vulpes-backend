const axios = require("axios");
const fs = require("fs");
const Product = require("../models/item");
const User = require("../models/user");
const BATCH_SIZE = 500;

async function getToken() {
  const user = await User.findOne({ name: "horoshop" }).exec();
  const { email, chatId, token, _id } = user;
  const now = new Date();
  let result;
  const diff = now - token[0];

  if (diff < 500000) {
    result = token[1];
  } else {
    const { data } = await axios.post("https://vulpes.com.ua/api/auth/", {
      login: email,
      password: chatId,
    });
    await User.findByIdAndUpdate(_id, { token: [now, data.response.token] });
    result = data.response.token;
  }

  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function write(stream, chunk) {
  if (!stream.write(chunk)) {
    await new Promise((resolve) => stream.once("drain", resolve));
  }
}

async function writeBatch(products, stream) {
  let xml = "";
  // let photoCount = 0;

  for (const product of products) {
    const topImage = product.images.splice(0, 1);

    try {
      xml += `<item>\n`;
      xml += `<g:id>${product.article}</g:id>\n`;
      xml += `<g:title>${product.title.ua}</g:title>\n`;
      xml += `<g:description>${escapeXml(product.description.ua)}</g:description>\n`;
      xml += `<g:link>${product.link}</g:link>\n`;
      xml += `<g:image_link>${topImage}</g:image_link>\n`;

      for (const photo of product.images || []) {
        xml += `<g:additional_image_link>${photo}</g:additional_image_link>\n`;
        // photoCount += 1;
        // if (photoCount > 9) break;
      }

      xml += `<g:availability>in stock</g:availability>\n`;
      xml += `<g:price>${product.price_old} UAH</g:price>\n`;
      xml += `<g:sale_price>${product.price} UAH</g:sale_price>\n`;
      xml += `<g:product_type>${product.parent.value}</g:product_type>\n`;

      if (product?.brand && product.brand !== '') {
        xml += `<g:brand>${product.brand.value.ua}</g:brand>\n`;
      }

      xml += `<g:condition>new</g:condition>\n`;

      // if (product?.color) {
      //   xml += `<param name="Цвет" unit=''>${escapeXml(product.color)}</param>\n`;
      // }

      xml += `</item>\n`;
    } catch(err) {
      console.log(err)
      console.log(product.article)
    }
  }
  await write(stream, xml);
}

async function createXml() {
  console.log('Google Merchant Center feed update started.');

  const groups = [
    {name: 'lager-top', roasFrom: 250, roasTo: 250000, inStock: true},
    {name: 'lager-rest', roasFrom: 0, roasTo: 250, inStock: true},
    {name: 'bestellware', roasFrom: 0, roasTo: 250000, inStock: false},
  ];

  for (const group of groups) {
    const stream = fs.createWriteStream(
        `./public/xml/${group.name.toLowerCase()}.xml.tmp`,
    );

    await write(stream, `<?xml version="1.0" encoding="UTF-8"?>\n`);
    await write(stream, `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n<channel>\n`);
    await write(stream, `<title>VULPES Moto</title>\n<link>https://vulpes.com.ua</link>\n<description>VULPES Moto - інтернет-магазин мотоаксесуарів, захисту та тюнінгу. Пряма співпраця з MOTEA, Puig та MRA. Мотокофри, підйомники, вітрове скло. Доставка по Україні.</description>\n`);

    // ----- products
    let page = 0;
    let batch = [];
    let count = 0;

    while (true) {
      const token = await getToken();
      const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
        {
          offset: page,
          limit: 500,
          expr : { display_in_showcase: 1 },
          includedParams: ["article", "price", "price_old", "presence", "brand", "display_in_showcase", "title", "description", "images", "link", "parent"],
          token,
        },
      );

      if (data?.response?.code === 429) {
        console.log(data.status, data.response.message);
        const ms = new Date(new Date().setMinutes(0, 0, 0) + 60000) - new Date();
        await sleep(ms);
        continue;
      }

      const activeArts = data.response.products.map(p => p.article);
      const donors = await Product.find({
          article: { $in: activeArts },
        }, { 
          article: 1, quantityInStock: 1, statistic: 1,
        }).lean();

      const donorsMap = new Map(donors.map(d => [d.article, d]));

      for (const product of data.response.products) {
        const donor = donorsMap.get(product.article);
        const roas = donor?.statistic?.roas || 0;
        if (!donor) continue;
        if (group.inStock && donor.quantityInStock < 1) continue;
        if (!group.inStock && donor.quantityInStock >= 1) continue;
        if (roas < group.roasFrom || roas >= group.roasTo) continue;

        batch.push(product);
        count++;

        if (batch.length >= BATCH_SIZE) {
          await writeBatch(batch, stream);
          batch = [];
          console.log(`Processed XML ${group.name}: ${count}`);
        }
      }

      if (data.response.products.length < 500) break;
      page += 500;
    }

    if (batch.length) {
      await writeBatch(batch, stream);
      batch = [];
      console.log(`Ending XML ${group.name}: ${count}`);
    }
    
    await write(stream, `</channel>\n</rss>\n`);

    stream.end();

    await new Promise((resolve) => stream.on("finish", resolve));

    fs.renameSync(`./public/xml/${group.name.toLowerCase()}.xml.tmp`, `./public/xml/${group.name.toLowerCase()}.xml`);
  }
  console.log('Google Merchant Center feed update finished.');
}

module.exports = { createXml };