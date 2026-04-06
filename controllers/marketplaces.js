const axios = require("axios");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const Product = require("../models/item");
const User = require("../models/user");
const readline = require("readline");

let updateFlag = false;

function waitEnter(message = "Нажмите Enter...") {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(message, () => {
        rl.close();
        resolve();
      });
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToken() {
  const user = await User.findOne({ name: "horoshop" }).exec();
  const { email, chatId, token, _id } = user;
  const now = new Date();
  let result;
  const diff = now - token[0];

  if (diff < 500000) {
    result = token[1];
  } else {
    const { data } = await axios.post("https://vulpes.com.ua/api/auth/", {
      login: email,
      password: chatId,
    });
    await User.findByIdAndUpdate(_id, { token: [now, data.response.token] });
    result = data.response.token;
  }

  return result;
}

async function horoshopCheckUpdatePrice(req, res) {
  const result = [];
  const batchSize = 20;
  let skip = 0;
  let lastId = null;

  try {
    while (result.length < 10) {
      const query = lastId ? { _id: { $gt: lastId } } : {};
      const batch = await Product.find(query, {
        article: 1,
        price: 1,
        moteaPrice: 1,
        name: 1,
      })
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean();

      skip += batchSize;
      lastId = batch[batch.length - 1]._id;

      for (const item of batch) {
        const db = item.price.UAH || 0;
        const mt = item.moteaPrice.UAH || 0;
        if (mt === 0 || db === 0) continue;
        const difference = Math.round((Math.abs(db - mt) / db) * 100);

        if (difference >= 5) {
          result.push(item);
        }
        if (result.length === 10) break;
      }
    }

    res.status(200).send(result);
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function horoshopUpdatePrice(req, res) {
  const chatId = req?.user?.user?.chatId || null;
  const undefinedProducts = [];
  try {
    if (updateFlag) {
      res.status(200).send({ message: "price update has alrady started" });
      return;
    } else {
      res.status(200).send({ message: "price update started" });
    }

    updateFlag = true;
    let page = 0;

    while (true) {
      const token = await getToken();
      const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
        {
          offset: page,
          limit: 500,
          includedParams: ["article", "price", "price_old", "presence", "export_to_marketplace", "supplier"],
          token,
        },
      );

      if (data?.response?.code === 429) {
        console.log(data.status, data.response.message);
        const ms = new Date(new Date().setMinutes(0, 0, 0) + 3600000) - new Date();
        await sleep(ms);
        continue;
      }

      for (const product of data.response.products) {
        const updated = {};
        const target = await Product.findOne({ article: product.article }, { price: 1, moteaPrice: 1, quantityInStock: 1, availabilityInMotea: 1, vendorprice: 1, marketplaces: 1 }).lean();
        if (!target) {
            undefinedProducts.push(product.article);
            continue;
        }
        console.log(target);
        console.log(product);

        if (target?.moteaPrice?.UAH && target.moteaPrice.UAH !== 0) {
            const difference = Math.round((Math.abs(product?.price_old - target?.moteaPrice?.UAH) / product?.price_old) * 100);

            if (difference >= 5) {
                // поправь для PUIG !!!!!!!!!!!!!!!!!!!!!!!!!!
                updated.price = Math.round(target?.moteaPrice?.UAH * 0.85);
                updated.price_old = target?.moteaPrice?.UAH;
            }
        }

        if (target.quantityInStock > 0 && product.presence.id !== 1) {
            updated.presence = 'В наявності';
            updated.export_to_marketplace = 'Google Feed for Merchant Center';
            updated.display_in_showcase = true;
        }

        if (target.quantityInStock <= 0) {
            if (target.availabilityInMotea === 'in stock' && product?.presence?.value?.ua !== 'Доставка 10-18 днів') {
                updated.presence = 'Доставка 10-18 днів';
                updated.export_to_marketplace = 'Google Feed for Merchant Center';
                updated.display_in_showcase = true;
            } else if (target.availabilityInMotea !== 'in stock' && product?.presence?.value?.ua !== 'Немає в наявності') {
                updated.presence = 'Немає в наявності';
                updated.export_to_marketplace = '';
                updated.display_in_showcase = false;
            }
        }

        console.log(updated);
        await waitEnter();
      }

      if (data.response.products.length < 500) break;
      page += 500;
    }

    updateFlag = false;
  } catch (err) {
    console.log(err);
    await sendTelegramMessage(
      `Во время обновления цен на Хорошопе произошла ошибка: ${JSON.stringify(err)}`,
      chatId,
    );
    updateFlag = false;
  }
}

module.exports = { horoshopCheckUpdatePrice, horoshopUpdatePrice };
