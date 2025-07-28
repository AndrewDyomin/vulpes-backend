const fs = require('fs/promises');
const parseMyPdf = require('../helpers/parseInvoice');

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
      console.log('Временный файл удалён:', filePath);
    } catch (unlinkErr) {
      console.warn('Не удалось удалить файл:', filePath, unlinkErr.message);
    }
  }
}

module.exports = { uploadInvoice };
