const fs = require("fs/promises");
const path = require("path");
const parseMyPdf = require("../helpers/parseInvoice");
const XLSX = require("xlsx");
const Product = require("../models/item");
const Marketplaces = require("../models/marketplaces");
const { generateFeed } = require("../helpers/zakupka");
const { generateFeedsForMarketplaces } = require("../helpers/feedGenerator");

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

module.exports = { uploadInvoice, downloadBrokerTable, getXmlToZakupka, getXmlFromId };
