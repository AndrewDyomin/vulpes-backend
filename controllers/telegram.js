const sendTelegramMessage = require('../helpers/sendTelegramMessage')
// const adminChatId = process.env.ADMIN_CHAT_ID;
require("dotenv").config();

async function bot(req, res, next) {
  // const body = req.body;
  const { message } = req.body;
  try {
    if (!message || !message.chat || !message.text) {
      return res.status(200).send('ignored');
    }

    const chatId = message.chat.id

    sendTelegramMessage(`Идентификатор вашего чата: ${chatId}. Вы написали '${message.text}'`, chatId)

    res.status(200).send('ok')
  } catch (error) {
    next(error);
  }
}

module.exports = { bot };
