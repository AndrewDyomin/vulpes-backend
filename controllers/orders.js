
async function getAll(req, res, next) {
  try {

    res.status(200).json({ orders: "All orders" });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll };