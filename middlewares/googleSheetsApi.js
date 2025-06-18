require('dotenv').config();
const { google } = require('googleapis');


function googleSheetsApi(req, res, next) {

    try {

       const client = new google.auth.JWT(
            process.env.GOOGLE_CLIENT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        client.authorize(function(err, tokens) {
            if (err) {
                console.log(err);
                
            } else {
                console.log('Google sheets connection successfully');
            }
        }); 

    req.sheets = { client };

    next();
    } catch (error) {
    next(error);
    }
}

module.exports = googleSheetsApi;