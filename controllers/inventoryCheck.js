// const axios = require('axios');
// const xml2js = require('xml2js');
const InventoryCheck = require("../models/inventoryCheck");

async function getAll(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1; // текущая страница
    const limit = parseInt(req.query.limit) || 20; // сколько товаров на страницу

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      InventoryCheck.find().skip(skip).limit(limit).exec(),
      InventoryCheck.countDocuments()
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

async function getById(req, res, next) {

  try {
    const product = await InventoryCheck.findById(req.body._id).exec();
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

async function add(req, res, next) {

  const { name, items } = req.body;

  console.log(name);
  console.log(items);

  try {
    await InventoryCheck.create({ name, items });

    res
      .status(200)
      .json({ 'message': 'Inventory check created.'});
  } catch (error) {
    next(error);
  }
}


module.exports = { getAll, getById, add };
