const cron = require("node-cron");
// const weeklyReport = require("../models/weeklyReport");
// const User = require("../models/user");
// const nodemailer = require("nodemailer");
require("dotenv").config();

// async function reportMail(wReport, totalCost, noCostOrders, orderStatusMark) {
//   try {

//     const letterTitle = `Отчет за неделю`;
//     const letterHtml = `
//         <div>
//         <h3 style="margin: 0px;">Добрый день</h3>
//         <p style="margin: 0px; margin-top: 20px;">На этой неделе мы сделали ${wReport.ordersArray.length} заказ(ов).</p>
//         <p style="margin: 0px;">Сумма оборота составляет ${totalCost} грн.</p>
//         ${noCostOrders.length !== 0 ? `
//             <p style="margin: 0px; margin-top: 20px;">Заказы без цены:</p>
//             ${noCostOrders.map(order => `<p style="margin: 0px;">${order.name} №${order.number} заказчик: ${order.dealer}</p>`).join('')}
//         ` : ''}
//         <p style="margin: 0px; margin-top: 20px;">Статистика "Заказ готов":</p>
//         ${orderStatusMark.map(obj => `
//             <p style="margin: 0px; margin-top: 20px; text-align: left;">${obj.user?.name}</p>
//             <div style="margin: 0px;">
//                 ${obj.orders.map(order => `<p style="margin: 0px;">№${order.number} : ${order.name}</p>`).join('')}
//             </div>
//         `).join('')}
//         </div>
//     `;

//     const addresses = 'TARGET.ua@gmail.com';

//     const config = {
//       host: "smtp.meta.ua",
//       port: 465,
//       secure: true,
//       auth: {
//         user: "OUR.bot@meta.ua",
//         pass: process.env.PASSWORD,
//       },
//     };

//     const transporter = nodemailer.createTransport(config);
//     const emailOptions = {
//       from: "OUR.bot@meta.ua",
//       to: addresses,
//       subject: `${letterTitle}`,
//       html: `${letterHtml}`,
//     };

//     transporter
//       .sendMail(emailOptions)
//       .then(() => {console.log(`Letter to ${addresses} sended`)})
//       .catch((err) => console.log(err));
//   } catch (err) {
//     console.log(err);
//   }
// }

const format = (number) => {
    if (number < 10) {
        return ('0' + number);
    } else {
        return number;
    }
}

// const getUser = async (id) => {
//     const user = await User.findById(id).exec()
//     return user;
// }

const report = async () => {
    // try {
    //     const wReport = await weeklyReport.findOne().exec();

    //     let totalCost = 0;
    //     const noCostOrders = [];
    //     const users = await Promise.all(
    //         wReport.ordersArray.map(order => getUser(JSON.parse(order.orderStatus).user))
    //     );
    //     let orderStatusMark = [];

    //     users.forEach(user => {
    //         if (!orderStatusMark.some(obj => obj.user.id === user._id)) {
    //             orderStatusMark.push({ user: { name: user.name, id: String(user._id)}, orders: [] })
    //         }});

    //     wReport.ordersArray.forEach(order => {
    //         if (order.innerPrice) {
    //             totalCost += order.innerPrice;
    //         }
    //         if (!order.innerPrice) {
    //             noCostOrders.push(order);
    //         }

    //         const executorId = JSON.parse(order.orderStatus).user;
    //         const filter = orderStatusMark.filter(user => user.user.id !== executorId)
    //         const target = orderStatusMark.find(user => user.user.id === executorId)
    //         target.orders = [ ...target.orders, { number: order.number, name: order.name } ]

    //         orderStatusMark = [ ...filter, target ];
    //     })

    //     reportMail(wReport, totalCost, noCostOrders, orderStatusMark);
    // } catch(err) {
    //     console.log(err)
    // }
}

const clearReport = async () => {
    // try {
    //     const wReport = await weeklyReport.findOne().exec();
    //     await weeklyReport.findByIdAndUpdate(wReport._id, { ordersArray: [] })
    // } catch(err) {
    //     console.log(err)
    // }
}

cron.schedule("0 17 * * 5", () => {
    const now = new Date();
    const today = format(now.getDate())
    const month = format(now.getMonth() + 1)
    const hours = format(now.getHours())
    const minutes = format(now.getMinutes())
    const seconds = format(now.getSeconds())
  console.log(`Scheduled function triggered at ${today}.${month} ${hours}:${minutes}:${seconds}.`);
  
  report();
  clearReport();
}, {
  scheduled: true,
  timezone: "Europe/Kiev"
});