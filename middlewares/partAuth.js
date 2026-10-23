const jwt = require("jsonwebtoken");
const User = require("../models/user");

function partAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (typeof authHeader === "undefined") {
    req.headers.isAuth = false;
    next();
    return;
  }

  const [bearer, token] = authHeader.split(" ", 2);

  if (bearer !== "Bearer") {
    req.headers.isAuth = false;
    next();
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decode) => {
    if (err) {
      req.headers.isAuth = false;
      next();
    }

    try {
      req.user = decode;

      const user = await User.findById(decode.id).exec();

      if (user === null) {
        req.headers.isAuth = false;
        next();
      }

      if (!user.token.includes(String(token))) {
        req.headers.isAuth = false;
        next();
      }

      req.user = { user };

      req.headers.isAuth = true;
      next();
    } catch (error) {
      next(error);
    }
  });
}

module.exports = partAuth;