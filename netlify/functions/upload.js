const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    if (!body.file || !body.filename) {
        return { statusCode: 400, body: 'Missing file data' };
    }

    const fileBuffer = Buffer.from(body.file, 'base64');
    
    // 1. Upload to Pixeldrain
    const form = new FormData();
    form.append('file', fileBuffer, { filename: body.filename });

    console.log(`Uploading ${body.filename} to Pixeldrain...`);
    
    const uploadRes = await axios.post('https://pixeldrain.com/api/file', form, {
      headers: form.getHeaders(),
      timeout: 8000 // 8 second timeout to stay within Netlify's 10s limit
    });

    if (uploadRes.status === 201 || uploadRes.status === 200) {
      const fileId = uploadRes.data.id;
      const longUrl = `https://pixeldrain.com/u/${fileId}`;
      
      // 2. Shorten the link (Wrap in try-catch so it doesn't break if it fails)
      let shortUrl = longUrl;
      try {
        const shortenRes = await axios.get(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`, { timeout: 2000 });
        shortUrl = shortenRes.data.shorturl;
      } catch (e) {
        console.warn('Shortening failed, using long URL');
      }

      // 3. Generate 6-char code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let shortCode = '';
      for (let i = 0; i < 6; i++) {
        shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // 4. Store in KV store
      try {
        await axios.post(`https://kvdb.io/K99U4v7Y8vXN6t8pP6r1G1/${shortCode}`, longUrl, { timeout: 2000 });
      } catch (e) {
        console.warn('KV Store failed');
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: shortCode,
          shortUrl: shortUrl 
        })
      };
    } else {
      return { statusCode: 500, body: 'Pixeldrain rejected the upload' };
    }
  } catch (error) {
    console.error('Function Error:', error.message);
    return {
      statusCode: 500,
      body: `Server Error: ${error.message}`
    };
  }
};
