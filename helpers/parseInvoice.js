const PDFParser = require("pdf2json");

function extractProductsFromText(textLines) {
  const result = [];
  let name = '';
  let count = -1;

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    // console.log("Line: ", line);
    const articlePattern = /^(A\d{6}|\d{6})$/;
    const namePattern = /^\d{4}-\d+$/;
    // const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
    // const qtyPattern = /^(\d+)Pcs\.$/;
    // const pricePattern = /^\d+,\d{2}$/;

    if (name === '' && namePattern.test(line)) {
      name = line;
    }

    if (articlePattern.test(line)) {
      result.push({});
      count++;
      const article = line;
      const prevLine = textLines[i - 1]?.trim();
      result[count].article = article;
      result[count].position = prevLine.includes('consist') || prevLine.includes('Pcs') ? null : prevLine;
    }

    if (line.includes("Pcs.")) {
      const prevLine = textLines[i - 1]?.trim();
      const qty = line === "Pcs." ? prevLine : line;
      if (!result[count].count) {
        result[count].count = qty;
        const nextLine = textLines[i + 1]?.trim();
        const nextNextLine = textLines[i + 2]?.trim();
        result[count].price = articlePattern.test(nextNextLine) || !result[count].position
          ? ""
          : nextLine.replace(",", ".");
      }
    }
  }

  for (const item of result) {
      item.count = item.count
        .replace(/Pcs/g, '')
        .replace(/\./g, '')
        .replace(/ /g, '')
        .trim();
  }

  let total = 0
  for (const product of result) {
    total += Number(product.price) * Number(product.count);
    if (!product.position) {
      product.position = '';
    } 
  }

  const invoice = { name, items: [ ...result ], total: total.toFixed(2)}

  return invoice;
}


function parseMyPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(errData.parserError);
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      if (!pdfData.Pages) {
        const err = "Нет данных о страницах"
        return reject(err);
      }

      const allLines = [];

      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((textObj) => {
          const text = decodeURIComponent(textObj.R[0].T);
          allLines.push(text);
        });
      });

      const invoice = extractProductsFromText(allLines);
      resolve(invoice);
    });

    pdfParser.loadPDF(filePath);
  });
}

module.exports = parseMyPdf;