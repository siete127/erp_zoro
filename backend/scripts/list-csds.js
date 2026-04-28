#!/usr/bin/env node
// Load environment variables from backend/.env when running scripts directly
try {
  const dotenv = require('dotenv');
  const path = require('path');
  const envPath = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
} catch (e) { /* ignore if dotenv not installed */ }
const fact = require('../services/facturamaService');

// Optional: pass authBase64 as first arg (otherwise uses global credentials from env)
const authArg = process.argv[2] || null;

(async () => {
  try {
    const csds = await fact.listarCSDs(authArg || null);
    console.log('CSDs found:', JSON.stringify(csds, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error listing CSDs:', err);
    process.exit(1);
  }
})();
