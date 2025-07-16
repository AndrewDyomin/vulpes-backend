const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;

const sendTelegramFile = async (filePath, caption, chatId) => {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', fs.createReadStream(filePath));
  if (caption) formData.append('caption', caption);

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      formData,
      {
        headers: formData.getHeaders(),
      }
    );
    console.log('Файл отправлен в Telegram');
  } catch (err) {
    console.error('Ошибка отправки файла в Telegram:', err.message);
  }
};

module.exports = sendTelegramFile;