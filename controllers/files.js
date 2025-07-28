const fs = require("fs/promises");
const parseMyPdf = require("../helpers/parseInvoice");
const XLSX = require("xlsx");
const Product = require("../models/item");

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
  console.log(req.body);

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
            "Кількість в шт": item.count,
            "Ціна за шт в € без  ндс": item.price || '',
            "Ціна взагалі": Number(item.price) * Number(item.count) || "",
            "кг/шт": product?.dimensions?.weight || "",
            "Общий вес":
              Number(product?.dimensions?.weight) * Number(item.count) || "",
            "країна виробництва для ВМД": "Китай",
            "Код УКТ ВЄД": product?.zoltarifNumber || "",
            Мито: "",
            "Торговельна марка": "",
            "Виробник для єлектронного инвойсу": "Motea GmbH",
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

module.exports = { uploadInvoice, downloadBrokerTable };
