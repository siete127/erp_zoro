#!/usr/bin/env node

/**
 * Script de prueba para verificar que el backend puede iniciar correctamente
 * Uso: node test-backend-startup.js
 */

const path = require('path');
const fs = require('fs');

console.log('\n' + '='.repeat(70));
console.log('🧪 TEST DE STARTUP - BACKEND ERP');
console.log('='.repeat(70) + '\n');

// Verificación 1: .env existe
console.log('1️⃣  Verificando que backend/.env existe...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ backend/.env encontrado\n');
} else {
  console.log('   ❌ backend/.env NO encontrado');
  console.log('   📝 Copia backend/.env.example a backend/.env\n');
  process.exit(1);
}

// Carga variables de entorno
require('dotenv').config();

// Verificación 2: Variables de entorno
console.log('2️⃣  Validando variables de entorno...');
const required = [
  'DB_SERVER',
  'DB_PORT',
  'DB_DATABASE',
  'DB_USER',
  'DB_PASSWORD',
  'ERP_SECRET_KEY',
  'PORT',
  'FRONTEND_URL'
];

const missing = required.filter(env => !process.env[env] || !String(process.env[env]).trim());
if (missing.length === 0) {
  console.log('   ✅ Todas las variables requeridas están presentes\n');
} else {
  console.log(`   ❌ Faltan ${missing.length} variable(s):`);
  missing.forEach(v => console.log(`      - ${v}`));
  console.log('');
  process.exit(1);
}

// Verificación 3: ERP_SECRET_KEY longitud
console.log('3️⃣  Validando longitud de ERP_SECRET_KEY...');
if (process.env.ERP_SECRET_KEY.length >= 32) {
  console.log(`   ✅ ERP_SECRET_KEY tiene ${process.env.ERP_SECRET_KEY.length} caracteres (mínimo: 32)\n`);
} else {
  console.log(`   ❌ ERP_SECRET_KEY tiene solo ${process.env.ERP_SECRET_KEY.length} caracteres (mínimo: 32)\n`);
  process.exit(1);
}

// Verificación 4: PORT es numérico
console.log('4️⃣  Validando que PORT es numérico...');
if (!isNaN(Number(process.env.PORT))) {
  console.log(`   ✅ PORT=${process.env.PORT} (válido)\n`);
} else {
  console.log(`   ❌ PORT=${process.env.PORT} (debe ser un número)\n`);
  process.exit(1);
}

// Verificación 5: Cargar el validador de entorno
console.log('5️⃣  Importando validador de entorno...');
try {
  const { validateEnvironment, getJwtSecret } = require('./config/env');
  validateEnvironment();
  const secret = getJwtSecret();
  console.log('   ✅ Validador de entorno importado correctamente\n');
} catch (error) {
  console.log(`   ❌ Error en validador: ${error.message}\n`);
  process.exit(1);
}

// Resumen
console.log('='.repeat(70));
console.log('✅ TODAS LAS VERIFICACIONES PASARON');
console.log('='.repeat(70));
console.log('\n📊 Configuración del Backend:\n');
console.log(`   Puerto:               ${process.env.PORT}`);
console.log(`   Base de Datos:        ${process.env.DB_USER}@${process.env.DB_SERVER}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`);
console.log(`   Frontend URL:         ${process.env.FRONTEND_URL}`);
console.log(`   JWT Secret Length:    ${process.env.ERP_SECRET_KEY.length} caracteres`);
console.log('\n🚀 El backend debería poder iniciar sin problemas.\n');
console.log('Usa: node server.js\n');
console.log('='.repeat(70) + '\n');

process.exit(0);
