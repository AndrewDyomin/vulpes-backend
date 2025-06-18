const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
  },
  role: {
    type: String,
    enum: ["owner", "administrator", "manager", "guest"],
    default: "guest",
    required: [true, "Role is required"],
  },
  organization: {
    type: String,
    default: "demo",
  },
  token: {
    type: Array,
    default: [''],
  },
  avatarURL: {
    type: String,
    default: null,
  },
  name: {
    type: String,
    required: [true, "Name is required"],
  }
});

module.exports = mongoose.model("User", userSchema);
