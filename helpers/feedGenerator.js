const fs = require("fs");
const sax = require("sax");
const axios = require("axios");
const Product = require("../models/item");
const Marketplaces = require("../models/marketplaces");
const BATCH_SIZE = 500;

const promCategories = [
    { number: 97492053, name: 'Подъемники', nameUK: 'Підйомники', id: '1056', parentNumber: '', parentId: '', },
    { number: 97492054, name: 'Фитнес', nameUK: 'Фітнес', id: '1055', parentNumber: '', parentId: '', },
    { number: 97492055, name: 'Подкат', nameUK: 'Підкат', id: '1009', parentNumber: '97492053', parentId: '1056', },
    { number: 97492056, name: 'Подъёмник, домкрат', nameUK: 'Підйомник, домкрат', id: '1007', parentNumber: '97492053', parentId: '1056' },
    { number: 97492057, name: 'Подножка', nameUK: 'Підніжка', id: '1018', parentNumber: '97492053', parentId: '1056' },
    { number: 97492058,	name: 'Защитные дуги', nameUK: 'Захисні дуги', id: '1005', parentNumber: '142260704', parentId: '' },
    { number: 97492059,	name: 'Тенты для мотоцикла', nameUK: 'Тенти для мотоцикла', id: '1006', parentNumber: '', parentId: '' },
    { number: 97678834,	name: 'Турники для дома и офиса', nameUK: 'Турніки для будинку і офісу', id: '', parentNumber: '97492054', parentId: '1055' },
    { number: 100384591, name: 'Центральные сумки для мотоцикла', nameUK: 'Центральні сумки для мотоцикла', id: '', parentNumber: '110284143', parentId: '1180' },
    { number: 100384632, name: 'Аксессуары для ремонта мототехники', nameUK: 'Аксесуари для ремонту мототехніки', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 100386347, name: 'Выгодные комплекты для мотоциклов', nameUK: 'Вигідні набори для мотоциклів', id: '', parentNumber: '', parentId: '' },
    { number: 110284142, name: 'Аксессуары', nameUK: 'Аксесуари', id: '1105', parentNumber: '', parentId: '' },
    { number: 110284143, name: 'Багаж', nameUK: 'Багаж', id: '1180', parentNumber: '', parentId: '' },
    { number: 110284174, name: 'Противоугонная система', nameUK: 'Протиугінна система', id: '1119', parentNumber: '110284142', parentId: '1105' },
    { number: 110284180, name: 'Трап для мотоцикла', nameUK: 'Трап для мотоцикла', id: '1136', parentNumber: '110284142', parentId: '1105' },
    { number: 110284193, name: 'Электроника и освещение', nameUK: 'Електроніка та освітлення', id: '1168', parentNumber: '110284142', parentId: '1105' },
    { number: 110284195, name: 'Боковые сумки и кофры', nameUK: 'Бічні сумки та кофри', id: '1182', parentNumber: '110284143', parentId: '1180' },
    { number: 110284206, name: 'Рулонные сумки', nameUK: 'Рулонні сумки', id: '1257', parentNumber: '110284143', parentId: '1180' },
    { number: 110284212, name: 'Домкрат', nameUK: 'Домкрат', id: '1211', parentNumber: '97492056', parentId: '1007' },
    { number: 110284215, name: 'Подставка для маневрирования', nameUK: 'Підставка для маневрування', id: '1214', parentNumber: '97492053', parentId: '1056' },
    { number: 110284298, name: 'Защита фары', nameUK: 'Захист фари', id: '1178', parentNumber: '110284193', parentId: '1168' },
    { number: 110354035, name: 'Популярные мотоциклы', nameUK: 'Популярні мотоцикли', id: '1070', parentNumber: '', parentId: '' },
    { number: 128818596, name: 'Подкат', nameUK: 'Підкат', id: '97492055', parentNumber: '97492055', parentId: '1009' },
    { number: 128818597, name: 'Подъёмник', nameUK: 'Підіймач', id: '97492056', parentNumber: '97492056', parentId: '1007' },
    { number: 128818598, name: 'Подножка', nameUK: 'Підніжка', id: '97492057', parentNumber: '97492057', parentId: '1018' },
    { number: 128818599, name: 'Защита двигателя', nameUK: 'Захист двигуна', id: '97492058', parentNumber: '142260704', parentId: '' },
    { number: 128818600, name: 'Тенты', nameUK: 'Тенти', id: '97492059', parentNumber: '97492059', parentId: '1006' },
    { number: 128818602, name: 'Боковые кофры', nameUK: 'Бічні кофри', id: '100384591', parentNumber: '110284143', parentId: '1180' },
    { number: 128818603, name: 'Инструменты', nameUK: 'Інструменнти', id: '100384632', parentNumber: '100384632', parentId: '' },
    { number: 128818604, name: 'Наборы для мотоциклов', nameUK: 'Набори для мотоциклів', id: '100386347', parentNumber: '100386347', parentId: '' },
    { number: 132083039, name: 'Аксессуары для Harley Davidson', nameUK: 'Аксесуари для Harley Davidson', id: '110354035', parentNumber: '110354035', parentId: '1070' },
    { number: 136480886, name: 'Підіймач', nameUK: 'Підіймач', id: '128818597', parentNumber: '97492056', parentId: '1007' },
    { number: 136480887, name: 'Підніжка', nameUK: 'Підніжка', id: '128818598', parentNumber: '97492057', parentId: '1018' },
    { number: 136480891, name: 'Моторюкзаки', nameUK: 'Моторюкзаки', id: '128818602', parentNumber: '110284143', parentId: '1180' },
    { number: 136480892, name: 'Аксесуари для ремонту мототехніки', nameUK: 'Аксесуари для ремонту мототехніки', id: '128818603', parentNumber: '100384632', parentId: '' },
    { number: 136480910, name: 'Фари та додаткові прожектори', nameUK: 'Фари та додаткові прожектори', id: '128818621', parentNumber: '110284193', parentId: '1168' },
    { number: 142260704, name: 'Защита мотоцикла', nameUK: 'Захист мотоцикла', id: '', parentNumber: '', parentId: '' },
    { number: 142287387, name: 'Аксессуары для квадроциклов', nameUK: 'Аксесуари до квадроциклів', id: '', parentNumber: '', parentId: '' },
    { number: 142361616, name: 'Палатка', nameUK: 'Намет', id: '', parentNumber: '97492059', parentId: '1006' },
    { number: 142363608, name: 'Гараж для мотоцикла', nameUK: 'Гараж для мотоцикла', id: '', parentNumber: '97492059', parentId: '1006' },
    { number: 142365786, name: 'Крепление для багажа', nameUK: 'Кріплення для багажа', id: '', parentNumber: '110284143', parentId: '1180' },
    { number: 142369357, name: 'Центральный кофр', nameUK: 'Центральний кофр', id: '', parentNumber: '110284143', parentId: '1180' },
    { number: 142369403, name: 'Сумка на бак мотоцикла', nameUK: 'Сумка на бак мотоцикла', id: '', parentNumber: '110284143', parentId: '1180' },
    { number: 142371912, name: 'Центральный подъемник', nameUK: 'Центральний підіймач', id: '', parentNumber: '97492053', parentId: '1056' },
    { number: 142371973, name: 'Подставка. Упор', nameUK: 'Підставка. Упор', id: '', parentNumber: '97492053', parentId: '1056' },
    { number: 142372157, name: 'Рули и ручки', nameUK: 'Керма та ручки', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372173, name: 'Подножки', nameUK: 'Підніжки', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372182, name: 'Гаджеты. Зарядные устройства', nameUK: 'Гаджети. Зарядні пристрої', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372797, name: 'Сиденья для мотоцикла', nameUK: 'Сидіння для мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372829, name: 'Выхлопная система', nameUK: 'Вихлопна система', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372874, name: 'Лобовые стекла мотоцикла', nameUK: 'Вітрові скла мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142372915, name: 'Защита колеса мотоцикла', nameUK: 'Захист колеса мотоцикла', id: '', parentNumber: '142260704', parentId: '' },
    { number: 142387313, name: 'Амортизаторы и подвеска мотоцикла', nameUK: 'Амортизатори та підвіска мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142387937, name: 'Защитные слайдеры', nameUK: 'Захисні слайдери', id: '', parentNumber: '142260704', parentId: '' },
    { number: 142388206, name: 'Крепление мотоцикла', nameUK: 'Кріплення мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142388484, name: 'Держатель номерного знака', nameUK: 'Тримач номерного знаку', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142388575, name: 'Зеркала для мотоцикла', nameUK: 'Дзеркала для мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142388645, name: 'Подставка для мотоцикла', nameUK: 'Підставка для мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142388778, name: 'Накладки и наклейки на бак мотоцикла', nameUK: 'Накладки та наклейки на бак мотоцикла', id: '', parentNumber: '110284142', parentId: '1105' },
    { number: 142389222, name: 'Багажник', nameUK: 'Багажник', id: '', parentNumber: '110284143', parentId: '1180' },
    { number: 142421718, name: 'Нижний спойлер', nameUK: 'Нижній спойлер', id: '', parentNumber: '110284142', parentId: '1105' },
];

function format(i) {
  if (i < 10) {
    return `0${i}`;
  }

  return String(i);
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

async function writeBatch(products, stream, marketplace) {
  let xml = "";

  for (const product of products) {
    xml += `<offer id="${product.promId}" available="true">\n`;

    if (product.brand.toLowerCase() === 'puig' || product.brand.toLowerCase() === 'mra') {
      xml += `<price>${Math.round(product.price.UAH * marketplace.markup)}</price>\n`;
    } else {
      xml += `<price>${Math.round(product.price.UAH * marketplace.markup * 0.85)}</price>\n`;
      xml += `<oldprice>${Math.round(product.price.UAH * marketplace.markup)}</oldprice>\n`;
    }

    xml += `<currencyId>UAH</currencyId>\n`;
    // xml += `<quantity_in_stock>${product.quantityInStock}</quantity_in_stock>\n`;
    // xml += `<categoryId>${categoriesMap[product.category].zid}</categoryId>\n`;

    for (const photo of product.images || []) {
      xml += `<picture>${photo}</picture>\n`;
    }

    xml += `<pickup>true</pickup>\n`;
    xml += `<delivery>true</delivery>\n`;
    xml += `<name>${escapeXml(product.name.RU)}</name>\n`;
    xml += `<name_ua>${escapeXml(product.name.UA)}</name_ua>\n`;
    xml += `<vendor>${escapeXml(product.brand)}</vendor>\n`;
    xml += `<vendorCode>${product.article}</vendorCode>\n`;
    xml += `<country_of_origin>${escapeXml(product.params?.countryOfOrigin || "")}</country_of_origin>\n`;

    xml += `<description><![CDATA[${product.description.RU || ""}]]></description>\n`;
    xml += `<description_ua><![CDATA[${product.description.UA || ""}]]></description_ua>\n`;
    xml += `<keywords></keywords>\n`
    xml += `<keywords_ua></keywords_ua>\n`
    xml += `<param name="Состояние">Новое</param>\n`;

    if (product?.color) {
      xml += `<param name="Цвет" unit=''>${escapeXml(product.color)}</param>\n`;
    }

    xml += `</offer>\n`;
  }

  await write(stream, xml);
}

async function createXml(marketplace) {
  console.log(`${marketplace.name} feed update started.`);

  const stream = fs.createWriteStream(
    `./public/xml/${marketplace.name.toLowerCase()}.xml.tmp`,
  );
  const now = new Date();
  const date = `${now.getFullYear()}-${format(now.getMonth() + 1)}-${format(now.getDate())} ${format(now.getHours())}:${format(now.getMinutes())}`;

  await write(stream, `<?xml version="1.0" encoding="UTF-8"?>\n`);
  await write(stream, `<!DOCTYPE yml_catalog SYSTEM "shops.dtd">\n`);
  await write(stream, `<yml_catalog date="${date}">\n<shop>\n`);

  // await write(stream, `<name>Vulpes Moto</name>\n`);
  // await write(stream, `<company>Vulpes Moto</company>\n`);
  // await write(stream, `<url>https://vulpesmoto.com.ua</url>\n`);
  // await write(stream, `<platform>Zakupka.com</platform>\n`);
  // await write(stream, `<agency>Zakupka.com</agency>\n`);
  // await write(stream, `<email>support@zakupka.com</email>\n`);

  if (marketplace.name === 'Prom') {
    await write(stream, `<categories>\n`);
    for (const cat of promCategories) {
        await write(
        stream,
        `<category id="${cat.number}"${cat.parentNumber !== '' ? ` parentId="${cat.parentNumber}"` : ""}>${escapeXml(cat.name)}</category>\n`,
        );
    }
    await write(stream, `</categories>\n`);
  }

  await write(stream, `<offers>\n`);

  let batch = [];
  const nonPromId = [];
  let count = 0;
  let total = 0;

  const countDocs = await Product.countDocuments({
    quantityInStock: { $gte: 1 },
  });

  console.log("Count:", countDocs);

  const products = Product.find({ quantityInStock: { $gte: 1 } })
    .select({
      article: 1,
      price: 1,
      quantityInStock: 1,
      category: 1,
      name: 1,
      description: 1,
      images: 1,
      brand: 1,
      params: 1,
      color: 1,
      marketplaces: 1,
      promId: 1,
    })
    // .sort({ quantityInStock: -1 })
    // .lean({ defaults: true })
    .cursor();

  for await (const product of products) {
    if (!product?.marketplaces[marketplace.name.toLowerCase()]) continue;
    if (!product?.promId) {
      nonPromId.push(product.article);
      continue;
    }
    // if (!product?.name?.RU) continue;

    batch.push(product);
    count++;

    if (batch.length >= BATCH_SIZE) {
      await writeBatch(batch, stream, marketplace);
      batch = [];
      console.log(`Processed: ${count}/${countDocs}`);
    }

    if (count >= 500) break;
  }

  if (batch.length) {
    await writeBatch(batch, stream, marketplace);
  }

  await write(stream, `</offers>\n</shop>\n</yml_catalog>`);

  stream.end();

  await new Promise((resolve) => stream.on("finish", resolve));

  fs.renameSync(`./public/xml/${marketplace.name.toLowerCase()}.xml.tmp`, `./public/xml/${marketplace.name.toLowerCase()}.xml`);
  await Marketplaces.findByIdAndUpdate({ _id: marketplace._id }, { xml: { ...marketplace.xml, path: `files/feed-xml/${marketplace._id}` } });
  console.log('products without PromId:', nonPromId.length);
}

async function readBackFeed(marketplace) {
  console.log('reading...')

  try {
    let response = await axios.get(marketplace.xml.backFeed, { responseType: "stream" });
    const parser = sax.createStream(true, { trim: true });

    let currentTag = null;
    let currentProduct = null;
    let textBuffer = "";
    let currentParamName = null;
    let currentParamValue = "";
    const array = [];
    const operations = [];

    parser.on("opentag", (node) => {
      textBuffer = "";

      if (node.name === "offer") {
        currentProduct = { id: node.attributes.id};
      }

      currentTag = node.name;
    });

    parser.on("text", (text) => {
      if (currentProduct && currentTag) {
        textBuffer += text;
      }
    });

    parser.on("closetag", (tagName) => {
      if (!currentProduct) return;

      if (tagName === "offer") {
        const article = currentProduct.vendorCode;
        if (!article) return;

        const data = {
          article,
          id: currentProduct.id,
          keywords: currentProduct.keywords,
          keywordsUa: currentProduct.keywords_ua,
        };
        array.push(data);

        currentProduct = {};
      } else if (currentTag && textBuffer) {
        currentProduct[currentTag] = textBuffer;
        textBuffer = "";
      }
    });

    for await (const chunk of response.data) {
      parser.write(chunk);
    }

    parser.end();
    response = null;

    while(array?.length) {
      const chunk = array.splice(0, 500);
      const articles = chunk.map(i => i.article)
      const products = await Product.find({ article: { $in: articles }}, { article: 1, promId:1 }).lean();
      const productsMap = new Map(products.map(p => [p.article, p]));

      for (const item of chunk) {
        const target = productsMap.get(item.article)
        if (!target) continue;
        if (!target?.promId || target?.promId === '') {
          operations.push({
            updateOne: {
              filter: { article: item.article },
              update: { $set: { promId: item.id } },
              upsert: true,
            },
          });

          if (operations.length >= 100) {
            await Product.bulkWrite(operations, { ordered: false });
            operations.length = 0;
          }
        }
      }
    }

    if (operations.length > 0) {
      await Product.bulkWrite(operations, { ordered: false });
    }
  } catch(err) {
    console.log(err)
  }
  return;
}

async function generateFeedsForMarketplaces() {
  console.log("generate started");
  try {
    const markets = await Marketplaces.find({ "xml.generate": true }).lean();
    for (const marketplace of markets) {
      await createXml(marketplace);

      if (marketplace?.xml?.backFeed) {
        await readBackFeed(marketplace);
      }
    }
    console.log("generate finished");
  } catch (err) {
    console.log(err);
  }
  return;
}

module.exports = { generateFeedsForMarketplaces };
