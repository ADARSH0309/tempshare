const https = require('https');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        if (!body.file || !body.filename) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
        }

        const fileBuffer = Buffer.from(body.file, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        // 1. Upload to Pixeldrain
        const uploadData = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'pixeldrain.com',
                path: '/api/file',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });

            req.on('error', reject);

            req.write(`--${boundary}\r\n`);
            req.write(`Content-Disposition: form-data; name="file"; filename="${body.filename}"\r\n`);
            req.write('Content-Type: application/octet-stream\r\n\r\n');
            req.write(fileBuffer);
            req.write(`\r\n--${boundary}--\r\n`);
            req.end();
        });

        if (uploadData.status === 200 || uploadData.status === 201) {
            const pixData = JSON.parse(uploadData.body);
            const downloadUrl = `https://pixeldrain.com/u/${pixData.id}`;

            // 2. Generate 6-char code
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let shortCode = '';
            for (let i = 0; i < 6; i++) {
                shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // 3. Store in KV store
            await new Promise((resolve) => {
                const req = https.request(`https://kvdb.io/K99U4v7Y8vXN6t8pP6r1G1/${shortCode}`, { method: 'POST' }, (res) => {
                    res.on('data', () => {});
                    res.on('end', resolve);
                });
                req.write(downloadUrl);
                req.end();
            });

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: shortCode, shortUrl: downloadUrl })
            };
        } else {
            return { statusCode: 500, body: JSON.stringify({ error: 'Pixeldrain Upload Failed' }) };
        }

    } catch (error) {
        console.error('Final Error:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
