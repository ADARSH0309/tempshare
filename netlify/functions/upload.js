const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const fileBuffer = Buffer.from(body.file, 'base64');
    
    const form = new FormData();
    form.append('file', fileBuffer, { filename: body.filename });

    // Upload to Pixeldrain from Netlify's server (Bypasses local ISP)
    const uploadRes = await axios.post('https://pixeldrain.com/api/file', form, {
      headers: form.getHeaders()
    });

    if (uploadRes.status === 201 || uploadRes.status === 200) {
      const fileId = uploadRes.data.id;
      const downloadUrl = `https://pixeldrain.com/u/${fileId}`;
      
      // Generate 6-char code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let shortCode = '';
      for (let i = 0; i < 6; i++) {
        shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Save mapping in KV store
      await axios.post(`https://kvdb.io/K99U4v7Y8vXN6t8pP6r1G1/${shortCode}`, downloadUrl);

      return {
        statusCode: 200,
        body: JSON.stringify({ code: shortCode })
      };
    } else {
      return { statusCode: 500, body: 'Cloud Upload Failed' };
    }
  } catch (error) {
    console.error('Function Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
