const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const fileBuffer = Buffer.from(body.file, 'base64');
    
    // 1. Upload to Pixeldrain (Very stable, no 401 errors)
    const form = new FormData();
    form.append('file', fileBuffer, { filename: body.filename });

    const uploadRes = await axios.post('https://pixeldrain.com/api/file', form, {
      headers: form.getHeaders()
    });

    if (uploadRes.status === 201 || uploadRes.status === 200) {
      const fileId = uploadRes.data.id;
      const longUrl = `https://pixeldrain.com/u/${fileId}`;
      
      // 2. Shorten the link using is.gd (Completely free, no account)
      const shortenRes = await axios.get(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
      const shortUrl = shortenRes.data.shorturl; // Looks like https://is.gd/xxxxxx

      // 3. Also generate the 6-digit code as a backup
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let shortCode = '';
      for (let i = 0; i < 6; i++) {
        shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Store in KV for the "Code" box to work
      await axios.post(`https://kvdb.io/K99U4v7Y8vXN6t8pP6r1G1/${shortCode}`, longUrl);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          code: shortCode,
          shortUrl: shortUrl 
        })
      };
    } else {
      return { statusCode: 500, body: 'Cloud Server Error' };
    }
  } catch (error) {
    console.error('Function Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
