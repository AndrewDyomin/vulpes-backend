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

async function getShelvesByArray(req, res) {
    try {
        const array = req.body;
        if (!array?.length) {
            throw new Error('array is empty')
        }

        const result = [];

        for (const item of array) {
            const shelves = await Shelves.find({ 'items.article': item.article }).lean();
            const targetShelves = [];

            for (const shelf of shelves) {
                targetShelves.push({ ...shelf, items: shelf.items.filter(i => i.article === item.article) })
                const total = shelf.items.reduce((acc, i) => acc + i.count, 0);
                if (total >= item.count) break;
            }
            // TO DO --- --- Если уже есть, то добавить
            result.push({ ...item, shelves: targetShelves });
        }
        
        const sorted = [...result].sort((a, b) => {
            const shelfA = a.shelves?.[0]?.name;
            const shelfB = b.shelves?.[0]?.name;

            if (!shelfA) return 1;
            if (!shelfB) return -1;

            return shelfA.localeCompare(shelfB, undefined, { numeric: true });
        });

        res.status(200).send(sorted);
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: 'Something went wrong' });
    }
}

async function chechSendedProducts(req, res) {
    console.log(req.body)
}

module.exports = {
    addShelf,
    updateShelf,
    getAllShelves,
    getShelvesByArray,
    chechSendedProducts,
}