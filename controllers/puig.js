const { google } = require("googleapis");
const updateSheets = require("../helpers/updateSheets");
const Categories = require("../models/puigCategories");
const Products = require("../models/puigProducts");
const Articles = require("../models/puigArticles");
const isEqual = require('node:util').isDeepStrictEqual;

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

module.exports = {
  getCategories,
  updateCategory,
  getCategoryById,
  getProductsByCategory,
  getProductById,
  translateString,
  updateProduct,
};
