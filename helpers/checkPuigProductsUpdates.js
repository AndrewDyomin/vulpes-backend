const axios = require("axios");
const mongoose = require("mongoose");
const LastUpdate = require('../models/puigLastUpdate');
const Articles = require("../models/puigArticles");

const MAIN_DB_URI = process.env.DB_URI;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const format = (number) => {
  if (number < 10) {
    return "0" + number;
  } else {
    return number;
  }
};

function getDateString(now) {
  const Y = now.getFullYear();
  const M = format(now.getMonth() + 1);
  const D = format(now.getDate());
  const H = format(now.getHours());
  const min = format(now.getMinutes())
  return `${Y}-${M}-${D} ${H}:${min}:00`;
}

async function checkPuigProductsUpdates() {
  try {
    await mongoose.connect(MAIN_DB_URI);
    console.log("Connected to main DB");
    console.log("Проверим что изменилось у Пуйча =)");

    const date = new Date();
    const now = new Date(date.getTime() - 600000);
    const lastFilterDate = await LastUpdate.findOne().exec();
    const filterDate = lastFilterDate?.date || lastFilterDate?.previousDate;
    const currentMinute = { min: Number(date.getMinutes()), count: 0 };
    const newFilterDate = getDateString(now);
    let count = 0;

    function addCount() {
      const minute = Number(new Date().getMinutes())
      if (currentMinute.min === minute) {
        currentMinute.count++
      } else {
        currentMinute.min = minute;
        currentMinute.count = 1;
      }
    }

    const { data } = await axios.get(
      "https://api.puighitechparts.de/en/references",
      {
        headers: {
          "Api-Token": process.env.PUIG_TOKEN,
        },
        params: {
          updatedAfter: filterDate,
          sortBy: 'updated_at',
          sortOrder: 'asc'
        },
      },
    );
    addCount();
    const articlesArray = data.data;

    for (const article of articlesArray) {
      while (true) {
        const minute = Number(new Date().getMinutes())
        if (currentMinute.count < 30 || currentMinute.min !== minute) {
          break;
        } else {
          await sleep(5000)
        }
      }
      try {
        const { data } = await axios.get(`https://api.puighitechparts.de/en/references/${article}`,
          {
            headers: {
              "Api-Token": process.env.PUIG_TOKEN,
            },
          },
        );
        addCount();

        for (const variant of data.data.variations) {
          while (true) {
            const minute = Number(new Date().getMinutes())
            if (currentMinute.count < 30 || currentMinute.min !== minute) {
              break;
            } else {
              await sleep(5000)
            }
          }
          try {
            const art = await Articles.findOne({ code: article, 'colour.code': variant }).exec();
            count ++;

            if (art?.outdated === 1) {
              continue;
            }

            const { data } = await axios.get(`https://api.puighitechparts.de/en/references/${article}/${variant}`,
              {
                headers: {
                  "Api-Token": process.env.PUIG_TOKEN,
                },
              },
            );
            addCount();
            const pArt = data.data;

            if (!art) {
              console.log(article, variant, '- not found in base!', 'outdated=', pArt.outdated);

              if (pArt.outdated === 1) {
                await Articles.create({ code: pArt.code, colour: { code: pArt.colour}, outdated: pArt.outdated })
              } else {
                await Articles.create({ 
                  code: pArt.code,
                  colour: {
                    code: pArt.colour,
                  },
                  stock: pArt.stock,
                  stock_prevision: pArt.stock_prevision,
                  outdated: pArt.outdated,
                  barcode: pArt.barcode,
                  alternative: pArt.alternative,
                  pvp: pArt.pvp,
                  pvp_recommended: pArt.pvp_recomended,
                  origin: pArt.origin,
                  hs_code: pArt.hs_code,
                  images: [ ...(pArt.multimedia?.images || []), ...(pArt.multimedia?.onbike?.map(i => i.media) || []) ]
                })
              }
              continue;
            }

            const diff = {};

            if (pArt.stock !== art.stock || art.stock_prevision !== pArt.stock_prevision) {
              diff.stock = pArt.stock;
              diff.stock_prevision = pArt.stock_prevision;
            }

            if (pArt.outdated !== art.outdated) {
              diff.outdated = pArt.outdated
            }

            if (pArt.pvp !== art.pvp || art.pvp_recommended !== pArt.pvp_recomended) {
              diff.pvp = pArt.pvp
              diff.pvp_recommended = pArt.pvp_recomended
            }

            if (pArt?.multimedia?.images?.length > 0 || pArt?.multimedia?.onbike?.length > 0) {
              const incoming = [];
              for (const image of pArt?.multimedia?.images) {
                if (!incoming.includes(image)) {
                  incoming.push(image);
                }
              }
              for (const image of pArt?.multimedia?.onbike) {
                if (!incoming.includes(image.media)) {
                  incoming.push(image.media);
                }
              }
              
              const arraysEqual = art.images.length === incoming.length && incoming.every(img => art.images.includes(img));

              if (!arraysEqual) {
                diff.images = [ ...incoming ];
              }
            }

            if (pArt.barcode !== art.barcode) {
              diff.barcode = pArt.barcode
            }

            if (Object.keys(diff).length > 0) {
              await Articles.findByIdAndUpdate(art._id, { $set: diff }, { new: true }).exec();
            }
            console.log(currentMinute);
            console.log(count, '- из 27081???');
          } catch(err) {
            console.log(err)
          }
          
        }
      } catch(err) {
        console.log(err)
      }
    }
    await LastUpdate.findByIdAndUpdate({ _id: lastFilterDate._id }, { date: newFilterDate, previousDate: filterDate })
  } catch (error) {
    console.log(`Puig products check failed due to an error: ${error}.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  await mongoose.disconnect();
  process.exit(0);
}

checkPuigProductsUpdates();