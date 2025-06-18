const fs = require("fs");
const { google } = require("googleapis");
// const path = require("node:path");
// const crypto = require("node:crypto");
// const multer = require("multer");

async function uploadToDisk(req, res, next) {
  const imageLinks = [];
  // start autorization ----------------------
  try {
    const client = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/drive"]
    );

    client.authorize(function (err, tokens) {
      if (err) {
        console.log(err);
        
      } else {
        console.log("Google drive connection successfully");
      }
    });

    const service = google.drive({ version: "v3", auth: client });

    // end autorization ----------------------

    // send to GOOGLE ------------------------

    const files = req.files;

    for (const file of files) {
      const fileMetadata = {
        name: file.filename,
        parents: [process.env.ORDER_FOTO_FOLDER],
      };
      const media = {
        mimeType: "image/jpeg",
        body: fs.createReadStream(file.path),
      };

      const response = await service.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });

      imageLinks.push(response.data.id);

      fs.unlink(file.path, (err) => {
        if (err) {
          console.error("Error", err);
          
        }
      });
    }
    if (!req.body.images || req.body.images.length === 0) {
      req.body.images = imageLinks
    } else {
      const newArray = [ ...req.body.images, ...imageLinks];
      req.body.images = newArray;
    }
    next();
  } catch (error) {
    console.log(error);
  }
}

module.exports = uploadToDisk;
