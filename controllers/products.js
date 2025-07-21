// const axios = require('axios');
// const xml2js = require('xml2js');
const ExcelJS = require('exceljs');
const Product = require("../models/item");
const fs = require('fs');
const path = require('path');
const sendTelegramFile = require('../helpers/sendTelegramFile');

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
    const value = req.body.value?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = { article: { $regex: value, $options: 'i' } };

    let [products, total] = await Promise.all([
      Product.find(query).skip(skip).limit(limit).exec(),
      Product.countDocuments(query),
    ]);

    if (products?.length < 1) {
      query = { 'name.UA': { $regex: value, $options: 'i' } };

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

async function sendAvailabilityTable(req, res, next) {
  const BATCH_SIZE = 10000;

  const { user } = req.user;

  if (!user.chatId) {
    return res.status(200).send({ message: 'you don’t have a chat with the bot in telegram' });
  }
  if (user.role !== 'owner') {
    return res.status(200).send({ message: 'you don’t have access' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Наличие');

    worksheet.columns = [
      { header: 'Артикул', key: 'article', width: 25 },
      { header: 'Фид', key: 'availabilityInMotea', width: 15 },
      { header: 'Склад', key: 'quantityInStock', width: 15 },
      { header: 'Наличие', key: 'availability', width: 15 },
    ];

    const total = await Product.countDocuments();
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const products = await Product.find({})
        .skip(i * BATCH_SIZE)
        .limit(BATCH_SIZE)
        .lean()
        .exec();

      for (const product of products) {
        worksheet.addRow({
          article: product.article,
          availabilityInMotea: product.availabilityInMotea || '',
          quantityInStock: product.quantityInStock || '',
          availability: product.quantityInStock > 0 ? 'В наявності' : product.availabilityInMotea === 'in stock' ? 'Доставка 10 днів' : 'Немає в наявності',
        });
      }
    }

    const fileName = `availability-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '..', 'tmp', fileName);

    await workbook.xlsx.writeFile(filePath);

    await sendTelegramFile(filePath, 'Таблица наличия', user.chatId);
    fs.unlinkSync(filePath);

    return res.status(200).send({ message: 'the table will be sent to your telegram' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getByBarcode, getByArticle, search, sendAvailabilityTable };
