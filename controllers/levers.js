const Product = require("../models/item");
const sendTelegramMessage = require("../helpers/sendTelegramMessage");
const User = require("../models/user");
const axios = require("axios");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncByColor(reference, target) {
  const map = new Map(target.map((item) => [item.color, item]));

  return reference.map((item) => map.get(item.color)).filter(Boolean);
}

async function updateLever(req, res) {
  console.log(req.body);
  try {
    const updated = {
      article: req.body.article,
      color: req.body.color,
      lever: {
        type: req.body.type,
        generations: req.body.generations,
        side: {
          brake: req.body.brakeBikes.filter((b) => b.brand !== ""),
          clutch: req.body.clutchBikes.filter((b) => b.brand !== ""),
        },
      },
    };

    if (updated.lever.type !== "adapter") {
      updated.lever.side.brake = req.body.brake ? [`${req.body.brake}`] : [];
      updated.lever.side.clutch = req.body.clutch ? [`${req.body.clutch}`] : [];
    }

    console.log("updated", updated);

    await Product.findOneAndUpdate(
      { article: updated.article },
      { color: updated.color, lever: updated.lever },
    );

    res.status(200).send({ message: "Detail updated" });
  } catch (err) {
    console.log(err);
  }
}

async function getByBike(req, res) {
  try {
    const { brand, model, year, generation } = req.body;

    const donorMap = {
        "standart short": '115829',
        "standart long": '115829',
        "safety": '116856',
        "vario": '117433',
        "vario safety": '117874',
        "vario lll": '118506',
    };

    const clutch = await Product.find({
      "lever.side.clutch": {
        $elemMatch: {
          brand,
          model,
          from: { $lte: year },
          $or: [
            { to: { $exists: false } },
            { to: null },
            { to: { $gte: year } },
          ],
        },
      },
    });
    const brake = await Product.find({
      "lever.side.brake": {
        $elemMatch: {
          brand,
          model,
          from: { $lte: year },
          $or: [
            { to: { $exists: false } },
            { to: null },
            { to: { $gte: year } },
          ],
        },
      },
    });
    const clutchLevers = await Product.find({
      "lever.type": "lever",
      "lever.generations": generation,
      "lever.side.clutch.0": { $exists: true },
    }).sort({ color: 1 });
    const brakeLevers = await Product.find({
      "lever.type": "lever",
      "lever.generations": generation,
      "lever.side.brake.0": { $exists: true },
    }).sort({ color: 1 });
    const clutchTips = await Product.find({
      "lever.type": "tip",
      "lever.generations": generation,
      "lever.side.clutch.0": { $exists: true },
    }).sort({ color: 1 });
    const brakeTips = await Product.find({
      "lever.type": "tip",
      "lever.generations": generation,
      "lever.side.brake.0": { $exists: true },
    }).sort({ color: 1 });
    const adjustor = await Product.find({
      "lever.type": "adjustor",
      "lever.generations": generation,
    }).sort({ color: 1 });

    const syncedBrakeLevers = syncByColor(clutchLevers, brakeLevers);
    const syncedBrakeTips = syncByColor(clutchTips, brakeTips);

    const donor = await Product.findOne({ article: donorMap[generation] }, { price: 1 }).lean();

    res
      .status(200)
      .send({
        clutch,
        brake,
        clutchLevers,
        brakeLevers: syncedBrakeLevers,
        clutchTips,
        brakeTips: syncedBrakeTips,
        adjustor,
        price: donor?.price?.UAH || null,
      });
  } catch (err) {
    console.log(err);
  }
}

async function getTopImage(req, res) {
  const { generation, lever, adjustor, tip } = req.body;
  if (!generation || !lever || !adjustor) {
    res.status(400).send({ message: "Set not found" });
    return;
  }
  const key = `${generation}-${lever}-${adjustor}-${tip}`.replace(" ", "-");

  const standartShort = {
    black: "202002-0",
    "black mat": "",
    blue: "200095-0",
    gold: "202000-0",
    green: "202001-0",
    orange: "202004-0",
    red: "200099-0",
    silver: "202005-0",
    titanium: "200100-0",
  };

  const standartLong = {
    black: "202007-0",
    "black mat": "202008-0",
    blue: "200103-0",
    gold: "202006-0",
    green: "202009-0",
    orange: "202010-0",
    red: "200106-0",
    silver: "202011-0",
    titanium: "202012-0",
  };

  const safety = {
    black: "200134-0",
    "black mat": "641655-0",
    blue: "200133-0",
    gold: "200135-0",
    green: "200132-0",
    orange: "641555-0",
    red: "200138-0",
    silver: "200136-0",
    titanium: "200137-0",
  };

  const vario = {
    black: "200059-0",
    "black mat": "711573-0",
    blue: "200057-0",
    gold: "200060-0",
    green: "200131-0",
    orange: "711697-0",
    red: "200062-0",
    silver: "200061-0",
    titanium: "200063-0",
  };

  const varioSafety = {
    black: "316656-0",
    "black mat": "712049-0",
    blue: "316599-0",
    gold: "316650-0",
    green: "316651-0",
    orange: "712134-0",
    red: "316654-0",
    silver: "316657-0",
    titanium: "",
  };

  const variolll = {
    black: "385532-0",
    "black mat": "385533-0",
    blue: "709455-0",
    gold: "709457-0",
    green: "709475-0",
    orange: "709535-0",
    red: "385535-0",
    silver: "385534-0",
    titanium: "709589-0",
  };

  const adjusters = {
    black: "200001-0",
    "black mat": "333305-0",
    blue: "200002-0",
    gold: "200003-0",
    green: "200123-0",
    orange: "333301-0",
    red: "200005-0",
    silver: "200004-0",
    titanium: "200006-0",
  };

  const tipColors = {
    black: "302249-0",
    blue: "302255-0",
    gold: "302261-0",
    green: "335454-0",
    orange: "711930-0",
    red: "302258-0",
    silver: "302252-0",
    titanium: "",
  };

  const tiplllColors = {
    black: "385544-0",
    "black mat": "385545-0",
    blue: "709591-0",
    gold: "709592-0",
    green: "709593-0",
    orange: "709738-0",
    red: "385547-0",
    silver: "385546-0",
    titanium: "709902-0",
  };

  let link = "https://www.motea.com/media/configuratorimg/";

  if (generation === "standart short") {
    link += standartShort[lever];
    link += "-";
    link += adjusters[adjustor];
  }

  if (generation === "standart long") {
    link += standartLong[lever];
    link += "-";
    link += adjusters[adjustor];
  }

  if (generation === "safety") {
    link += safety[lever];
    link += "-";
    link += adjusters[adjustor];
  }

  if (generation === "vario") {
    link += vario[lever];
    link += "-";
    link += tipColors[tip];
    link += "-";
    link += adjusters[adjustor].replace("-0", "");
  }

  if (generation === "vario safety") {
    link += varioSafety[lever];
    link += "-";
    link += tipColors[tip];
    link += "-";
    link += adjusters[adjustor].replace("-0", "");
  }

  if (generation === "vario lll") {
    link += variolll[lever];
    link += "-";
    link += tiplllColors[tip];
    link += "-";
    link += adjusters[adjustor];
  }

  link += ".jpg";

  res.status(200).send({ link });
}

