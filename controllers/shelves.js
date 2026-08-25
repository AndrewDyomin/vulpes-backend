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

async function updateShelf(req, res) {
    try {
        const { products, shelf } = req.body;
        if (!shelf._id) {
            throw new Error('Shelf _id is required');
        }

        const targetShelf = await Shelves.findById(shelf._id);
        if (!targetShelf) {
            throw new Error('Shelf not found');
        }

        if (products?.length > 0) {
            const newItems = [ ...targetShelf.items ];
            for (const product of products) {
                const target = newItems.find(i => i.article === product.article);
                if (!target) {
                    newItems.push(product);
                } else {
                    Number(target.count) += Number(product.count);
                }
            }

            await Shelves.findByIdAndUpdate(shelf._id, { items: newItems });
        }

        res.status(200).send({ message: 'shelf updated' })
    } catch(err) {
        console.log(err);
        res.status(500).send({ message: 'Something went wrong' })
    }
}

module.exports = {
    addShelf,
    getAllShelves,
    updateShelf,
}