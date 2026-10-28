const fs = require("fs/promises");
const path = require("path");
const parseMyPdf = require("../helpers/parseInvoice");
const XLSX = require("xlsx");
const Product = require("../models/item");
const Marketplaces = require("../models/marketplaces");
const TmpTables = require("../models/tmpTables");
const { generateFeed } = require("../helpers/zakupka");
const { generateFeedsForMarketplaces } = require("../helpers/feedGenerator");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const { default: axios } = require("axios");

function read(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const headers = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = sheet[cellAddress];
    headers.push(cell ? cell.v : `Column${col}`);
  }

  const data = [];
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const rowData = {};
    let emptyRow = true;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];

      if (cell && cell.v !== undefined) {
        rowData[headers[col - range.s.c]] = cell.v;
        emptyRow = false;
      } else {
        rowData[headers[col - range.s.c]] = null;
      }
    }

    if (!emptyRow) data.push(rowData);
  }

  return data;
}

async function uploadInvoice(req, res, next) {
  const filePath = req.file.path;

  try {
    const invoice = await parseMyPdf(filePath);
    res.status(200).send({ invoice });
  } catch (error) {
    next(error);
  } finally {
    try {
      await fs.unlink(filePath);
      console.log("Временный файл удалён:", filePath);
    } catch (unlinkErr) {
      console.warn("Не удалось удалить файл:", filePath, unlinkErr.message);
    }
  }
}

async function uploadAdStatistic(req, res) {
  if (req?.user.user.role !== 'owner') {
    res.status(200).send({ message: 'no acces' });
    return;
  }

  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const rows = read(workbook);

    if (Object.keys(rows[0]).some(f => f.includes('Column')) || Object.keys(rows[1]).some(f => f.includes('Column'))) {
      res.status(200).send({ message: 'файл не соответствует шаблону' });
      await fs.unlink(filePath);
      console.log("Временный файл удалён:", filePath);
      return;
    }

    const neededKeys = [
      'Изображение',
      'Название',
      'Идентификатор позиции',
      'Расходы',
      'Код валюты',
      'Коэфф. конверсии'
    ];

    const filteredData = rows.map(item =>
      Object.fromEntries(
        neededKeys.map(key => [key, item[key]])
      )
    );

    const table = await TmpTables.create({ rows: filteredData, status: "processing", createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    await fs.unlink(filePath);
    res.status(200).send({ message: 'OK', table: {_id: table._id, rows: filteredData.splice(0, 10),} });
  } catch(err) {
    console.log(err);
    res.status(200).send({ message: 'something went wrong' });
  }
}

async function saveAdStatistic(req, res) {
  if (req?.user?.user.role !== 'owner' || !req?.body?._id) {
    return;
  }

  try {
    const draft = await TmpTables.findById(req.body._id);

    if (!draft) {
      res.status(200).send({message: 'something went wrong'});
      await sendTelegramMessage('Импорт статистики отменен, файл не найден.', req?.user?.user.chatId);
      return;
    } else if (draft.status !== 'processing') {
      return;
    }

    await TmpTables.findByIdAndUpdate(req.body._id, { status: 'confirmed' })
    res.status(200).send({message: 'Обработка файла начата, результат отправлю в телеграм.'});

    const { data } = await axios.get('https://api.monobank.ua/bank/currency');
    const findRate = (codeA, codeB) =>
      data.find( item =>
          item.currencyCodeA === codeA &&
          item.currencyCodeB === codeB
      );
    function normalize(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100
    }
    const eur = findRate(978, 980); // EUR → UAH
    const eurSell = normalize(eur?.rateSell) || normalize(eur?.rateCross);

    let count = 0;

    for (const row of draft.rows) {
      if (!row['Расходы'] || row['Расходы'] === 0) continue;

      const article = row['Идентификатор позиции'].split('-')[0].toUpperCase();

      await Product.findOneAndUpdate({ article }, { 'statistic.adCost': Number(row['Расходы']*eurSell).toFixed(2) });
      count ++;
    }

    await sendTelegramMessage(`Импорт рекламной статистики завершен, обработано ${count} артикулов.`, req?.user?.user.chatId);
    return;
  } catch(err) {
    console.log(err);
  }
}

async function downloadBrokerTable(req, res, next) {
  try {
    const doc = req.body.data.values;

    const data = await Promise.all(
      doc.map(async (item) => {
        if (item.article !== "") {
          const product = await Product.findOne({article: item.article,}).exec();

          return {
            "Поз. в рахунку": item?.position || '',
            Art: item.article,
            "назва товару на німецькій мові": product?.name?.DE || "",
            "назва товару на українській мові": product?.name?.UA || "",
            L: product?.dimensions?.length || "",
            B: product?.dimensions?.width || "",
            H: product?.dimensions?.height || "",
            "Об’єм": Math.round(Number(product?.dimensions?.length * product?.dimensions?.width * product?.dimensions?.height * 0.000001) * 1000) / 1000 || '',
            "Об’єм загальний": Math.round(Number(product?.dimensions?.length * product?.dimensions?.width * product?.dimensions?.height * 0.000001 * item.count) * 1000) /1000 || '',
            "Кількість в шт": item.count,
            "Ціна за шт в € без  ндс": item.price || '',
            "Ціна взагалі": Number(item.price) * Number(item.count) || "",
            "кг/шт": product?.dimensions?.weight || "",
            "Общий вес":
              Number(product?.dimensions?.weight) * Number(item.count) || "",
            "країна виробництва для ВМД": "Китай",
            "Код УКТ ВЄД": product?.zoltarifNumber || "",
            Мито: "",
            "Торговельна марка": product?.brand || "",
            "Виробник для єлектронного инвойсу": product?.brand === "Puig" ? product?.brand : "Motea GmbH",
            "Invoice #": req.body.data?.invoiceName || "",
            link: product?.linkInMotea || "",
          };
        } else {
          return {};
        }
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Gen buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Send file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Zoll_Vulpes_Motea.xlsx"`
    );
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

async function getXmlToZakupka(req, res) {
  try {
    const filePath = path.join(__dirname, "../", "public", "xml", "zakupka.xml");

    try {
      await fs.access(filePath);
    } catch {
      await generateFeed();
    }

    res.status(200).sendFile(filePath);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err.message });
  }
}

async function getXmlFromId(req, res) {
  const { id } = req.params;
  if (!id) {
    res.status(500).send({ message: 'Id not found' });
    return;
  }

  try {
    const marketplace = await Marketplaces.findById({ _id: id }).lean();
    const xmlPath = path.join(__dirname, "../", "public", "xml", `${marketplace.name.toLowerCase()}.xml`);

    try {
      await fs.access(xmlPath);
    } catch {
      await generateFeedsForMarketplaces();
    }

    res.status(200).sendFile(xmlPath);
  } catch(err) {
    console.log(err)
    res.status(500).send({ message: 'Something went wrong.' });
  }
}

module.exports = { 
  getXmlFromId, 
  uploadInvoice, 
  getXmlToZakupka, 
  saveAdStatistic,
  uploadAdStatistic,
  downloadBrokerTable, };
