// Absolute minimal server for debugging
console.log('=== MINIMAL SERVER STARTING v1.0.1 ===');
console.log('Timestamp:', new Date().toISOString());

// Log BEFORE setting env vars
console.log('BEFORE hardcoded fallbacks:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'EXISTS (' + process.env.DATABASE_URL.length + ' chars)' : 'MISSING',
  SESSION_SECRET: process.env.SESSION_SECRET ? 'EXISTS (' + process.env.SESSION_SECRET.length + ' chars)' : 'MISSING',
  NODE_ENV: process.env.NODE_ENV || 'MISSING'
});

// TEMPORARY: Force set env vars (Hostinger environment variables not working)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === '') {
  console.log('Setting DATABASE_URL hardcoded fallback...');
  process.env.DATABASE_URL = 'mysql://u210215546_estimax_user:Karlo1242773831%214815162342@localhost/u210215546_estimax';
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === '') {
  console.log('Setting SESSION_SECRET hardcoded fallback...');
  process.env.SESSION_SECRET = '301d6a034fec732305b18772883b954db244d90075aa688da2b32bff8719f836';
}
if (!process.env.NODE_ENV || process.env.NODE_ENV === '') {
  console.log('Setting NODE_ENV hardcoded fallback...');
  process.env.NODE_ENV = 'production';
}

// Log AFTER setting env vars
console.log('AFTER hardcoded fallbacks:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET',
  SESSION_SECRET: process.env.SESSION_SECRET ? 'SET (' + process.env.SESSION_SECRET.length + ' chars)' : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT
});

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
    version: 'v1.0.1-' + Date.now(),
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'SET' : 'NOT SET'
    },
    rawCheck: {
      DATABASE_URL_type: typeof process.env.DATABASE_URL,
      DATABASE_URL_value: process.env.DATABASE_URL || 'UNDEFINED',
      SESSION_SECRET_type: typeof process.env.SESSION_SECRET,
      SESSION_SECRET_exists: !!process.env.SESSION_SECRET
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
