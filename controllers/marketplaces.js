const axios = require("axios");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const Product = require("../models/item");
const PuigArticles = require("../models/puigArticles")
const User = require("../models/user");
const readline = require("readline");

let updateFlag = false;

// function waitEnter(message = "Нажмите Enter...") {
//     const rl = readline.createInterface({
//       input: process.stdin,
//       output: process.stdout,
//     });

//     return new Promise((resolve) => {
//       rl.question(message, () => {
//         rl.close();
//         resolve();
//       });
//     });
// }

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
  const autoIncreased = [];
  let total = 0;

  try {
    if (updateFlag) {
      res.status(200).send({ message: "price update has alrady started" });
      return;
    } else {
      res.status(200).send({ message: "price update started" });
    }

    const { data } = await axios.get('https://api.monobank.ua/bank/currency');

    const findRate = (codeA, codeB) =>
      data.find(
      item =>
          item.currencyCodeA === codeA &&
          item.currencyCodeB === codeB
      );

    function normalize(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100
    }

    async function flush(token, batch) {
      while (true) {
        const { data } = await axios.post("https://vulpes.com.ua/api/catalog/import/",
          {
            products: batch,
            token,
          },
        );
        if (data.status !== 'OK' && data?.response?.code !== 429) {
          console.log(data)
        }
        if (data?.response?.code === 429) {
          console.log(data.status, data.response.message);
          const ms = new Date(new Date().setMinutes(0, 0, 0) + 3600000) - new Date();
          await sleep(ms);
          continue;
        }
        break;
      }
    }

    // const usd = findRate(840, 980); // USD → UAH
    const eur = findRate(978, 980); // EUR → UAH
    const eurSell = normalize(eur?.rateSell) || normalize(eur?.rateCross);

    updateFlag = true;
    let page = 0;
    const toUpdate = [];

    while (true) {
      const token = await getToken();
      const { data } = await axios.post("https://vulpes.com.ua/api/catalog/export/",
        {
          offset: page,
          limit: 500,
          includedParams: ["article", "price", "price_old", "presence", "supplier", "brand"],
          token,
        },
      );

      if (data?.response?.code === 429) {
        console.log(data.status, data.response.message);
        const ms = new Date(new Date().setMinutes(0, 0, 0) + 3600000) - new Date();
        await sleep(ms);
        continue;
      }

      const activeArts = data.response.products.map(p => p.article);
      const donors = await Product.find({
          article: { $in: activeArts },
        }, { 
          article: 1, price: 1, moteaPrice: 1, quantityInStock: 1, availabilityInMotea: 1, vendorprice: 1, marketplaces: 1 
        }).lean();

      const donorsMap = new Map(donors.map(d => [d.article, d]));

      for (const product of data.response.products) {
        const updated = {};
        let target;

        if (product?.supplier?.value === 'MOTEA') {
          target = donorsMap.get(product.article);
          if (!target) {
            undefinedProducts.push(product.article);
            continue;
          }

          if (target?.moteaPrice?.UAH && target.moteaPrice.UAH !== 0) {
              const difference = Math.round((Math.abs(product?.price_old - target?.moteaPrice?.UAH) / product?.price_old) * 100);

              if (difference >= 5 && product.brand?.value?.ua !== 'Puig' && product.brand?.value?.ua !== 'MRA') {
                updated.price = Math.round(target?.moteaPrice?.UAH * 0.85);
                updated.price_old = target?.moteaPrice?.UAH;
                if (target.vendorprice && target.vendorprice * 2 > updated.price) {
                  updated.price = Math.round(target.vendorprice * 2.35 * 0.85);
                  updated.price_old = Math.round(target.vendorprice * 2.35);
                  autoIncreased.push({ article: product.article, price: target.moteaPrice.UAH, newPrice: updated.price })
                }
              } else if (difference >= 5 && (product.brand?.value?.ua === 'Puig' || product.brand?.value?.ua === 'MRA')) {
                updated.price = Math.round(target?.moteaPrice?.UAH);
                if (target.vendorprice && target.vendorprice * 2 > updated.price) {
                  updated.price = Math.round(target.vendorprice * 2);
                  updated.price_old = Math.round(target.vendorprice * 2);
                  autoIncreased.push({ article: product.article, price: target.moteaPrice.UAH, newPrice: updated.price });
                }
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
        } else if (product?.supplier?.value === 'Puig') {
          const article = product.article.includes('-') ? product.article.split('-')[0] : product.article;
          const art = article.slice(0, -1);
          const colorCode = article.slice(-1);
          target = await PuigArticles.findOne({ code: art, "colour.code": colorCode }, { stock: 1, stock_prevision: 1, pvp: 1, pvp_recommended: 1, quantityInStock: 1, horoshopStatus: 1 }).lean();
          if (!target) {
            undefinedProducts.push(product.article);
            console.log(product.article, '- undefined');
            continue;
          }

          if (target.pvp_recommended && target.pvp_recommended !== "0") {
            const recommendedPrice = Math.round(Number(target.pvp_recommended) * eurSell);
            const difference = Math.round((Math.abs(product?.price - recommendedPrice) / product?.price) * 100);

            if (difference >= 5) {
              updated.price = recommendedPrice;
              updated.price_old = recommendedPrice;
            }
          }

          if (target?.quantityInStock > 0 && product.presence.id !== 1 && target?.horoshopStatus === 'on') {
            updated.presence = 'В наявності';
            updated.export_to_marketplace = 'Google Feed for Merchant Center';
            updated.display_in_showcase = true;
          }

          if (!target?.quantityInStock || target?.quantityInStock <= 0) {
            const stock = Number(target.stock)
            if (Number.isFinite(stock) && stock > 0 && product?.presence?.value?.ua !== 'Доставка 10-18 днів' && target?.horoshopStatus === 'on') {
              updated.presence = 'Доставка 10-18 днів';
              updated.export_to_marketplace = 'Google Feed for Merchant Center';
              updated.display_in_showcase = true;
            } else if ((!Number.isFinite(stock) && product?.presence?.value?.ua !== 'Немає в наявності') || target?.horoshopStatus !== 'on') {
              updated.presence = 'Немає в наявності';
              updated.export_to_marketplace = '';
              updated.display_in_showcase = false;
            }
          }

        } else {
          undefinedProducts.push(product.article);
          console.log(product.article, '- undefined');
          continue;
        }        

        if (Object.keys(updated).length > 0) {
          updated.article = product.article;
          toUpdate.push(updated);
        }
        
        if (toUpdate.length >= 100) { // UP TO 500
          // flush products to marketplace
          total += toUpdate.length;
          const batch = toUpdate.splice(0);
          await flush(token, batch);
        }
      }

      if (data.response.products.length < 500) break;
      page += 500;
    }

    if (toUpdate.length > 0) {
      // flush products to marketplace
      const batch = toUpdate.splice(0);
      total += batch.length;
      const token = await getToken();
      await flush(token, batch);
    }

    updateFlag = false;

    function report() {
      let result = 'Цены и статусы на Хорошопе обновлены: ';

      if (undefinedProducts.length > 0) {
        const list = undefinedProducts.slice(0, 10);
        const rest = undefinedProducts.length - list.length;

        result += `\n\nНе удалось найти артикулы ${undefinedProducts.length}шт.: ${list.join(', ')}`;
        
        if (rest > 0) {
          result += `\n ... и ещё ${rest}шт.`;
        }
      }

      if (autoIncreased.length > 0) {
        const list = autoIncreased.slice(0, 5);
        const rest = autoIncreased.length - list.length;

        result += `\n\nДля некоторых артикулов цена была поднята автоматически: ${
          list.map(p => `\n${p.article}: ${p.price}->${p.newPrice}`).join(', ')
        }`;

        if (rest > 0) {
          result += `\n ... и ещё ${rest}шт.`;
        }
      }

      result += `\n\nВсего обработано ${total} товаров.`;

      return result;
    }

    await sendTelegramMessage(
      report(),
      chatId,
    );

    console.log('Цены и статусы на Хорошопе обновлены')

    return 0;
  } catch (err) {
    console.log(err);
    await sendTelegramMessage(
      `Во время обновления цен на Хорошопе произошла ошибка: ${err}`,
      chatId,
    );
    updateFlag = false;
  }
}

module.exports = { horoshopCheckUpdatePrice, horoshopUpdatePrice };
