const OrdersArchive = require("../models/ordersArchive");
const User = require("../models/user");
const sendTelegramMessage = require("./sendTelegramMessage");
const { google } = require("googleapis");
const updateSheets = require("../helpers/updateSheets");

const fetchOrders = async () => {
  try {
    const result = [];
    const orders = await OrdersArchive.find({ statusId: "13" }).exec();
    for (const order of orders) {
      const orderData = {
        id: order.id,
        statusLabel: order.statusLabel,
        products: order.products.map((product) => ({
          amount: product.amount,
          sku: product.sku,
          isSet: product.isSet || [],
        })),
      };
      result.push(orderData);
    }
    return result;
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
};

const changeTable = async () => {
  try {
    console.log("Changing table...");
    const client = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    await client.authorize();

    const sheets = google.sheets({ version: "v4", auth: client });
    const spreadsheetId = "16kaSBC3xnJQON80jYzUE5ok7N37R_vXGUmpJHX4A6Uw";
    const range = "Bestellung!A:Z";
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
    });
    const rows = [["order №", "sku", "amount", "Bestand"]];

    const targetOrders = await fetchOrders();
    const orderArray = [];

    for (const order of targetOrders) {
      for (const product of order.products) {
        if (
          product.isSet &&
          product.isSet?.length > 0 &&
          product.isSet[0] !== null
        ) {
          for (const item of product.isSet) {
            const targetChild = orderArray.find(order => order.item === item)
            if (!targetChild) {
                const child = { order: [order.id], item, amount: product.amount};
                orderArray.push(child);
            } else {
                targetChild.order.push(order.id);
                targetChild.amount += product.amount;
            }
          }
        } else {
            const targetChild = orderArray.find(order => order.item === product.sku)
            if (!targetChild) {
                const child = { order: [order.id], item: product.sku, amount: product.amount};
                orderArray.push(child);
            } else {
                targetChild.order.push(order.id);
                targetChild.amount += product.amount;
            }
        }
      }
    }

    for (const i of orderArray) {
        const row = [i.order.join(', '), i.item, i.amount]; 
        rows.push(row);
    }

    await updateSheets(sheets, spreadsheetId, range, rows);
  } catch (error) {
    console.error("Error changing table:", error);
  }
};

async function checkOrdersToOrder() {
  const owners = await User.find({ role: "owner" }).exec();

  try {
    const result = await fetchOrders();
    const message = `Проверка заказов завершена. Найдено ${result.length} заказов в статусе "Заказать".
    Хотите чтобы я вписал их в щаблон заказа Motea?

*Это полностью перезапишет данные в таблице, если нужно, сделайте копию.`;

    const replyButtons = {
      inline_keyboard: [
        [
          {
            text: "Вписать в шаблон",
            callback_data: "UPDATE_MOTEA_ORDER_TABLE",
          },
        ],
      ],
    };

    for (const owner of owners) {
      if (owner?.chatId && owner?.chatId !== "") {
        await sendTelegramMessage(message, owner.chatId, replyButtons);
      }
    }
  } catch (error) {
    console.log("Error checking orders to order:", error);
  }
}

module.exports = { checkOrdersToOrder, changeTable };
