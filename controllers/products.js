// const axios = require('axios');
// const xml2js = require('xml2js');
const Product = require("../models/item");

async function getAll(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1; // текущая страница
    const limit = parseInt(req.query.limit) || 20; // сколько товаров на страницу

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find().skip(skip).limit(limit).exec(),
      Product.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getByBarcode(req, res, next) {
  const barcode = req.body.barcode;
  try {
    const product = await Product.findOne({ barcode }).exec();
    return res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
}

async function getByArticle(req, res, next) {
  const article = req.body.article;
  try {
    const product = await Product.findOne({ article }).exec();

    return res.status(200).json({ product });
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    let value = req.body.value?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (value.includes("А")) {
      value = value.replace(/А/g, "A");
    }

    let query = { article: { $regex: value, $options: 'i' } };

    let [products, total] = await Promise.all([
      Product.find(query).skip(skip).limit(limit).exec(),
      Product.countDocuments(query),
    ]);

    if (products?.length < 1) {
      query = { name: { UA: { $regex: value, $options: 'i' } } };

      [products, total] = await Promise.all([
        Product.find(query).skip(skip).limit(limit).exec(),
        Product.countDocuments(query),
      ]);
    }

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getByBarcode, getByArticle, search };
