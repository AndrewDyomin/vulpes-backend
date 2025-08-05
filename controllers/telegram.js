const sendTelegramMessage = require('../helpers/sendTelegramMessage')
const { changeTable } = require('../helpers/checkOrders');
require("dotenv").config();

async function bot(req, res, next) {
  const body = req.body;

  try {
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      if (data === 'UPDATE_MOTEA_ORDER_TABLE') {
  
        changeTable()
          .then(async () => { await sendTelegramMessage("Таблица обновлена! https://docs.google.com/spreadsheets/d/16kaSBC3xnJQON80jYzUE5ok7N37R_vXGUmpJHX4A6Uw/edit", chatId); })
          .catch(async (error) => {
            console.error("Error updating table:", error);
            await sendTelegramMessage(`Произошла ошибка при обновлении таблицы. ${error}`, chatId);
          });
        
      }

      return res.status(200).send({ method: 'answerCallbackQuery', callback_query_id: callbackQuery.id });
    }

    if (req.body?.message) {
      const { message } = req.body;
      if (!message || !message.chat || !message.text) {
        return res.status(200).send('ignored');
      }

      const chatId = message.chat.id

      sendTelegramMessage(`Идентификатор вашего чата: ${chatId}. Вы написали '${message.text}'`, chatId)

      res.status(200).send('ok')
    }
  } catch (error) {
    console.error("Error processing Telegram message:", error);
  }
}

module.exports = { bot };
