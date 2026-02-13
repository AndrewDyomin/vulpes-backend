const Categories = require("../models/puigCategories");

async function getCategories(req, res, next) {
    try {
        const array = await Categories.find({}, { _id: 0, id: 1, title: 1 }).exec();
        res.status(200).send(JSON.stringify(array));
    } catch(err) {
        console.log(err)
        res.status(500).send(JSON.stringify(err));
    }
}

module.exports = { getCategories };