async function requestLevers(req, res) {
  const { vin, name, phone, query, color } = req.body;
  try {
    if (!phone || phone === "") {
      throw new Error("Phone is required.");
    }

    let text = `${name} просить підібрати йому важелі.\nтел: ${phone}\nVIN: ${vin}\n`;

    if (query?.generation) {
        text += `\nВін дивився на комплект ${query.generation} для ${query.brand} ${query.model} ${query.year}року.\n`;
        text += `Колір:\nВажіль: ${color.leverColor}\nРегулятор: ${color.adjustorColor}\n`;
        if (query.generation.toLowerCase().includes('vario')) {
            text += `Наконечник: ${color.tipColor}`;
        }
    }

    await sendTelegramMessage(text, process.env.ADMIN_CHAT_ID);
    const manager = await User.findOne({ role: 'manager' }, { chatId: 1 }).lean()
    await sendTelegramMessage(text, manager.chatId);

    res.status(200).send({ message: 'Ok' });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: err });
  }
}

async function addOrder(req, res) {
  const { 
    firstName, 
    lastName, 
    phone, 
    city, 
    cityRef, 
    branch, 
    branchRef, 
    brand, 
    model, 
    year, 
    generation, 
    price, 
    clutch, 
    brake, 
  } = req.body;

  try {
    const donorMap = {
      "standart short": '115829',
      "standart long": '115829',
      "safety": '116856',
      "vario": '117433',
      "vario safety": '117874',
      "vario lll": '118506',
    };
    const donor = await Product.findOne({ article: donorMap[generation] }, { name: 1, }).lean();

    const body = {
      "getResultData": 1,
      "lName": String(lastName),
      "fName": String(firstName),
      "phone": String(phone),
      "products": [
        {
          "id": donorMap[generation],
          "name": donor.name.UA,
          "costPerItem": price,
          "amount": 1,
          "sku": donorMap[generation],
        }
      ],
      "payment_method": "Післяплата",
      "shipping_method": "Новая Почта",
      "shipping_address": `${city}, ${branch}`,
      "comment": `Важелі ${generation} для ${brand} ${model} ${year}року.
      \n Адаптер зчеплення: ${clutch.adapter.map(i => i.article).join(', ')} - 1шт; 
      \n Адаптер гальма: ${brake.adapter.map(i => i.article).join(', ')} - 1шт; 
      \n Важіль зчеплення: ${clutch.lever.article} - 1шт; 
      \n Важіль гальма: ${brake.lever.article} - 1шт; 
      \n Регулятор: ${clutch.adjustor.article} - 2шт; 
      ${clutch.tip ? `\n Наконечник зчеплення: ${clutch.tip.article} - 1шт; ` : ''}
      ${brake.tip ? `\n Наконечник гальма: ${brake.tip.article} - 1шт; ` : ''}`,
      "sajt": "vulpes-moto.app",
      "novaposhta": {
        "ServiceType": "Warehouse",
        "payer": "recipient",
        "city": cityRef,
        "WarehouseNumber": branchRef,
      },
    };

    const headers = {
      "X-Api-Key": process.env.X_API_KEY,
      "Content-Type": "application/json",
    };

    const { data } = await axios.post('https://vulpes.salesdrive.me/handler/', body, { headers });

    res.status(200).send({ message: 'Order accepted', data: { success: true, data }});
  } catch(err) {
    console.log(err)
    res.status(500).send({ message: 'Something went wrong. Try again later' });
  }
}

module.exports = {
  updateLever,
  getByBike,
  getTopImage,
  requestLevers,
  addOrder,
};
