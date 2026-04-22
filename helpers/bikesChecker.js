const Items = require("../models/item");
const PuigBikes = require("../models/puigBikes");
const Bikes = require("../models/bikes");

function normalizeYear(year) {
  if (year < 100) {
    return year <= 50 ? 2000 + year : 1900 + year;
  }
  return year;
}

function parseYears(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map(Number)
      .filter(y => !isNaN(y))
      .map(normalizeYear);
  }

  if (typeof input === 'string') {
    const parts = input.split('-').map(s => s.trim());

    let start = Number(parts[0]);
    let end = parts[1] ? Number(parts[1]) : start;

    if (isNaN(start) || isNaN(end)) return [];

    start = normalizeYear(start);
    end = normalizeYear(end);

    if (end < start) return [];

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  return [];
}

async function checkBikes() {
    console.log('Check bikes started.')

    const products = Items.find({ bikeList: { $exists: true, $ne: [ null ] } }, { bikeList: 1 }).lean().cursor();
    const brandMap = new Map();

    for await (const product of products) {

        for (const bike of product.bikeList) {
        const brandName = bike.make.trim().toLowerCase();
        const modelName = bike.model.trim().toLowerCase();
        const years = parseYears(bike.year);

        // --- BRAND ---
        if (!brandMap.has(brandName)) {
            brandMap.set(brandName, new Map());
        }

        const modelMap = brandMap.get(brandName);

        // --- MODEL ---
        if (!modelMap.has(modelName)) {
            modelMap.set(modelName, new Set());
        }

        const yearSet = modelMap.get(modelName);

        // --- YEARS ---
        years.forEach(y => yearSet.add(y));
        }
    }

    // const puigBikes = PuigBikes.find({}, { brand: 1, model: 1, year: 1 }).lean().cursor();

    // for await (const bike of puigBikes) {
    //     const brandName = bike.brand.trim().toLowerCase();
    //     const modelName = bike.model.trim().toLowerCase();
    //     const years = parseYears(bike.year);

    //     // --- BRAND ---
    //     if (!brandMap.has(brandName)) {
    //         brandMap.set(brandName, new Map());
    //     }

    //     const modelMap = brandMap.get(brandName);

    //     // --- MODEL ---
    //     if (!modelMap.has(modelName)) {
    //         modelMap.set(modelName, new Set());
    //     }

    //     const yearSet = modelMap.get(modelName);

    //     // --- YEARS ---
    //     years.forEach(y => yearSet.add(y));
    // }

    const result = [];

    for (const [brand, modelsMap] of brandMap) {
        const models = [];

        for (const [name, yearsSet] of modelsMap) {
        models.push({
            name,
            years: Array.from(yearsSet).sort((a, b) => a - b),
        });
        }

        result.push({ brand, models });
    }

    while (result.length > 0) {
        const batch = result.splice(0, 100);

        await Bikes.bulkWrite(
            batch.map(item => ({
            updateOne: {
                filter: { brand: item.brand },
                update: { $set: item },
                upsert: true,
            }
            }))
        );
    }

    console.log('Check bikes finished.')
}

module.exports = { checkBikes }