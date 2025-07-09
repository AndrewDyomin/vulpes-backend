// const axios = require('axios');
// const xml2js = require('xml2js');
const InventoryCheck = require("../models/inventoryCheck");

async function getAll(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1; // текущая страница
    const limit = parseInt(req.query.limit) || 20; // сколько товаров на страницу

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      InventoryCheck.find().skip(skip).limit(limit).exec(),
      InventoryCheck.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      items,
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

async function getById(req, res, next) {
  try {
    const check = await InventoryCheck.findById(req.body.id).exec();
    return res.status(200).json({ ...check });
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  const { name, items } = req.body;

  console.log(name);
  console.log(items);

  try {
    await InventoryCheck.create({ name, items });

    res.status(200).json({ message: "Inventory check created." });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  const { id } = req.body;
  const { role } = req.user.user;

  try {
    if (role === "owner") {
      await InventoryCheck.findByIdAndDelete(id);
      res.status(200).json({ message: "Inventory check was deleted" });
    } else {
      res.status(200).json({ message: "You can't delete this object" });
    }
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  const { id, items } = req.body;

  try {

      await InventoryCheck.findByIdAndUpdate(id, { items }).exec();
      res.status(200).json({ message: "Inventory check was updated" });
    
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, add, remove, update };
