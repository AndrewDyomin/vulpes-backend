const mongoose = require("mongoose");
const dns = require('node:dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const getMoteaFeedItem = async (article) => {
  let connection;

  try {
    connection = await mongoose.createConnection(
      process.env.DB_MOTEA_FEED_URI
    ).asPromise();

    const result = await connection
      .collection("moteaitems")
      .findOne({ article: `${article}-0` });

    return result;

  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

module.exports = getMoteaFeedItem;