const axios = require("axios");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const { getHoroshopItems } = require("../helpers/horoshop");
const Product = require("../models/item");
const PuigArticles = require("../models/puigArticles")
const User = require("../models/user");
const Marketplaces = require("../models/marketplaces");
const readline = require("readline");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

let updateFlag = false;

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
  let markup = 1;

  try {
    const market = await Marketplaces.findById({ _id: '6a2ab8b087d179dd95924ab0' }).lean();
    if (market?.markup) {
      markup = market.markup;
    }
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
        const db = item?.price?.UAH || 0;
        const mt = item?.moteaPrice?.UAH || 0;
        if (mt === 0 || db === 0) continue;
        const difference = Math.round((Math.abs(db - (mt * markup)) / db) * 100);

        if (difference >= 5) {
          result.push({ ...item, moteaPrice: { ...item.moteaPrice, UAH: Math.round(item.moteaPrice.UAH * markup) } });
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
  const chatId = req?.user?.user?.chatId || process.env.ADMIN_CHAT_ID;
  const undefinedProducts = [];
  const autoIncreased = [];
  let markup = 1;
  let total = 0;

  try {
    if (updateFlag) {
      if (res) {
        res.status(200).send({ message: "price update has alrady started" });
      }
        return;
    } else {
      if (res) {
        res.status(200).send({ message: "price update started" });
      }
    }

    const market = await Marketplaces.findById({ _id: '6a2ab8b087d179dd95924ab0' }).lean();
    if (market?.markup) {
      markup = market.markup;
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
            const difference = Math.round((Math.abs(product?.price_old - (target?.moteaPrice?.UAH * markup)) / product?.price_old) * 100);

            if (difference >= 5 && product.brand?.value?.ua !== 'Puig' && product.brand?.value?.ua !== 'MRA') {
              updated.price = Math.round(target?.moteaPrice?.UAH * markup * 0.85);
              updated.price_old = Math.round(target?.moteaPrice?.UAH * markup);
              if (target.vendorprice && target.vendorprice * 2 > updated.price) {
                updated.price = Math.round(target.vendorprice * 2.35 * 0.85);
                updated.price_old = Math.round(target.vendorprice * 2.35);
                autoIncreased.push({ article: product.article, price: target.moteaPrice.UAH, newPrice: updated.price })
              }
            } else if (difference >= 5 && (product.brand?.value?.ua === 'Puig' || product.brand?.value?.ua === 'MRA')) {
              updated.price = Math.round(target?.moteaPrice?.UAH * markup);
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
            continue;
          }

          if (target.pvp_recommended && target.pvp_recommended !== "0") {
            const recommendedPrice = Math.round(Number(target.pvp_recommended) * eurSell * markup);
            const difference = Math.round((Math.abs(product?.price - recommendedPrice) / product?.price) * 100);

            if (difference >= 3) {
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
          target = donorsMap.get(product.article);
          if (!target) {
            undefinedProducts.push(product.article);
            continue;
          }

          if (target.quantityInStock > 0 && product.presence.id !== 1) {
              updated.presence = 'В наявності';
              updated.export_to_marketplace = 'Google Feed for Merchant Center';
              updated.display_in_showcase = true;
          }

          if (target.quantityInStock <= 0) {
              if (target?.availabilityInMotea === 'in stock' && product?.presence?.value?.ua !== 'Доставка 10-18 днів') {
                  updated.presence = 'Доставка 10-18 днів';
                  updated.export_to_marketplace = 'Google Feed for Merchant Center';
                  updated.display_in_showcase = true;
              } else if (target?.availabilityInMotea !== 'in stock' && product?.presence?.value?.ua !== 'Немає в наявності') {
                  updated.presence = 'Немає в наявності';
                  updated.export_to_marketplace = '';
                  updated.display_in_showcase = false;
              }
          }
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

async function saveImages(product) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.OAUTH_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client, });
    const rootFolderId = process.env.IMAGES_DRIVE;

    const res = await drive.files.list({
      q: `
        mimeType = 'application/vnd.google-apps.folder'
        and name = '${product.article}'
        and '${rootFolderId}' in parents
        and trashed = false
      `,
      fields: 'files(id, name)',
    });
    let targetFolder;
    
    if (res.data?.files?.length > 0) {
      targetFolder = res.data?.files[0];
    } else {
      const create = await drive.files.create({
        requestBody: {
          name: product.article,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id, name',
      });
      targetFolder = create.data;
    }

    const filesRes = await drive.files.list({
      q: `'${targetFolder.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 100,
    });
    targetFolder.files = filesRes.data?.files;

    if (targetFolder.files?.length !== product.images?.length) {
      let i = 0;
      for (const link of product.images) {
        const tmpPath = path.join(
          process.cwd(),
          'tmp',
          `${product.article}_${i}.jpg`
        );

        const response = await axios({
          url: link,
          method: 'GET',
          responseType: 'stream',
        });

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(tmpPath);

          response.data.pipe(writer);

          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        const newFile = await drive.files.create({
          requestBody: {
            name: `${product.article}_${i}`,
            parents: [targetFolder.id],
          },
          media: {
            mimeType: response.headers['content-type'] || 'image/jpeg',
            body: fs.createReadStream(tmpPath),
          },
          fields: 'id',
        });
        targetFolder.files.push(newFile.data)
        fs.unlinkSync(tmpPath);
        i++;
      }
    }

    targetFolder.uploaded = true;

    return targetFolder;
  } catch(err) {
    console.log(err);
    return { uploaded: false };
  }
};

async function horoshopGetOutdatedProducts(req, res) {
  const daysCount = 21;
  const daysMs = 24 * 60 * 60 * 1000 * daysCount;
  const now = new Date();
  try {
    const result = [];
    const products = await Product.find({ outdated: { $exists: true, $nin: [null, "true"] } }, { quantityInStock: 1, article: 1, name: 1, outdated: 1, images: 1, imagesDrive: 1 }).limit(400).lean();

    for (const product of products) {
      const dateDifference = now - new Date(product.outdated);
      if ((!product?.quantityInStock || product.quantityInStock < 1) && Number(dateDifference) >= Number(daysMs)) {
        if (!product?.imagesDrive?.uploaded) {
          const drive = await saveImages(product);
          if (drive?.uploaded) {
            await Product.findByIdAndUpdate(product._id, { imagesDrive: { folderId: drive.id, uploaded: true } })
            product.imagesDrive = { folderId: drive.id, uploaded: true };
          }
        }
        result.push({ ...product, dateDifference })
      }
      if (result?.length >= 30) break;
    }

    res.status(200).send(result);
  } catch (err) {
    console.log(err);
    res.status(500).send(JSON.stringify(err));
  }
}

async function horoshopRefreshOutdatedProducts(req, res) {
  const targetArray = req?.body;
  if (targetArray?.length) {
    try {
      const { products, error } = await getHoroshopItems(req?.body);
      if (error) {
        res.status(500).send({ error });
        return;
      }
      const existingArticles = new Set(products.map(i => i.article));
      const notFound = targetArray.filter(article => !existingArticles.has(article));

      if (notFound?.length) {
        const operations = [];
        for (const item of notFound) {
          operations.push({
            updateOne: {
              filter: { article: item },
              update: { $set: { outdated: "true" } },
            },
          });
        }
        await Product.bulkWrite(operations, { ordered: false });
      }

      await horoshopGetOutdatedProducts(req, res)
    } catch(err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  } else {
    res.status(200).send({ message: 'Array is empty.' });
  }
}

async function addMarketplace(req, res) {
  const { name } = req.body;
  try {
    await Marketplaces.create({ name });

    res.status(200).send({message: "Ok"});
  } catch(err) {
    console.log(err)
    res.status(200).send({message: "Error. Try again later"});
  }
}

async function getAllMarketplaces(req, res) {
  try {
    const array = await Marketplaces.find();

    res.status(200).send(array);
  } catch(err) {
    console.log(err);
    res.status(500).send([]);
  }
}

async function updateMarketplace(req, res) {
  const body = req?.body;
  const draft = {};
  try {
    const marketplace = await Marketplaces.findById({ _id: body?._id }).lean();
    if (!marketplace) {
      res.status(500)
      return;
    }
    Object.keys(marketplace).forEach(key => {
      if (
        marketplace[key] &&
        typeof marketplace[key] === 'object' &&
        !Array.isArray(marketplace[key])
      ) {
        Object.keys(marketplace[key]).forEach(subKey => {
          if (body[key][subKey] !== marketplace[key][subKey]) {
            draft[key][subKey] = body[key][subKey];
          }
        });
      } else {
        if (body[key] !== marketplace[key]) {
          draft[key] = body[key];
        }
      }
    });

    if (Object.keys(draft)?.length) {
      await Marketplaces.findByIdAndUpdate({ _id: body._id }, draft)
    }

    res.status(200).send({ message: 'Ok' });
  } catch(err) {
    console.log(err);
    res.status(500)
  }
}

module.exports = { 
  horoshopCheckUpdatePrice, 
  horoshopUpdatePrice, 
  horoshopGetOutdatedProducts, 
  horoshopRefreshOutdatedProducts, 
  addMarketplace,
  getAllMarketplaces,
  updateMarketplace,
};
