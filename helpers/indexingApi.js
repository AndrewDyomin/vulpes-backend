const { google } = require("googleapis");

async function sendBatchToIndexing(urls = []) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("Список адресов пуст или не является массивом");
  }

  console.log('sending urls to index')

  // максимум 100 за раз
  const chunks = [];
  for (let i = 0; i < urls.length; i += 100) {
    chunks.push(urls.slice(i, i + 100));
  }

  const client = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/indexing"]
  );

  await client.authorize();

  const results = [];

  for (const chunk of chunks) {
    // Формируем multipart batch-запрос
    let body = "";
    chunk.forEach((url, idx) => {
      body += `--batch_boundary\n`;
      body += `Content-Type: application/http\n`;
      body += `Content-ID: ${idx + 1}\n\n`;
      body += `POST /v3/urlNotifications:publish HTTP/1.1\n`;
      body += `Content-Type: application/json\n\n`;
      body += JSON.stringify({
        url,
        type: "URL_UPDATED",
      }) + "\n\n";
    });
    body += `--batch_boundary--`;

    const res = await client.request({
      url: "https://indexing.googleapis.com/batch",
      method: "POST",
      headers: {
        "Content-Type": "multipart/mixed; boundary=batch_boundary",
      },
      body,
    });

    results.push({ chunk: chunk.length, response: res.data });
  }

  return results;
}

module.exports = { sendBatchToIndexing };