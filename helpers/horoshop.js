const axios = require("axios");
const User = require("../models/user");
const Articles = require("../models/puigArticles");
const Product = require("../models/puigProducts");
const sendTelegramMessage = require("./sendTelegramMessage");
const batchSize = 100;

const categories = [
  { id: 1152, name: "Tank pads" },
  { id: 1105, name: "Accessories" },
  { id: 1137, name: "Adjustable Gear Shift-Brake Foot Pedal" },
  { id: 1132, name: "Apparel & Stuff" },
  { id: 1121, name: "Axle sliders" },
  { id: 1131, name: "Bar ends" },
  { id: 1120, name: "Bike Protection" },
  { id: 1105, name: "Brake Coolers" },
  { id: 1105, name: "Brake-clutch fluid tank cap" },
  { id: 1154, name: "Custom – Cruiser Semifarings" },
  { id: 1235, name: "Custom Levers" },
  { id: 1154, name: "Deflectors- Embellishers" },
  { id: 1105, name: "Displays" },
  { id: 1122, name: "Engine guards" },
  { id: 1161, name: "Engine Spoilers" },
  { id: 1137, name: "Footpegs" },
  { id: 1123, name: "Frame sliders" },
  { id: 1152, name: "Fuel cap cover and yoke protector" },
  { id: 1143, name: "Grips" },
  { id: 1158, name: "Handguards" },
  { id: 1141, name: "Handlebars" },
  { id: 1178, name: "Headlight protector" },
  { id: 1131, name: "Kickstand Extension" },
  { id: 1244, name: "Levers" },
  { id: 1164, name: "License supports" },
  { id: 1178, name: "Lighting group" },
  { id: 1178, name: "Lights" },
  { id: 1106, name: "Maintenance" },
  { id: 1118, name: "Mobile Devices" },
  { id: 1160, name: "Mudguards" },
  { id: 1105, name: "Off-Road" },
  { id: 1154, name: "Panels" },
  { id: 1131, name: "Plugs " },
  { id: 1157, name: "Radiator cover" },
  { id: 1168, name: "Rear and brake lights" },
  { id: 1128, name: "Rearview Mirrors" },
  { id: 1108, name: "Retro - Vintage windshields" },
  { id: 1111, name: "Screws" },
  { id: 1172, name: "Sequentials Turn Lights" },
  { id: 1105, name: "Spares Parts" },
  { id: 1154, name: "Spoilers" },
  { id: 1121, name: "Spools" },
  { id: 1007, name: "Stand supports" },
  { id: 1152, name: "Strips" },
  { id: 1131, name: "T-MAX / AK550" },
  { id: 1199, name: "Top boxes" },
  { id: 1172, name: "Turnsignals " },
  { id: 1131, name: "Valves" },
  { id: 1110, name: "Visors and deflectors" },
  { id: 1108, name: "Windscreens for fairing bikes" },
  { id: 1108, name: "Windshields for custom bikes" },
  { id: 1108, name: "Windshields for Maxiscooters" },
  { id: 1108, name: "Windshields for Scooters" },
  { id: 1108, name: "Windshields high for round headlights" },
  { id: 1111, name: "Windshields Lift-Up Mechanism" },
  { id: 1108, name: "Windshields low for round headlights" },
  { id: 1108, name: "Windshields specific for non-round headlights" },
  { id: 1108, name: "Windshields specific for non-round headlights" },
  { id: 1105, name: "Winter" },
];

