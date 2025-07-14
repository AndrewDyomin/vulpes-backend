const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;

const sendTelegramMessage = async (message, chatId) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error.message);
  }
};

module.exports = sendTelegramMessage;