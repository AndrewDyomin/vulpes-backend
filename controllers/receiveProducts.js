// const axios = require('axios');
// const xml2js = require('xml2js');
const XLSX = require("xlsx");
const Receive = require("../models/receive");
const User = require("../models/user");
const Invoices = require("../models/Invoices");
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
      Receive.find().sort({ _id: -1 }).skip(skip).limit(limit).exec(),
      Receive.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      items: items.map((r) => ({ ...r._doc, items: r._doc.items.map((i) => ({ ...i, article: i.article.replace(/а/g, 'a').replace(/А/g, 'A') })) })),
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
        if (/а/gi.test(item.article)) {
          item.article = item.article.replace(/а/gi, 'A');
        }
        array.push({article: item.article, count: item.count, barcode: item?.barcode});
      } else {
        array.push(item)
        sendTelegramMessage(`Приход товара №${name} создан с ошибками`, process.env.ADMIN_CHAT_ID)
      }
    }

    await Receive.create({ name, items: array });
    sendTelegramMessage(`${req?.user?.user.name} добавил новый приход товаров.`, process.env.ADMIN_CHAT_ID);

    res.status(200).json({ message: "Receive created.", name });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  const { id } = req.body;
  // const { role } = req.user.user;

  try {
    // if (role === "owner") {
      await Receive.findByIdAndDelete(id);
      res.status(200).json({ message: "Receive was deleted" });
    // } else {
    //   res.status(200).json({ message: "You can't delete this object" });
    // }
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  const { id, items, invoices } = req.body;
  const invoicesArray = invoices || [];

  try {
    await Receive.findByIdAndUpdate(id, { items, invoices: invoicesArray }).exec();
    res.status(200).json({ message: "Inventory check was updated" });
  } catch (error) {
    next(error);
  }
}

async function combine(req, res, next) {
  // const { role } = req.user.user;
  const { array } = req.body;
  const resultArray = [];
  const invoices = [];
  let name = "";

  try {
    // if (role === "owner") {
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

        for (const inv of check.invoices) {
          if (!invoices.includes(inv)) {
            invoices.push(inv);
          }
        }
      }
      await Receive.create({ name, items: resultArray, invoices });

      for (const id of array) {
        await Receive.findByIdAndDelete(id).exec();
      }

      res.status(200).json({ message: "Inventory checks was combined" });
    // } else {
    //   res.status(200).json({ message: "You can't do this" });
    // }
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
    console.log(error);
    next(error);
  }
}

async function getAllInvoices(req, res) {
  try {
    const result = await Invoices.find().sort({ _id: -1 }).limit(20).exec()
    res.status(200).send([ ...result ])
  } catch(err) {
    console.log(err);
    res.status(500).send({ message: 'Something went wrong. :/' })
  }
}

async function addInvoice(req, res) {
  try {
    const { name, items, total } = req.body;
    const array = [];
    let lastChild = null;

    for (const item of items) {
      if (item?.position && item?.price && item.position !== '') {
        lastChild = { ...item, set: [] };
        array.push(lastChild);
      } else if (lastChild) {
        lastChild.set.push({ article: item.article, count: item.count })
      }
    }

    await Invoices.create({ name, items: array, total: Number(total) });

    res.status(200).send({ message: 'Invoice saved' })
  } catch(err) {
    console.log(err);
    res.status(500).send({ message: 'Something went wrong. :/' })
  }
}

async function delInvoice(req, res) {
  const { _id } = req?.body;
  try {
    await Invoices.findByIdAndDelete(_id).exec()
    res.status(200).send({ message: 'Invoice deleted' })
  } catch(err) {
    console.log(err);
    res.status(500).send({ message: 'Something went wrong. :/' })
  }
}

async function closeInvoice(req, res) {
  const { _id } = req.body;
  console.log(_id)
  try {
    await Invoices.findByIdAndUpdate(_id, { verified: true }).exec();
    res.status(200).send({ message: 'invoice closed' });
  } catch(err) {
    console.log(err)
    res.status(500).send({ message: 'Something went wrong, please try again later.' })
  }
}

async function report(req, res) {
  const { receive, extra, notEnough, invoices } = req.body;
  let replyButtons = null;

  if (!invoices?.length) {
    res.status(200).send({ message: 'Target invoices not found' })
  }
  let reportText = `Завершена проверка товаров от ${receive}. \nЗатронуты счета:\n${invoices.join('\n')}\n`;

  if (!extra?.length && !notEnough?.length) {
    reportText += '\nВсе ок =)\nСчет закрыт.';
    for (const name of invoices) {
      await Invoices.findOneAndUpdate({ name }, { verified: true }).exec();
    }
  }

  if (notEnough?.length) {
    reportText += `\nНекоторых товаров не хватает:\n${notEnough.map(i => `${i.article} - ${i.count}шт;`).join('\n')}\n`;
  } else {
    replyButtons = {
      inline_keyboard: [
        [
          {
            text: `Закрыть ${invoices.length > 1 ? 'счета' : 'счет'}`,
            callback_data: `CLOSE_INVOICES_[${invoices.join(', ')}]`,
          },
        ],
      ],
    };
  }

  if (extra?.length) {
    reportText += `\nЕсть товары, которых нет в ${invoices.length > 1 ? 'счетах' : 'счете'}:\n${extra.map(i => `${i.article} - ${i.count}шт;`).join('\n')}\n`;
  }

  // const owners = await User.find({ role: "owner" }).exec();
  // for (const owner of owners) {
  //   if (owner?.chatId && owner?.chatId !== "") {
  //     await sendTelegramMessage(reportText, owner.chatId);
  //   }
  // }
  await sendTelegramMessage(reportText, process.env.ADMIN_CHAT_ID, replyButtons);
  res.status(200).send({ message: 'Report sended' });
}

module.exports = { 
  getAll, 
  getById, 
  add, 
  remove, 
  update, 
  combine, 
  download, 
  getAllInvoices, 
  addInvoice, 
  delInvoice,
  closeInvoice,
  report 
};
