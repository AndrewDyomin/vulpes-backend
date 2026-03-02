const axios = require("axios");
const User = require("../models/user");
const Articles = require("../models/puigArticles");
const Product = require("../models/puigProducts");

const categories = [
  { id: 1152, name: "Tank pads" },
  { id: 1008, name: "Accessories" },
  { id: 1137, name: "Adjustable Gear Shift-Brake Foot Pedal" },
  { id: 1132, name: "Apparel & Stuff" },
  { id: 1121, name: "Axle sliders" },
  { id: 1131, name: "Bar ends" },
  { id: 1120, name: "Bike Protection" },
  { id: 1008, name: "Brake Coolers" },
  { id: 1008, name: "Brake-clutch fluid tank cap" },
  { id: 1154, name: "Custom – Cruiser Semifarings" },
  { id: 1235, name: "Custom Levers" },
  { id: 1154, name: "Deflectors- Embellishers" },
  { id: 1008, name: "Displays" },
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
  { id: 1008, name: "Off-Road" },
  { id: 1154, name: "Panels" },
  { id: 1131, name: "Plugs " },
  { id: 1157, name: "Radiator cover" },
  { id: 1168, name: "Rear and brake lights" },
  { id: 1128, name: "Rearview Mirrors" },
  { id: 1108, name: "Retro - Vintage windshields" },
  { id: 1111, name: "Screws" },
  { id: 1172, name: "Sequentials Turn Lights" },
  { id: 1008, name: "Spares Parts" },
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
  { id: 1008, name: "Winter" },
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
  const targetCategory = categories.find(
    (i) => i.name === product.category.title,
  );

  if (product.enableSplitting) {
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
              ru: `${product.titleRu} для ${brand.brand} ${model.model} ${year}`,
              ua: `${product.titleUk} для ${brand.brand} ${model.model} ${year}`,
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
            parent: { id: targetCategory?.id || 1008 },
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
    const targetColor = colors.find((c) => c.code === article.colour.code);
    const draft = {
      parent_article: `${article.code}${article.colour.code}`,
      article: `${article.code}${article.colour.code}`,
      title: {
        ru: `${product.titleRu}`,
        ua: `${product.titleUk}`,
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
      parent: { id: targetCategory?.id || 1008 },
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

async function getArticlesFromHoroshop(article) {
  const token = await getToken();
  const product = await Product.findOne({ id: article.product.id }).exec();
  const result = [];

  if (product.enableSplitting) {
    for (const [brandIndex, brand] of article.bikesArray.entries()) {
      for (const [modelIndex, model] of brand.models.entries()) {
        for (const [i, year] of model.year.entries()) {
          const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
            {
              expr: {
                article: `${article.code}${article.colour.code}-${brandIndex}${modelIndex}${i}`,
              },
              token: token,
            },
          );
          if (data.response.products.length > 0) {
            result.push(data.response.products.map(a => a));
          }
        }
      }
    }
  } else {
    const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
      {
        expr: {
          article: `${article.code}${article.colour.code}`,
        },
        token: token,
      },
    );
    if (data.response.products.length > 0) {
      result.push(data.response.products.map(a => a));
    }
  }
  

  return result;
}

async function checkProductsForHoroshop() {
  const redFlag = ["Available on", "Few units in stock"];
  const articlesArray = await Articles.find({ horoshopStatus: "on" }).exec();
  const newProducts = [];

  for (const art of articlesArray) {
    const data = await getArticlesFromHoroshop(art);

    if (redFlag.includes(art.stock) || redFlag.includes(art.stock_prevision)) {
      console.log(art.code + art.colour.code, "no stock", data.response);
      if (data.response.products.length === 0) {
        continue;
      } else {
        console.log('finded', data.response.products);
        const res = await axios.post('https://vulpes.com.ua/api/catalog/import/', { products: newProducts, token: await getToken() });
        console.log(res.data.response)
        // TO DO Обработать смену статуса наличия.
        continue;
      }
    }

    if (art.outdated === 1) {
      await Product.findOneAndUpdate({ id: art.product.id }, { warning: true });
      await Articles.findByIdAndUpdate(
        { _id: art._id },
        { horoshopStatus: "canceled" },
      );
      continue;
    }
    
    if (data.response.products.length === 0) {
      const draft = await generateHoroshopProduct(art)
      if (!draft.length === 0) continue;

      draft.map(d => newProducts.push(d));
    }
  }
  
  if (newProducts.length > 0) {
    const res = await axios.post('https://vulpes.com.ua/api/catalog/import/', { products: newProducts, token: await getToken() });
    console.log(res.data.response)
    // {
    //   log: [
    //     { article: '22206N-00', info: [Array] },
    //     { article: '22206N-10', info: [Array] }
    //   ]
    // }


    if (res.data.status === 'OK') {
      for (const log of res.data.response.log) {
        console.log(log)
      }
    }
  }
}

checkProductsForHoroshop();

module.exports = { checkProductsForHoroshop };
