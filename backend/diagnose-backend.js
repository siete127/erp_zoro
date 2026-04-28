#!/usr/bin/env node

/**
 * Script de diagnóstico para resolver el error 500 en login y WebSocket
 * Uso: node diagnose-backend.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('\n' + '='.repeat(70));
console.log('🔍 DIAGNÓSTICO - Error 500 en Login + WebSocket Fallido');
console.log('='.repeat(70) + '\n');

// Step 1: Check if backend is running
console.log('1️⃣  Verificando si el backend está corriendo en puerto 5000...\n');

const checkBackend = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5000/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('   ✅ Backend ESTÁ corriendo');
          console.log(`   Response: ${JSON.stringify(json, null, 2)}\n`);
          resolve(true);
        } catch {
          console.log('   ⚠️  Backend responde pero con error JSON\n');
          resolve(true);
        }
      });
    }).on('error', (err) => {
      console.log('   ❌ Backend NO está corriendo');
      console.log(`   Error: ${err.code}\n`);
      resolve(false);
    });
    
    setTimeout(() => {
      req.abort();
      resolve(false);
    }, 3000);
  });
};

checkBackend().then(async (isRunning) => {
  if (!isRunning) {
    console.log('='.repeat(70));
    console.log('🚨 SOLUCIÓN: INICIA EL BACKEND');
    console.log('='.repeat(70) + '\n');
    
    console.log('Abre una NUEVA terminal y ejecuta:\n');
    console.log('   cd backend');
    console.log('   node server.js\n');
    
    console.log('Deberías ver:\n');
    console.log('   ✅ Variables de entorno validadas correctamente');
    console.log('   ✅ ERP Backend iniciado correctamente');
    console.log('   📡 API escuchando en: http://localhost:5000\n');
    
    console.log('Una vez que el backend esté corriendo:\n');
    console.log('   1. Recarga la página en el navegador (Ctrl+R o Cmd+R)');
    console.log('   2. El login debería funcionar');
    console.log('   3. El WebSocket debería conectar\n');
    
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('✅ Backend ESTÁ corriendo - Diagnosticando otros problemas');
  console.log('='.repeat(70) + '\n');

  // Step 2: Check if .env exists
  console.log('2️⃣  Verificando archivo backend/.env...\n');
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('   ❌ backend/.env NO existe\n');
    console.log('   Solución: Copia backend/.env.example a backend/.env\n');
    process.exit(1);
  }
  console.log('   ✅ backend/.env existe\n');

  // Step 3: Check database connection
  console.log('3️⃣  Verificando conexión a base de datos...\n');
  
  const { pool } = require('./config/db');
  try {
    const result = await pool.request().query('SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = "ERP_USERS"');
    const tableExists = result.recordset[0].cnt > 0;
    
    if (tableExists) {
      console.log('   ✅ Base de datos conectada');
      console.log('   ✅ Tabla ERP_USERS existe\n');
    } else {
      console.log('   ✅ Base de datos conectada');
      console.log('   ❌ Tabla ERP_USERS NO existe\n');
      console.log('   Solución: Ejecuta los scripts de base de datos para crear las tablas\n');
      process.exit(1);
    }
  } catch (err) {
    console.log('   ❌ Error conectando a base de datos\n');
    console.log(`   Error: ${err.message}\n`);
    console.log('   Soluciones posibles:');
    console.log('   1. Verifica que SQL Server está corriendo');
    console.log('   2. Verifica credenciales en backend/.env');
    console.log('   3. Verifica que la base de datos "ERP" existe\n');
    process.exit(1);
  }

  // Step 4: Check if there are any users
  console.log('4️⃣  Verificando usuarios en la base de datos...\n');
  
  try {
    const result = await pool.request().query('SELECT COUNT(*) AS cnt FROM ERP_USERS');
    const userCount = result.recordset[0].cnt;
    
    if (userCount > 0) {
      console.log(`   ✅ Hay ${userCount} usuario(s) en la base de datos\n`);
      console.log('   ✨ Todo debería funcionar correctamente\n');
      console.log('   Prueba:');
      console.log('   1. Recarga el navegador (Ctrl+R)');
      console.log('   2. Intenta hacer login\n');
    } else {
      console.log('   ⚠️  NO hay usuarios en la base de datos\n');
      console.log('   Solución: Crea un usuario superadmin con:');
      console.log('   $ cd backend');
      console.log('   $ node create-superadmin.js\n');
    }
  } catch (err) {
    console.log(`   ❌ Error consultando usuarios: ${err.message}\n`);
    process.exit(1);
  }

  console.log('='.repeat(70) + '\n');
});
