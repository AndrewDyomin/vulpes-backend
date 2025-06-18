const express = require("express");

const UsersController = require("../../controllers/users");
const { upload } = require("../../middlewares/upload");
const isValidAvatar = require("../../middlewares/isValidAvatar")

const router = express.Router();

router.get("/avatars", UsersController.getAvatar);
router.get("/all", UsersController.getAll);
router.post("/update", UsersController.updateUser);
router.post("/delete", UsersController.deleteUser);
router.patch("/avatars", upload.single("avatar"), isValidAvatar, UsersController.uploadAvatar)

module.exports = router;