const Product = require("../models/item");

function syncByColor(reference, target) {
  const map = new Map(
    target.map(item => [item.color, item])
  );

  return reference
    .map(item => map.get(item.color))
    .filter(Boolean);
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
                    brake: req.body.brakeBikes.filter(b => b.brand !== ''),
                    clutch: req.body.clutchBikes.filter(b => b.brand !== ''),
                }
            },
        };

        if (updated.lever.type !== 'adapter') {
            updated.lever.side.brake = req.body.brake ? [`${req.body.brake}`] : [];
            updated.lever.side.clutch = req.body.clutch ? [`${req.body.clutch}`] : [];
        }

        console.log('updated', updated);
        
        await Product.findOneAndUpdate({ article: updated.article }, { color: updated.color, lever: updated.lever })

        res.status(200).send({ message: "Detail updated" });
    } catch(err) {
        console.log(err);
    }
}

async function getByBike(req, res) {
    try {
        const { brand, model, year, generation } = req.body;

        const clutch = await Product.find({
            'lever.side.clutch': {
                $elemMatch: {
                    brand,
                    model,
                    from: { $lte: year },
                },
            },
        });
        const brake = await Product.find({
            'lever.side.brake': {
                $elemMatch: {
                    brand,
                    model,
                    from: { $lte: year },
                },
            },
        });
        const clutchLevers = await Product.find({
            'lever.type': 'lever',
            'lever.generations': generation,
            'lever.side.clutch.0': { $exists: true },
        }).sort({ color: 1 });
        const brakeLevers = await Product.find({
            'lever.type': 'lever',
            'lever.generations': generation,
            'lever.side.brake.0': { $exists: true },
        }).sort({ color: 1 });
        const clutchTips = await Product.find({
            'lever.type': 'tip',
            'lever.generations': generation,
            'lever.side.clutch.0': { $exists: true },
        }).sort({ color: 1 });
        const brakeTips = await Product.find({
            'lever.type': 'tip',
            'lever.generations': generation,
            'lever.side.brake.0': { $exists: true },
        }).sort({ color: 1 });
        const adjustor = await Product.find({
            'lever.type': 'adjustor',
            'lever.generations': generation,
        }).sort({ color: 1 });

        const syncedBrakeLevers = syncByColor(clutchLevers, brakeLevers);
        const syncedBrakeTips = syncByColor(clutchTips, brakeTips);

        res.status(200).send({ clutch, brake, clutchLevers, brakeLevers: syncedBrakeLevers, clutchTips, brakeTips: syncedBrakeTips, adjustor });
    } catch(err) {
        console.log(err)
    }
}

async function getTopImage(req, res) {
    const { generation, lever, adjustor, tip } = req.body;
    if (!generation || !lever || !adjustor) {
        res.status(400).send({ message: 'Set not found' });
        return;
    }
    const key = `${generation}-${lever}-${adjustor}-${tip}`.replace(' ', '-');
    console.log(key)

    const standartShort = {
        "black": '202002-0',
        "black mat": '',
        "blue": '200095-0',
        "gold": '202000-0',
        "green": '202001-0',
        "orange": '202004-0',
        "red": '200099-0',
        "silver": '202005-0',
        "titanium": '200100-0',
    };

    const standartLong = {
        "black": '202007-0',
        "black mat": '202008-0',
        "blue": '200103-0',
        "gold": '202006-0',
        "green": '202009-0',
        "orange": '202010-0',
        "red": '200106-0',
        "silver": '202011-0',
        "titanium": '202012-0',
    };

    const adjusters = {
        "black": '200001-0',
        "black mat": '333305-0',
        "blue": '200002-0',
        "gold": '200003-0',
        "green": '200123-0',
        "orange": '333301-0',
        "red": '200005-0',
        "silver": '200004-0',
        "titanium": '200006-0',
    };

    let link = 'https://www.motea.com/media/configuratorimg/';

    if (generation === 'standart short') {
        link += standartShort[lever];
        link += '-';
        link += adjusters[adjustor];
    }

    if (generation === 'standart long') {
        link += standartLong[lever];
        link += '-';
        link += adjusters[adjustor];
    }

    link += '.jpg';

    res.status(200).send({ link });
}

module.exports = { 
  updateLever,
  getByBike,
  getTopImage,
}