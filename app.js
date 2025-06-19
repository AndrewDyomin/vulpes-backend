const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const path = require("node:path");
require("./db");
require("./helpers/scheduledActions")

const authRoutes = require("./routes/api/auth");
const usersRoutes = require("./routes/api/users");
const productsRoutes = require("./routes/api/products");
const isAuth = require("./middlewares/isAuth");

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use("/avatars", express.static(path.join(__dirname, "public", "avatars")));
app.use(logger(formatsLogger));
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", isAuth, usersRoutes);
app.use("/products", isAuth, productsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

module.exports = app;
