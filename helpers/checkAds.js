const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const axios = require("axios");

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});
const url = "https://vulpes.salesdrive.me/api/order/list/";
const headers = {
  "Form-Api-Key": process.env.SD_API_KEY,
  "Content-Type": "application/json",
};

async function getTargetOrders(startDate, endDate) {
  const allOrders = [];
  const fromDate = `${startDate} 00:00:00`;
  const toDate = `${endDate} 23:59:59`;

  const params = {
    page: 1,
    filter: {
      statusId: ["4", "5"],
      orderTime: {from: fromDate, to: toDate},
    },
  };
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`Fetching page ${params.page}...`);
      const response = await axios.get(url, { headers, params });
      const pagination = response.data.pagination;
      if (pagination.pageCount <= pagination.currentPage) {
        hasMore = false;
      }
      params.page++;
      const statusOptions = response.data.meta.fields.statusId.options;
      const ordersArray = response.data.data;

      for (const order of ordersArray) {
        const option = statusOptions.find(
          (status) => status.value === order.statusId
        );
        order.statusLabel = option.text;
        order.nCampaign = normalizeCampaignName(order.utmCampaign);
      }

      allOrders.push(...ordersArray);
    }
  } catch (error) {
    console.log(error)
  }
  
  return allOrders;
}

function normalizeCampaignName(name) {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/campaignname/g, '');
}

async function getAdSpendDirect(startDate, endDate) {
  const propertyId = process.env.GA4_ID;

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "campaignName" }],
    metrics: [{ name: "advertiserAdCost" }, { name: "advertiserAdClicks" }],
  });

  const campaignsList = [];

  for (const row of response.rows) {
  const nCampaign = normalizeCampaignName(row.dimensionValues[1].value);
  let target = campaignsList.find(c => c.nCampaign === nCampaign);

  if (!target) {
    target = {
      date: { startDate, endDate },
      campaign: row.dimensionValues[1].value,
      nCampaign,
      cost: 0,
      clicks: 0,
      orders: [],
      cash: 0,
    };
    campaignsList.push(target);
  }

  target.cost += Math.round(parseFloat(row.metricValues[0].value) * 100) / 100;
  target.clicks += parseInt(row.metricValues[1].value);
}

  const orders = await getTargetOrders(startDate, endDate);
  
  for (const order of orders) {
    if (order.nCampaign === '') continue;
    const target = campaignsList.find(cam => cam.nCampaign === order.nCampaign)
    if (target) {
      target.cash += order.paymentAmount;
      target.orders.push(order.id)
    }
  }

  return campaignsList;
}

module.exports = { getAdSpendDirect };
