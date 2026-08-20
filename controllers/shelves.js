const Shelves = require('../models/shelves');

async function addShelf(req, res) {
    try {
        const total = await Shelves.countDocuments();
        await Shelves.create({ name: Number(total) + 1, items: [], room: '' })

        res.status(200).send({ message: 'Shelf created.' })
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: 'Something went wrong.' })
    }
}

async function getAllShelves(req, res) {
    try {
        const arr = await Shelves.find().lean();

        res.status(200).send(arr)
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: 'Something went wrong.' })
    }
}

module.exports = {
    addShelf,
    getAllShelves,
}