const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Generate a random 6-character alphanumeric code
function generateCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const code = generateCode();
        const expiry = Date.now() + EXPIRY_MS;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const finalName = `${code}_${expiry}_${safeName}`;
        req.generatedCode = code; // Pass code back to the request object
        cb(null, finalName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        code: req.generatedCode,
        expiresIn: '24 hours'
    });
});

// Download Endpoint
app.get('/download/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const files = fs.readdirSync(UPLOADS_DIR);
    
    const targetFile = files.find(f => f.startsWith(code + '_'));
    
    if (!targetFile) {
        return res.status(404).send('Invalid code or file not found.');
    }
    
    const parts = targetFile.split('_');
    const expiry = parseInt(parts[1]);
    const originalName = parts.slice(2).join('_');
    
    if (Date.now() > expiry) {
        fs.unlinkSync(path.join(UPLOADS_DIR, targetFile));
        return res.status(410).send('This file has expired.');
    }
    
    res.download(path.join(UPLOADS_DIR, targetFile), originalName);
});

// Cleanup Job: Runs every hour
setInterval(() => {
    console.log('Running cleanup job...');
    const files = fs.readdirSync(UPLOADS_DIR);
    const now = Date.now();
    
    files.forEach(file => {
        const parts = file.split('_');
        if (parts.length >= 3) {
            const expiry = parseInt(parts[1]);
            if (now > expiry) {
                fs.unlinkSync(path.join(UPLOADS_DIR, file));
                console.log(`Deleted expired file: ${file}`);
            }
        }
    });
}, 60 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`TempShare server running at http://localhost:${PORT}`);
});
