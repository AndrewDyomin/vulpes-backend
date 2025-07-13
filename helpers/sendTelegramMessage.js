const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.ADMIN_CHAT_ID;

const sendTelegramMessage = async (message) => {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML' // можно использовать Markdown или HTML
    });
    console.log('Уведомление отправлено в Telegram');
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error.message);
  }
};

module.exports = sendTelegramMessage;