const isValidAvatar = (req, res, next) => {
    if (req.file === undefined) {
       return res.status(400).json({ "message": "Avatar is not found" })
    }
    next();
}

module.exports = isValidAvatar;