const mongoose = require("mongoose");
require("dotenv").config();

const DB_URI = process.env.DB_URI;

mongoose
  .connect(DB_URI)
  .then(() => console.info("Database connection: ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
