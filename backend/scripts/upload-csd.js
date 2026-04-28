#!/usr/bin/env node
// Load environment variables from backend/.env when running scripts directly
try {
  const dotenv = require('dotenv');
  const path = require('path');
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
} catch (e) { /* ignore if dotenv not installed */ }
const fs = require('fs');
const path = require('path');
const fact = require('../services/facturamaService');

// Usage: node upload-csd.js <cert.cer> <key.key> <csdPassword> <RFC>
const [,, cerPath, keyPath, csdPassword, rfc] = process.argv;
if (!cerPath || !keyPath || !csdPassword || !rfc) {
  console.error('Usage: node upload-csd.js <cert.cer> <key.key> <csdPassword> <RFC>');
  process.exit(2);
}

try {
  const cer = fs.readFileSync(path.resolve(cerPath));
  const key = fs.readFileSync(path.resolve(keyPath));
  const cerB64 = Buffer.from(cer).toString('base64');
  const keyB64 = Buffer.from(key).toString('base64');

  (async () => {
    try {
      const res = await fact.subirCSD(cerB64, keyB64, csdPassword, rfc);
      console.log('subirCSD result:', JSON.stringify(res, null, 2));
      process.exit(0);
    } catch (err) {
      console.error('subirCSD error:', err);
      process.exit(1);
    }
  })();
} catch (err) {
  console.error('File read error:', err);
  process.exit(1);
}
