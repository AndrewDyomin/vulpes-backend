const bcrypt = require("bcrypt");
const userSchema = require("../schemas/user");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar")

async function register(req, res, next) {
  const response = userSchema.validate(req.body, { abortEarly: false });

  if (typeof response.error !== "undefined") {
    return res
      .status(400)
      .send(response.error.details.map((err) => err.message).join(", "));
  }

  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email }).exec();

    if (user !== null) {
      return res.status(409).json({ message: "Email in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarURL = gravatar.url(email);

    await User.create({ name, email, password: passwordHash, avatarURL });
    user = await User.findOne({ email }).exec();

    const token = jwt.sign(
      { id: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    await User.findByIdAndUpdate(user._id, { token: [token] }).exec();

    res
      .status(201)
      .send({ token, user: { email: user.email } });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).exec();

    if (user === null) {

      return res
        .status(401)
        .send({ message: "Email or password is incorrect" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {

      return res.status(401).json({ message: "Email or password is wrong" });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    if (user.token.length >= 2) {
      const newTokens = [user.token[1], token];
      await User.findByIdAndUpdate(user._id, { token: newTokens }).exec();
    } else {
      const newTokens = [user.token[0], token];
      await User.findByIdAndUpdate(user._id, { token: newTokens }).exec();
    }

    res
      .status(200)
      .send({ token, user: { email: user.email, name: user.name, description: user.description } });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const { _id } = req.user.user;

    await User.findByIdAndUpdate(_id, { token: [''] }).exec();

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function current(req, res, next) {
  try {
  const { email, description, name } = req.user.user;

  res
  .status(200)
  .send({ user: { email, description, name } });
  } catch(error) {
    next(error);
  }
}

module.exports = { register, login, logout, current };
