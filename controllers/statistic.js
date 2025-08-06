const CampaignResult = require("../models/campaignResult");

async function getAll(req, res, next) {
    const { role } = req?.user?.user;
  try {
    if (role === 'owner') {
      const array = await CampaignResult.find({}).exec();
      res.status(200).json({ array });  
    } else {
      res.status(200).json({ message: 'Access denied' })
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll };
