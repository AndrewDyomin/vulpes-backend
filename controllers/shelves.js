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

async function takeOffTheShelf(article, count) {
    try {
  if (!article) {
    throw new Error('Article is required');
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Count must be a positive integer');
  }

  const shelves = await Shelves.find({
    'items.article': article,
  });

  if (!shelves.length) {
    console.log(
      `Product with article ${article} not found on shelves`
    );
    return;
  }

  let remaining = count;

  for (const shelf of shelves) {
    if (remaining === 0) break;

    const item = shelf.items.find(
      item => item.article === article
    );

    if (!item) continue;

    const takeCount = Math.min(item.count, remaining);

    item.count -= takeCount;
    remaining -= takeCount;

    if (item.count === 0) {
      shelf.items = shelf.items.filter(
        item => item.article !== article
      );
    }

    await shelf.save();
  }

  return {
    article,
    taken: count,
  }} catch(err) {
    console.log(err);
  }
}

module.exports = {
    addShelf,
    updateShelf,
    getAllShelves,
    getShelvesByArray,
    takeOffTheShelf,
}