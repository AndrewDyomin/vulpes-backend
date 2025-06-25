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
      Product.countDocuments()
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      products,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit
      }
    });

  } catch (error) {
    next(error);
  }
}

async function getByBarcode(req, res, next) {
  const barcode = req.body.barcode
  try {
    const product = await Product.findOne({ barcode }).exec();
    console.log(barcode)
    console.log(product)
    return res.status(200).json({ product });
  } catch (error) {
    next(error)
  }
}

// async function updateProductsFromCRM(req, res) {

//   const ymlUrl = process.env.PRODUCTS_URI;

//   if (!ymlUrl) {
//     return res.status(500).json({ message: 'PRODUCTS_URI не указана в .env' });
//   }

//   try {

//     const response = await axios.get(ymlUrl, { timeout: 10000 });
//     const xml = response.data;

//     const parser = new xml2js.Parser({ explicitArray: false });
//     const result = await parser.parseStringPromise(xml);

//     const offers = result?.yml_catalog?.shop?.offers?.offer || [];
//     const products = Array.isArray(offers) ? offers : [offers];

//     if (products.length === 0) {
//       return res.status(400).json({ message: 'Товары не найдены в XML' });
//     }

//     await Product.deleteMany({});
//     await Product.insertMany(products);

//     console.log(`Загружено ${products.length} товаров`);
//     return res.status(200).json({ message: `Загружено ${products.length} товаров` });
//   } catch (error) {
//     console.error('Ошибка при обновлении:', error);
//     return res.status(500).json({ message: 'Ошибка при обновлении товаров', error: error.message });
//   }
// };


module.exports = { getAll, getByBarcode };
