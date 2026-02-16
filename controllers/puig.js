const Categories = require("../models/puigCategories");
const Products = require("../models/puigProducts");
const Articles = require("../models/puigArticles");

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
    const { _id, title_ru, title_uk, title, image } = req.body;

    await Categories.findByIdAndUpdate(_id, {
      title_ru,
      title_uk,
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
    console.log(result);

    if (result?.articles[0]) {
      for (const art of result.articles) {
        const article = await Articles.findOne({ code: art }).exec();
        array.push(article);
      }

      result.articles = array;
    }

    console.log(result);
    res.status(200).send(JSON.stringify(result));
  } catch (err) {
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
};