const colors = [
  { code: "", description: "Without colour", uk: "Прозорий" },
  { code: "A", description: "Blue", uk: "Блакитний" },
  { code: "B", description: "White", uk: "Білий" },
  { code: "C", description: "Carbon look", uk: "Carbon" },
  { code: "D", description: "Anodized aluminum", uk: "Алюміній" },
  { code: "E", description: "Squares", uk: "Squares" },
  { code: "F", description: "Dark Smoke", uk: "Темно-димчастий" },
  { code: "G", description: "Yellow", uk: "Жовтий" },
  { code: "H", description: "Smoke", uk: "Димчастий" },
  { code: "I", description: "Stainless steel", uk: "Сріблястий" },
  { code: "J", description: "Matt black", uk: "Чорний" },
  { code: "K", description: "Laser", uk: "Laser" },
  { code: "L", description: "Purple", uk: "Фіолетовий" },
  { code: "M", description: "Pure white", uk: "Білий" },
  { code: "N", description: "Black", uk: "Чорний" },
  { code: "O", description: "Gold", uk: "Золотий" },
  { code: "P", description: "Silver", uk: "Сріблястий" },
  { code: "Q", description: "Pink", uk: "Рожевий" },
  { code: "R", description: "Red", uk: "Червоний" },
  { code: "T", description: "Orange", uk: "Помаранчевий" },
  { code: "U", description: "Grey", uk: "Сірий" },
  { code: "V", description: "Green", uk: "Зелений" },
  { code: "W", description: "Clear", uk: "Прозорий" },
  { code: "X", description: "Orange KTM", uk: "Помаранчевий КТМ" },
  { code: "Y", description: "Titanium", uk: "Тітановий" },
  { code: "Z", description: "Gold", uk: "Золотий" },
  { code: "S", description: "Graphics", uk: "Graphics" },
];
// "Few units in stock"
const redFlag = ["Available on"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function generateHoroshopProduct(article) {
  const product = await Product.findOne({ id: article.product.id }).exec();
  const result = [];
  if (!product) return [];
  const targetCategory = categories.find(
    (i) => i.name === product.category.title,
  );

  if (product.enableSplitting) {
    if (article?.bikesArray?.length > 0) {
      for (const [brandIndex, brand] of article.bikesArray.entries()) {
        for (const [modelIndex, model] of brand.models.entries()) {
          for (const [i, year] of model.year.entries()) {
            const targetColor = colors.find(
              (c) => c.code === article.colour.code,
            );
            const draft = {
              parent_article: `${article.code}${article.colour.code}-${brandIndex}${modelIndex}${i}`,
              article: `${article.code}${article.colour.code}-${brandIndex}${modelIndex}${i}`,
              title: {
                ru: `${product.titleRu} для ${brand.brand} ${model.model} ${year} ${targetColor.description} ${article.code}${article.colour.code}`,
                ua: `${product.titleUk} для ${brand.brand} ${model.model} ${year} ${targetColor.uk} ${article.code}${article.colour.code}`,
              },
              description: {
                ru: product.descriptionRu,
                ua: product.descriptionUk,
              },
              seo_description: {
                ru: product.descriptionRu
                  .replace(/\n+/g, " ")
                  .replace(/\s+/g, " ")
                  .trim(),
                ua: product.descriptionUk
                  .replace(/\n+/g, " ")
                  .replace(/\s+/g, " ")
                  .trim(),
              },
              color: targetColor?.uk || "",
              gtin: article.barcode,
              parent: { id: targetCategory?.id || 1105 },
              forceAliasUpdate: true,
              display_in_showcase: true,
              presence: "Доставка 10-18 днів",
              price: Number(article.priceUAH),
              price_old: 0,
              currency: 'UAH',
              icons: ["Новинка"],
              brand: "Puig",
              characteristics: {
                material: article.material,
                country: {
                  ru: article.origin,
                  ua: article.origin,
                },
              },
              export_to_marketplace: "Google Feed for Merchant Center",
              supplier: {
                id: 4,
                value: "Puig"
              },
              images: {
                override: true,
                links: [...article.images],
              },
            };
            result.push(draft);
          }
        }
      }
    } else {
      await sendTelegramMessage(`Ошибка создания товара для Хорошоп. У артикула ${article.code}${article.colour.code} нет массива байков`, process.env.ADMIN_CHAT_ID);
    }
  } else {
    const targetColor = colors.find((c) => c.code === article.colour.code);
    const draft = {
      parent_article: `${article.code}${article.colour.code}`,
      article: `${article.code}${article.colour.code}`,
      title: {
        ru: `${product.titleRu} ${targetColor.description} ${article.code}${article.colour.code}`,
        ua: `${product.titleUk} ${targetColor.uk} ${article.code}${article.colour.code}`,
      },
      description: {
        ru: product.descriptionRu,
        ua: product.descriptionUk,
      },
      seo_description: {
        ru: product.descriptionRu
          .replace(/\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        ua: product.descriptionUk
          .replace(/\n+/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      },
      color: targetColor?.uk || "",
      gtin: article.barcode,
      parent: { id: targetCategory?.id || 1105 },
      forceAliasUpdate: true,
      display_in_showcase: true,
      presence: "Доставка 10-18 днів",
      price: Number(article.priceUAH),
      price_old: 0,
      currency: 'UAH',
      icons: ["Новинка"],
      brand: "Puig",
      characteristics: {
        material: article.material,
        country: {
          ru: article.origin,
          ua: article.origin,
        },
      },
      export_to_marketplace: "Google Feed for Merchant Center",
      supplier: {
        id: 4,
        value: "Puig"
      },
      images: {
        override: true,
        links: [...article.images],
      },
    };
    result.push(draft);
  }

  return result;
}

async function sendNewProducts(toCreate) {
  let attempt = 0;
  while (attempt < 4) {
    try {
      const res = await axios.post('https://vulpes.com.ua/api/catalog/import/', { products: toCreate, token: await getToken() });

      if (res.data.status === 'OK') {
        for (const log of res.data.response.log) {
          console.log(log)
        }
      } else if (res?.data?.response?.code === 429) {
        attempt ++;
        console.log("Error 429 - awaiting next hour")
        const ms = 3605000 - (Date.now() % 3600000);
        await sleep(ms);
        continue;
      } else {
        console.log(res.data)
      }
      break;
    } catch(err) {
      attempt ++;
      if (err.code === 'ECONNRESET' || err.message.includes('socket hang up')) {
        console.log('network error, retry...');
        await sleep(1000);
        continue;
      }

      console.log('sendNewProducts() error:', err);
      return;
    }
  }
}

async function checkProductsForHoroshop() {
  const newProducts = [];
  const operations = [];
  let lastId = null;

  try {
    while (true) {
      const query = lastId ? { _id: { $gt: lastId }, horoshopStatus: "on" } : { horoshopStatus: "on" };
      const batch = await Articles.find(query).sort({ _id: 1 }).limit(batchSize).lean();

      for (const art of batch) {
        if (redFlag.includes(art.stock) || redFlag.includes(art.stock_prevision)) {
          continue;
        }

        if (art.outdated === 1) {
          await Product.findOneAndUpdate({ id: art.product.id }, { warning: true });
          await Articles.findByIdAndUpdate(
            { _id: art._id },
            { horoshopStatus: "canceled" },
          );
          continue;
        }
        
        if (!art?.horoshopAddDate) {
          const draft = await generateHoroshopProduct(art)
          if (draft.length === 0) continue;
          newProducts.push(...draft);
          operations.push({
            updateOne: {
              filter: { _id: art._id },
              update: { $set: { horoshopAddDate: `${new Date()}` } },
              upsert: true,
            },
          });
        }

        if (newProducts.length >= batchSize) {
          const toCreate = newProducts.splice(0);
          await sendNewProducts(toCreate);
        }

        if (operations.length >= batchSize) {
          await Articles.bulkWrite(operations, { ordered: false });
          operations.length = 0;
        }
      }

      if (batch?.length < batchSize || !batch?.length) break;
      lastId = batch[batch.length - 1]._id;
    }

    if (newProducts.length > 0) {
      await sendNewProducts(newProducts);
    }

    if (operations.length > 0) {
      await Articles.bulkWrite(operations, { ordered: false });
      operations.length = 0;
    }

  } catch(err) {
    console.log(err);
  }
  console.log("checkProductsForHoroshop comleted)))")
}

async function checkProductsFromHoroshop() {
  let page = 0;
  const updatedProducts = [];
  const articlesArray = await Articles.find({ horoshopStatus: "on" }, { code: 1, colour: 1, stock: 1, stock_prevision: 1, priceUAH: 1, images: 1 }).exec();
  const articlesMap = new Map();
  for (const a of articlesArray) {
    const key = `${a.code}_${a.colour.code}`;
    articlesMap.set(key, a);
  }
  let token = await getToken();

  while(true) {
    try {
      console.log('response: ', page)
      const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
        {
          offset: page,
          limit: 500,
          includedParams: ["price", "presence", "images", "export_to_marketplace", "supplier"],
          token,
        },
      );

      page += 500;

      if (!data?.response?.products?.length) {
        if (data?.response?.code === 429) {
          console.log(data.status, data.response.message);
        }
        console.log('data.length === 0')
        break;
      }

      for (const product of data.response.products) {
        if (product.supplier.value === "Puig") {
          const article = product.article.includes('-') ? product.article.split('-')[0] : product.article;
          const art = article.slice(0, -1);
          const colorCode = article.slice(-1);
          const key = `${art}_${colorCode}`;
          const target = articlesMap.get(key);
          if (!target) {
            updatedProducts.push({ article: product.article, parent_article: product.parent_article, presence: 'Немає в наявності', export_to_marketplace: [] });
            continue;
          };
          const targetStatus = redFlag.includes(target.stock) || redFlag.includes(target.stock_prevision) ? 'Немає в наявності' : "Доставка 10-18 днів";
          const diff = {};
          if (product.presence.value.ua !== targetStatus) {
            diff.presence = targetStatus;
            diff.export_to_marketplace = targetStatus === 'Немає в наявності' ? [] : [ { id: 1, value: 'Google Feed for Merchant Center' } ];
          }
          if (product.price !== target.priceUAH) {
            diff.price = Number(target.priceUAH);
          }
          if (product.images.length !== target.images.length) {
            diff.images = {
              override: true,
              links: [...target.images],
            }
          }
          if (Object.keys(diff).length > 0) {
            diff.article = product.article;
            diff.parent_article = product.parent_article;
            updatedProducts.push(diff);
          }
          if (updatedProducts.length >=500) {
            const res = await axios.post('https://vulpes.com.ua/api/catalog/import/', { products: updatedProducts, token });
            if (res.data.status === 'OK') {
              for (const log of res.data.response.log) {
                console.log(log)
              }
            } else if (res.data.status === 'WARNING') {
              console.log('WARNING:', res.data)
              if (res.data?.response?.log?.length) {
                for (const error of res.data?.response?.log) {
                  if (log?.info[0]?.code === 0) continue;
                  console.log(error);
                }
              }
            } else {
              await sendTelegramMessage(`Ошибка обновления Puig на ХОРОШОПЕ. res.data: ${JSON.stringify(res.data)}`, process.env.ADMIN_CHAT_ID)
              console.log(JSON.stringify(res.data))
            }
            updatedProducts.length = 0;
          }
        }
      }
      if (data.response.products.length < 500) break;
    } catch(err) {
      if (err.response?.data?.status === 'AUTHORIZATION_ERROR') {
        token = await getToken();
        continue;
      }
      console.log('err:', err);
      if (err?.response?.log?.length) {
        for (const error of err?.response?.log) {
          console.log(error);
        }
      }
    }
  }

  if (updatedProducts.length > 0) {
    const res = await axios.post('https://vulpes.com.ua/api/catalog/import/', { products: updatedProducts, token });
    if (res.data.status === 'OK') {
      for (const log of res.data.response.log) {
        if (log?.info[0]?.code === 0) continue;
        console.log(log)
      }
    } else if (res.data.status === 'WARNING') {
      // console.log('WARNING:', JSON.stringify(res.data))
      if (res.data?.response?.log?.length) {
        for (const log of res.data?.response?.log) {
          for (const info of log.info) {
            if (info?.code === 0) continue;
            console.log(log);
          }
        }
      }
    } else {
      await sendTelegramMessage(`Ошибка обновления Puig на ХОРОШОПЕ. res.data: ${JSON.stringify(res.data)}`, process.env.ADMIN_CHAT_ID)
      console.log(JSON.stringify(res.data))
    }
    updatedProducts.length = 0;
  }
  console.log("Products check completed.")
}

module.exports = { checkProductsForHoroshop, checkProductsFromHoroshop };
