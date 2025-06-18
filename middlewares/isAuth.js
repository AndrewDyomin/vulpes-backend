const jwt = require("jsonwebtoken");

const User = require("../models/user");

function isAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (typeof authHeader === "undefined") {
    return res.status(401).json({ "message": "Not authorized" });
  }

  const [bearer, token] = authHeader.split(" ", 2);

  if (bearer !== "Bearer") {
    return res.status(401).json({ "message": "Not authorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decode) => {
    if (err) {
      return res.status(401).json({ "message": "Not authorized" });
    }

    try {
      req.user = decode;

      const user = await User.findById(decode.id).exec();

      if (user === null) {
        return res.status(401).json({ "message": "Not authorized" });
      }

      if (!user.token.includes(String(token))) {
        return res.status(401).json({ "message": "Not authorized" });
      }

      req.user = { user };

      next();
    } catch (error) {
      next(error);
    }
  });
}

module.exports = isAuth;