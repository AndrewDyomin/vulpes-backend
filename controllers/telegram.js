const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const { changeTable } = require("../helpers/checkOrders");
const { sendBatchToIndexing } = require("../helpers/indexingApi");
require("dotenv").config();

const userStates = {};

function parseBatchResponse(raw) {
  const results = [];
  const regex = /\{\s*"urlNotificationMetadata"[\s\S]*?\}\s*\}/g;
  const matches = raw.match(regex);

  if (!matches) return results;

  for (const m of matches) {
    try {
      const data = JSON.parse(m);
      results.push({ url: data.urlNotificationMetadata.url, status: "ok" });
    } catch (err) {
      results.push({
        url: null,
        status: "error",
        error: "Не удалось распарсить JSON",
      });
    }
  }

  return results;
}

async function bot(req, res, next) {
  const body = req.body;

  try {
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      if (data === "UPDATE_MOTEA_ORDER_TABLE") {
        changeTable()
          .then(async () => {
            await sendTelegramMessage(
              "Таблица обновлена! https://docs.google.com/spreadsheets/d/16kaSBC3xnJQON80jYzUE5ok7N37R_vXGUmpJHX4A6Uw/edit",
              chatId
            );
          })
          .catch(async (error) => {
            console.error("Error updating table:", error);
            await sendTelegramMessage(
              `Произошла ошибка при обновлении таблицы. ${error}`,
              chatId
            );
          });
      }

      return res
        .status(200)
        .send({
          method: "answerCallbackQuery",
          callback_query_id: callbackQuery.id,
        });
    }

    if (
      userStates[req.body.message.chat.id]?.step === "awaiting_urls" &&
      req.body?.message?.document
    ) {
      const chatId = req.body.message.chat.id;
      const fileId = req.body.message.document.file_id;

      try {
        const fileInfoRes = await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`
        );
        const fileInfo = await fileInfoRes.json();
        if (!fileInfo.ok) throw new Error("Не удалось получить file_path");

        const filePath = fileInfo.result.file_path;

        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
        const fileContentRes = await fetch(fileUrl);
        const fileContent = await fileContentRes.text();

        const urls = fileContent
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith("http"));

        if (urls.length === 0) {
          await sendTelegramMessage(
            "В файле не найдено ссылок. Проверьте содержимое.",
            chatId
          );
          return res.status(200).send("ok");
        }

        await sendTelegramMessage(
          `Отправляю на индексацию ${urls.length} URL из файла...`,
          chatId
        );

        const results = await sendBatchToIndexing(urls);
        const readable = parseBatchResponse(results[0].response);

        let okUrl = 0;
        let errUrl = 0;

        for (const obj of readable) {
          if (obj.status === "ok") {
            okUrl++;
          } else {
            errUrl++;
          }
        }

        const messageText = `Результат отправки:\n ${okUrl} URL - ✅ \n ${errUrl} URL - ❌`;
        await sendTelegramMessage(messageText, chatId);

        delete userStates[chatId];

        return res.status(200).send("ok");
      } catch (err) {
        console.error("Ошибка при обработке файла:", err);
        await sendTelegramMessage("Не удалось обработать файл 😔", chatId);
        return res.status(200).send("ok");
      }
    }

    if (req.body?.message) {
      const { message } = req.body;
      if (!message || !message.chat || !message.text) {
        return res.status(200).send("ignored");
      }
      const chatId = message.chat.id;

      if (message.text === "/indexurl") {
        userStates[chatId] = { step: "awaiting_urls" };
        await sendTelegramMessage(
          "Введите ссылки через запятую для индексации или отправьте файлом.txt",
          chatId
        );

        return res.status(200).send("ok");
      }

      if (userStates[chatId]?.step === "awaiting_urls") {
        const urls = message.text
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);
        if (urls.length === 0) {
          await sendTelegramMessage(
            "Вы не ввели ссылки. Попробуйте снова:",
            chatId
          );
          return res.status(200).send("ok");
        }

        await sendTelegramMessage(
          `Отправляю на индексацию ${urls.length} URL...`,
          chatId
        );

        try {
          const results = await sendBatchToIndexing(urls);
          const readable = parseBatchResponse(results[0].response);

          let okUrl = 0;
          let errUrl = 0;

          for (const obj of readable) {
            if (obj.status === "ok") {
              okUrl++;
            } else {
              errUrl++;
            }
          }
          const messageText = `Результат отправки:\n ${okUrl}URL - ✅ \n ${errUrl}URL - ❌`;

          await sendTelegramMessage(messageText, chatId);
        } catch (error) {
          await sendTelegramMessage(
            `Произошла ошибка при индексации: ${error.message}`,
            chatId
          );
        }

        delete userStates[chatId];

        return res.status(200).send("ok");
      }

      sendTelegramMessage(
        `Идентификатор вашего чата: ${chatId}. Вы написали '${message.text}'`,
        chatId
      );

      res.status(200).send("ok");
    }
  } catch (error) {
    console.error("Error processing Telegram message:", error);
  }
}

module.exports = { bot };
