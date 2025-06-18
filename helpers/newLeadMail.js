const nodemailer = require("nodemailer");
require("dotenv").config();
const Model = require("../models/model");

async function newLeadMail(lead) {
  try {

    const { name, phone, email, product, message } = lead;
    const model = await Model.findById(product).exec();

    const letterTitle = `Новая заявка`;
    const letterHtml = `
            <h3>Добрый день</h3>
            <p>У вас есть новая заявка</p>
            <p>Имя: ${name === '' ? '-' : name}</p>
            <p>Телефон: ${phone === '' ? '-' : phone}</p>
            <p>Почта: ${email === '' ? '-' : email}</p>
            <p>Модель: ${product === '' ? '-' : model.name}</p>
            <p>Сообщение: ${message === '' ? '-' : message}</p>
            <a href='https://myagkof-furniture.vercel.app/leads'>Заявки</a>
            `;

    const addresses = 'TARGET MAIL';

    const config = {
      host: "smtp.meta.ua",
      port: 465,
      secure: true,
      auth: {
        user: "OUR.bot@meta.ua",
        pass: process.env.PASSWORD,
      },
    };

    const transporter = nodemailer.createTransport(config);
    const emailOptions = {
      from: "OUR.bot@meta.ua",
      to: addresses,
      subject: `${letterTitle}`,
      html: `${letterHtml}`,
    };

    transporter
      .sendMail(emailOptions)
      .then(() => {console.log(`Letter to ${addresses} sended`)})
      .catch((err) => console.log(err));
  } catch (err) {
    console.log(err);
  }
}

module.exports = newLeadMail;