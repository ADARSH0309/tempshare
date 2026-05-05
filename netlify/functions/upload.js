const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Get GoFile Server
    const serverRes = await axios.get('https://api.gofile.io/getServer');
    const server = serverRes.data.data.server;

    // 2. Prepare the file (received as base64 from the frontend)
    const body = JSON.parse(event.body);
    const fileBuffer = Buffer.from(body.file, 'base64');
    
    const form = new FormData();
    form.append('file', fileBuffer, { filename: body.filename });

    // 3. Upload to GoFile from Netlify's server
    const uploadRes = await axios.post(`https://${server}.gofile.io/uploadFile`, form, {
      headers: form.getHeaders()
    });

    if (uploadRes.data.status === 'ok') {
      const downloadPage = uploadRes.data.data.downloadPage;
      const shortCode = Math.random().toString(36).substr(2, 6).toUpperCase();

      // 4. Save to KV database
      await axios.post(`https://kvdb.io/K99U4v7Y8vXN6t8pP6r1G1/${shortCode}`, downloadPage);

      return {
        statusCode: 200,
        body: JSON.stringify({ code: shortCode })
      };
    } else {
      throw new Error('GoFile upload failed');
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
