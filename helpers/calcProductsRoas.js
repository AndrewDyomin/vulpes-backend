const Product = require("../models/item");
const Orders = require("../models/ordersArchive");

async function calcProductsRoas() {
  const BATCH_SIZE = 200;
  let lastId = null;
  let count = 0;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId }, 'statistic.adCost': { $gt: 0 } } : { 'statistic.adCost': { $gt: 0 } };
    const batch = await Product.find(query, { article: 1, statistic: 1, _id: 1, })
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    for (const item of batch) {
        if (!item?.statistic?.adCost) continue;

        count++;
        if (count % 500 === 0) {
          console.log(count);
        }

        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const dateFrom = [
          twoMonthsAgo.getFullYear(),
          String(twoMonthsAgo.getMonth() + 1).padStart(2, "0"),
          String(twoMonthsAgo.getDate()).padStart(2, "0")
        ].join("-") + " 00:00:00";

        const orders = await Orders.find({
            statusId: 5,
            orderTime: { $gte: dateFrom },
            $or: [
                { "products.sku": item.article },
                { "products.complect.sku": item.article }
            ]
        }, { paymentAmount: 1, id: 1, products: 1 });

        if (!orders?.length) {
          await Product.findByIdAndUpdate(item._id, {
            $set: { "statistic.roas": 0 },
          });
          continue;
        }

        // ----- МОЖЕТ ЛУЧШЕ СЧИТАТЬ ПРИБЫЛЬ ?????? --------------
        const totalPayment = orders.reduce((acc, order) => acc + (Number(order.paymentAmount) || 0), 0);
        const roas = Number((totalPayment / item.statistic.adCost).toFixed(2));
        await Product.findByIdAndUpdate(item._id, {$set: { "statistic.roas": roas }});
    }

    lastId = batch[batch.length - 1]._id;
  }

  console.log("Расчет ROAS для товаров завершен. Обработано товаров:", count);
}

module.exports = { calcProductsRoas };
