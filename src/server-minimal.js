// Absolute minimal server for debugging
console.log('=== MINIMAL SERVER STARTING ===');

// Try to load .env.production first, fallback to .env
const dotenv = require('dotenv');
const fs = require('fs');

if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
  console.log('✓ Loaded .env.production');
} else if (fs.existsSync('.env')) {
  dotenv.config();
  console.log('✓ Loaded .env');
} else {
  console.log('⚠ No .env file found, using system environment variables');
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('Express loaded, PORT:', PORT);

app.get('/', (req, res) => {
  res.send('Hello from minimal server!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Minimal server running',
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'SET' : 'NOT SET'
    }
  });
});

console.log('Routes defined, starting server...');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Minimal server listening on port ${PORT}`);
}).on('error', (err) => {
  console.error('✗ Server error:', err.message);
  process.exit(1);
});

console.log('Server.listen() called');
