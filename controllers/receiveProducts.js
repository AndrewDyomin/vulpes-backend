// const axios = require('axios');
// const xml2js = require('xml2js');
const XLSX = require("xlsx");
const Receive = require("../models/receive");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");

const format = (number) => {
  if (number < 10) {
    return "0" + number;
  } else {
    return number;
  }
};

async function getAll(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1; // текущая страница
    const limit = parseInt(req.query.limit) || 20; // сколько товаров на страницу

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Receive.find().skip(skip).limit(limit).exec(),
      Receive.countDocuments(),
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
    const check = await Receive.findById(req.body.id).exec();
    return res.status(200).json({ ...check });
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  try {
    const items = req.body?.items;
    let name = req.body?.name;
    const now = new Date();
    const today = format(now.getDate());
    const month = format(now.getMonth() + 1);
    const year = now.getFullYear();

    if (!name) {
      name = `${today}.${month}.${year}`
    }

    const array = [];

    for (const item of items) {
      if (item?.article && item.article !== '' && item.article !== '?') {
        array.push({article: item.article, count: item.count})
      } else {
        const chatId = process.env.ADMIN_CHAT_ID;
        array.push(item)
        sendTelegramMessage(`Приход товара №${name} создан с ошибками`, chatId)
      }
    }

    await Receive.create({ name, items: array });

    res.status(200).json({ message: "Receive created.", name });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  const { id } = req.body;
  const { role } = req.user.user;

  try {
    if (role === "owner") {
      await Receive.findByIdAndDelete(id);
      res.status(200).json({ message: "Receive was deleted" });
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
    await Receive.findByIdAndUpdate(id, { items }).exec();
    res.status(200).json({ message: "Inventory check was updated" });
  } catch (error) {
    next(error);
  }
}

async function combine(req, res, next) {
  const { role } = req.user.user;
  const { array } = req.body;
  const resultArray = [];
  let name = "";

  try {
    if (role === "owner") {
      for (const id of array) {
        const check = await Receive.findById(id).exec();

        for (const item of check.items) {
          const target = resultArray.find((i) => i.article === item.article);
          if (target) {
            target.count = String(Number(target.count) + Number(item.count));
          } else {
            resultArray.push(item);
          }
        }

        if (name === "") {
          name = check.name;
        }
      }
      await Receive.create({ name, items: resultArray });

      for (const id of array) {
        await Receive.findByIdAndDelete(id).exec();
      }

      res.status(200).json({ message: "Inventory checks was combined" });
    } else {
      res.status(200).json({ message: "You can't do this" });
    }
  } catch (error) {
    next(error);
  }
}

async function download(req, res, next) {
  const { id } = req.body;
  const resultArray = [];
  const now = new Date();
  const today = format(now.getDate());
  const month = format(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = format(now.getHours());
  const minutes = format(now.getMinutes());

  try {
    const doc = await Receive.findById(id);
    if (!doc) return res.status(404).send("Not found");

    for (const item of doc.items) {
      const target = resultArray.find((i) => i.article === item.article);
      if (target) {
        target.count = String(Number(target.count) + Number(item.count));
      } else {
        resultArray.push(item);
      }
    }

    const data = resultArray.map((item) => ({
      Article: item.article,
      Count: item.count,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    // Gen buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Send file
    res.setHeader("Content-Disposition", `attachment; filename=receive_products-${year}.${month}.${today}_${hours}-${minutes}.xlsx`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, getById, add, remove, update, combine, download };
