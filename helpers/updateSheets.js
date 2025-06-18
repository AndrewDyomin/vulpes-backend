
async function updateSheets(sheets, spreadsheetId, range, value) {
    try {
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [value] },
        });
        return response;
    } catch(err) {
        console.log(err)
    }
}

module.exports = updateSheets;
