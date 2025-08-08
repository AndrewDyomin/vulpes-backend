const OrdersArchive = require("../models/ordersArchive");

function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0 (вс) – 6 (сб)

  // Считаем понедельник началом недели
  const diffToMonday = day === 0 ? -6 : 0 - day;

  const start = new Date(today);
  start.setDate(today.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  };
}

async function reportToOwner() {
  try {
    const allOrders = await OrdersArchive.find({}).exec();
    const { startDate, endDate } = getCurrentWeekRange();
    let target

    const allStatusLabels = allOrders
      .map(order => order.statusLabel)
      .filter(label => label !== undefined);
    const allStatuses = [...new Set(allStatusLabels)];
    console.log(allStatuses);

    const newOrders = allOrders.filter(order => {
        if (!order.orderTime) return false;
        const orderDate = new Date(order.orderTime);
        const start = new Date(startDate)
        const end = new Date(endDate)
        if (!target) {target = orderDate}
        return orderDate >= start && orderDate <= end;
    });

    
  } catch (error) {
    console.log(error);
  }
}

module.exports = { reportToOwner };