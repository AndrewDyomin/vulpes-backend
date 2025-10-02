const OrdersArchive = require("../models/ordersArchive");
const User = require("../models/user");
const sendTelegramMessage = require("./sendTelegramMessage");

function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0 (вс) – 6 (сб)

  // Считаем понедельник началом недели
  const diffToMonday = day === 0 ? -6 : 0 - day - 1;

  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: `${today.toISOString().slice(0, 10)} 23:59:59`,
  };
}

function formatWeekRange(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const pad = (num) => num.toString().padStart(2, "0");

  const startDay = pad(start.getDate());
  const endDay = pad(end.getDate());
  const month = pad(end.getMonth() + 1); // месяцы с 0
  const year = end.getFullYear();

  return `${startDay}–${endDay}.${month}.${year}`;
}

function getMostActiveDay(orders) {
  const counter = {};

  orders.forEach((order) => {
    if (!order.orderTime) return;

    const date = new Date(order.orderTime).toISOString().slice(0, 10);

    counter[date] = (counter[date] || 0) + 1;
  });

  // Находим день с максимальным количеством заказов
  let mostActiveDate = null;
  let maxCount = 0;

  for (const [date, count] of Object.entries(counter)) {
    if (count > maxCount) {
      maxCount = count;
      mostActiveDate = date;
    }
  }

  return { activityDate: mostActiveDate, activityCount: maxCount };
}

function getTopProducts(orders, topN = 3, minCount = 5000) {
  const productCount = {};

  orders.forEach((order) => {
    const products = order.products || [];
    products.forEach((product) => {
      const title = `(${product.sku}) ${product.text}` || "Без названия";
      productCount[title] = (productCount[title] || 0) + product.price;
    });
  });

  const filtered = Object.entries(productCount)
    .filter(([, count]) => count >= minCount) // фильтр по минимуму
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  if (filtered.length === 0) return [];

  return filtered.map(([title, count]) => ({ title, count }));
}

async function reportToOwner() {
  try {
    const owners = await User.find({ role: "owner" }).exec();
    const allOrders = await OrdersArchive.find({}).exec();
    const { startDate, endDate } = getCurrentWeekRange();

    const newOrders = allOrders.filter(({ orderTime }) => {
      if (!orderTime) return false;
      const date = new Date(orderTime);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });

    const { activityDate, activityCount } = getMostActiveDay(newOrders);
    const topProducts = getTopProducts(newOrders);
    let newOrdersPrice = 0;
    let marja = 0;
    const noneSelfPrice = [];


    newOrders.forEach((order) => {
      if (!order?.products || order.products.length === 0) return;
      order.products.forEach((product) => {
        const selfPrice = Number(product.costPrice) * 1.52;
        const mar = Number(product.price.toFixed(2)) - Number(selfPrice.toFixed(2));
        if (product.costPrice && product.costPrice !== '' && product.costPrice > 0) {
          marja += mar;
        } else {
          noneSelfPrice.push(`${product.sku === '' ? `#${order.id}` : product.sku} - ${product.text}`)
        }
        newOrdersPrice += Number(product.price);
      });
    });

    const reportMessage = `
🛒 Еженедельный отчёт (${formatWeekRange(startDate, endDate)})

Привет! Вот как прошла эта неделя:

• Новых заказов: ${newOrders.length}
• На общую сумму: ${Math.round(newOrdersPrice)}грн.
• Примерная маржа: ${Math.round(marja)}грн.
• Самый активный день: ${activityDate} (${activityCount})

${noneSelfPrice.length > 0 ? `Товары без себестоимости:
${noneSelfPrice.map((article, index) => `${index + 1}). ${article}`).join('\n')}` : ''}

${
  topProducts.length > 1 ?
  `📦 Топ‑${topProducts.length} товара недели:  
1. ${topProducts[0].title} (${topProducts[0].count}грн.)  
2. ${topProducts[1].title} (${topProducts[1].count}грн.)  
${
  topProducts.length > 2
    ? `3. ${topProducts[2].title} (${topProducts[2].count}грн.) `
    : ""
}`
: ''}

Хороших выходных! Если что — я на связи 👋
`.trim();


    for (const owner of owners) {
      if (owner?.chatId && owner?.chatId !== "") {
        await sendTelegramMessage(reportMessage, owner.chatId);
      }
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = { reportToOwner };
