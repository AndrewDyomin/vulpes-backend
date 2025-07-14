const sendTelegramMessage = require('../helpers/sendTelegramMessage')
// const adminChatId = process.env.ADMIN_CHAT_ID;
require("dotenv").config();

async function bot(req, res, next) {
  const body = req.body;
  const { message } = req.body;
  try {
    const chatId = message.chat.id

    sendTelegramMessage(`Вы написали '${message.text}'`, chatId)

    console.log(body)
    res.status(200)
  } catch (error) {
    next(error);
  }
}

module.exports = { bot };
