// Absolute minimal server for debugging
console.log('=== MINIMAL SERVER STARTING ===');

// TEMPORARY: Hardcode env vars if not set (Hostinger isn't loading them properly)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://u210215546_estimax_user:Karlo1242773831%214815162342@localhost/u210215546_estimax';
  process.env.SESSION_SECRET = '301d6a034fec732305b18772883b954db244d90075aa688da2b32bff8719f836';
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  console.log('✓ Hardcoded environment variables (TEMPORARY FIX)');
}

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
  console.log('⚠ No .env file found');
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('Express loaded, PORT:', PORT);

app.get('/', (req, res) => {
  res.send('Hello from minimal server!');
});

app.get('/health', (req, res) => {
  const path = require('path');
  const cwd = process.cwd();
  const envProductionPath = path.join(cwd, '.env.production');
  const envPath = path.join(cwd, '.env');

  res.json({
    status: 'ok',
    message: 'Minimal server running',
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'SET' : 'NOT SET'
    },
    debug: {
      cwd: cwd,
      envProductionExists: fs.existsSync(envProductionPath),
      envExists: fs.existsSync(envPath),
      envProductionPath: envProductionPath,
      filesInCwd: fs.readdirSync(cwd).slice(0, 20)
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
