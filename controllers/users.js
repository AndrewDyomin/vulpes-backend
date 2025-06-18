const fs = require("node:fs/promises");
const path = require("node:path");
const jimp = require("jimp");

const User = require("../models/user");

async function resizeImage(path) {
  const image = await jimp.read(path);

  image.contain(250, 250);

  await image.writeAsync(path);
};

async function getAvatar(req, res, next) {
  try {
    const user = await User.findById(req.user.user.id).exec();

    if (user === null) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.avatarURL === null) {
      return res.status(404).send({ message: "Avatar not found" });
    }

    res.send(user.avatarURL);
  } catch (error) {
    next(error);
  }
}

async function uploadAvatar(req, res, next) {
  try {

    await resizeImage(req.file.path);

    await fs.rename(
      req.file.path,
      path.join(__dirname, "..", "public/avatars", req.file.filename)
    );

    const user = await User.findByIdAndUpdate(
      req.user.user.id,
      { avatarURL: `/avatars/${req.file.filename}` },
      { new: true }
    ).exec();

    if (user === null) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    next(error);
  }
}

async function getAll(req, res, next) {
  try {
    const user = await User.findById(req.user.user.id).exec();

    if (user.description === 'administrator') {
      const usersArray = await User.find({}).exec();
      return res.status(200).send({ usersArray });
    }

    res.status(200).send({ message: "Sorry. You do not have an access." });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.user.user.id).exec();

    if (user.description === 'administrator') {

      const { _id, name, email, description, organization, access } = req.body;

      await User.findByIdAndUpdate(_id, { name, email, description, organization, access }, { new: true }).exec();
      
      return res.status(200).send({ message: 'User was updated.' });
    }

    res.status(200).send({ message: "Sorry. You do not have an access." });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.user.user.id).exec();

    if (user.description === 'administrator') {

      const { _id } = req.body;

      await User.findByIdAndDelete(_id).exec();
      
      return res.status(200).send({ message: 'User was deleted.' });
    }

    res.status(200).send({ message: "Sorry. You do not have an access." });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAvatar, uploadAvatar, getAll, updateUser, deleteUser };
