const { google } = require("googleapis");

async function getAdSpendDirect() {
  const client = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  );

  await client.authorize(function (err, tokens) {
    if (err) {
      console.log(err);
    } else {
      console.log("Google sheets connection successfully");
    }
  });

  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1FN9W-Ii8nkxKyBpOkSGLlfh_UXidzRHVYXgxAw2TfaY";
  const range = "Custom report!A:F";

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = result.data.values;

  console.log(rows);

  if (!rows || rows.length === 0) return 0;

  const dateRange = rows[1][0];

  const ads = rows.slice(3).map((row) => ({
    name: row[0],                
    clicks: row[1],             
    conversions: row[2],        
    currency: row[3],            
    spend: row[4],               
    conversionCost: row[5],      
    date: dateRange
  }));

  return ads;
}

module.exports = { getAdSpendDirect };
