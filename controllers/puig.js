const { google } = require("googleapis");
const updateSheets = require("../helpers/updateSheets");
const Categories = require("../models/puigCategories");
const Products = require("../models/puigProducts");
const Articles = require("../models/puigArticles");
const path = require("path");
const { fork } = require("child_process");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const { checkProductsForHoroshop } = require("../helpers/horoshop");
const axios = require("axios");
const isEqual = require('node:util').isDeepStrictEqual;

let isChild = false;
const chatId = process.env.ADMIN_CHAT_ID;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCategories(req, res, next) {
  try {
    const array = await Categories.find({}).exec();
    res.status(200).send(JSON.stringify(array));
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function getCategoryById(req, res, next) {
  const { id } = req.params;
  try {
    const result = await Categories.findOne({ id }).exec();
    res.status(200).send(JSON.stringify(result));
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function getProductsByCategory(req, res, next) {
  const { id } = req.params;
  try {
    const result = await Products.find({ "category.id": id }).exec();
    res.status(200).send(JSON.stringify(result));
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function updateCategory(req, res, next) {
  try {
    const { _id, titleRu, titleUk, title, image } = req.body;

    await Categories.findByIdAndUpdate(_id, {
      titleRu,
      titleUk,
      title,
      image,
    }).exec();
    res.status(200).send({ message: "OK" });
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function getProductById(req, res, next) {
  const { id } = req.params;
  try {
    const result = await Products.findOne({ id }).exec();
    const array = [];

    if (result?.articles[0]) {
      for (const art of result.articles) {
        const article = await Articles.findOne({ code: art }).exec();
        array.push(article);
      }

      result.articles = array;
    }

    res.status(200).send(JSON.stringify(result));
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function searchProduct(req, res) {
  const { phrase } = req.params;
  if (phrase && phrase !== '') {
    try {
      const arr = [];
      const productsById = await Products.find({ 
        $or: [ 
          { articles: phrase }, 
          { title: { $regex: phrase, $options: "i" } }, 
          { titleRu: { $regex: phrase, $options: "i" } }, 
          { titleUk: { $regex: phrase, $options: "i" } } 
        ] 
      }).exec();
      if (productsById && productsById.length > 0) {
        arr.push(...productsById.map(p => ({ id: p.id, title: p.title, titleRu: p.titleRu, titleUk: p.titleUk, images: p.images })));
      }

      res.status(200).send(JSON.stringify(arr));
    } catch(err) {
      console.log(err)
      res.status(204).send(JSON.stringify({message: 'search error'}));
    }
  }
}

async function translateString(req, res, next) {
  const { string } = req.body;
  const client = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  let retry = true;
  let result;
  
  try {
    await client.authorize();
    const sheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = "16kaSBC3xnJQON80jYzUE5ok7N37R_vXGUmpJHX4A6Uw";
    await updateSheets(sheets, spreadsheetId, 'translator!A1', [[string]]);
    while (retry) {
      await sleep(500)
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "translator!B1:C1",
      });
      if (data?.values[0].length > 1) {
        result = data.values[0]
        retry = false;
      }
    }
    
    res.status(200).send(JSON.stringify(result));
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function updateProduct(req, res, next) {
  const draft = req.body;
  let diff = {};
  try {
    const targetProduct = await Products.findById(draft._id).exec()
    let target = targetProduct.toObject();

    Object.keys(draft).forEach(key => {
      if (key === 'articles' || key === '_id') return;
      if (!isEqual(draft[key], target[key])) {
        diff[key] = draft[key]
      }
    });

    if (Object.keys(diff).length > 0) {
      diff.warning = false;
      await Products.findByIdAndUpdate(draft._id, { $set: diff }, { new: true }).exec();
    }

    for (const article of draft.articles) {
      diff = {}
      const targetArticle = await Articles.findById(article._id).exec()
      target = targetArticle.toObject();

      Object.keys(article).forEach(key => {
        if (key === '_id') return;
        if (!isEqual(article[key], target[key])) {
          diff[key] = article[key]
        }
      });

      if (Object.keys(diff).length > 0) {
        await Articles.findByIdAndUpdate(article._id, { $set: diff }, { new: true }).exec();
      }
    }

    res.status(200).send({ message: "OK" });
  } catch(err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function checkProductsUpdates(req, res, next) {
  if (!isChild) {
    const checkProducts = path.join(__dirname, '../helpers', "checkPuigProductsUpdates.js");
    isChild = true;

    if (req) {
      res.status(200).send({ message: "Check updates started" });
    }

    const child = fork(checkProducts, [], {
      execArgv: ["--max-old-space-size=150"],
    });

    child.on("exit", (code) => {
      sendTelegramMessage(`Проверка продуктов Puig завершена с кодом ${code}`, chatId);
      console.log(`Проверка продуктов Puig завершена с кодом ${code}`);
      isChild = false;
      checkProductsForHoroshop();
    });

    child.on("error", (err) => {
      sendTelegramMessage(`Ошибка проверки продуктов Puig: ${err}`, chatId);
      console.error("Ошибка проверки продуктов Puig:", err);
      isChild = false;
    });
  } else {
    console.log("Update check has already started");
    if (req) {
      res.status(200).send({ message: "Update check has already started" });
    }
  }
}

async function changeHoroshopStatus(req, res) {
  const { code, color, command } = req.params;
  try {
    await Articles.findOneAndUpdate({ code, 'colour.code': color }, { horoshopStatus: command })
    res.status(200).send({ message: "Status changed" });
  }catch(err) {
    res.status(500).send(JSON.stringify(err));
  }
}

async function updateBikesByArticle(req, res) {
  const { link } = req.body;
  const array = [];
  try {

    const { data } = await axios.get(link,
      {
        headers: {
          "Api-Token": process.env.PUIG_TOKEN,
        },
      },
    );
    const puigArray = data.data.bikes;

    for (const bike of puigArray) {
      const targetBrand = array.find(i => i.brand === bike.brand);
      if (!targetBrand) {
        array.push({ brand: bike.brand, models: [{ model: bike.model, year: [Number(bike.year)] }] })
      } else {
        const targetModel = targetBrand.models.find(i => i.model === bike.model);
        if (!targetModel) {
          targetBrand.models.push({ model: bike.model, year: [Number(bike.year)] });
        } else {
          targetModel.year.push(Number(bike.year));
        }
      }
    }

    for (const brand of array) {
      for (const model of brand.models) {
          const sorted = [ ...model.year ].sort((a, b) => a - b);

          const result = [];
          let start = sorted[0];
          let prev = sorted[0];

          for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];

            if (current === prev + 1) {
              prev = current;
            } else {
              result.push(start === prev ? `${start}` : `${start}-${prev}`);
              start = current;
              prev = current;
            }
          }

          result.push(start === prev ? `${start}` : `${start}-${prev}`);

          model.year = result;
      }
      brand.models.sort((a, b) => a.model.localeCompare(b.model));
    }

    res.status(200).send([ ...array ].sort((a, b) => a.brand.localeCompare(b.brand)));
  } catch(err) {
    console.log(err)
    res.status(500).send(JSON.stringify(err));
  }
}

module.exports = {
  getCategories,
  updateCategory,
  getCategoryById,
  getProductsByCategory,
  getProductById,
  searchProduct,
  translateString,
  updateProduct,
  checkProductsUpdates,
  changeHoroshopStatus,
  updateBikesByArticle,
};
