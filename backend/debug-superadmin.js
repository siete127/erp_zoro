#!/usr/bin/env node
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const config = {
  user: "sa",
  password: "D1g1t4l3dg32024.",
  server: "74.208.195.73",
  database: "ERP",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectionTimeout: 30000,
    requestTimeout: 300000
  }
};

async function debugSuperAdmin() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Conectado a la base de datos ERP\n');

    // Obtener el usuario SuperAdmin
    const result = await pool.request()
      .input('username', sql.VarChar, 'superadmin')
      .query('SELECT User_Id, Username, Email, Password, RolId FROM ERP_USERS WHERE Username = @username AND RolId = 1');

    if (result.recordset.length === 0) {
      console.error('❌ SuperAdmin no encontrado');
      process.exit(1);
    }

    const user = result.recordset[0];
    console.log('📊 Datos actuales del SuperAdmin:');
    console.log(`  - User_Id: ${user.User_Id}`);
    console.log(`  - Username: ${user.Username}`);
    console.log(`  - Email: ${user.Email}`);
    console.log(`  - RolId: ${user.RolId}`);
    console.log(`  - Password Hash: ${user.Password.substring(0, 50)}...`);

    // Probar si la contraseña guardada coincide con "SuperAdmin123"
    console.log('\n🔐 Verificando contraseña guardada:');
    const testPassword = 'SuperAdmin123';
    const isValid = await bcrypt.compare(testPassword, user.Password);
    console.log(`  - ¿"SuperAdmin123" es válida? ${isValid ? '✓ SÍ' : '✗ NO'}`);

    if (!isValid) {
      console.log('\n⚠️  La contraseña no coincide. Voy a generar un nuevo hash...');
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log(`  - Nuevo hash: ${newHash}`);
      
      console.log('\nActualizando en la BD...');
      await pool.request()
        .input('userid', sql.Int, user.User_Id)
        .input('newhash', sql.VarChar, newHash)
        .query('UPDATE ERP_USERS SET Password = @newhash WHERE User_Id = @userid');
      
      console.log('✓ Contraseña actualizada\n');
    }

    // Intentar login con la API
    console.log('🔗 Probando login con la API...');
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        username: 'superadmin',
        password: 'SuperAdmin123'
      });
      
      console.log('✓ Login exitoso!');
      console.log(`  - Token: ${response.data.token.substring(0, 50)}...`);
      console.log(`  - Usuario: ${response.data.user.Username}`);
      console.log(`  - RolId: ${response.data.user.RolId}`);
    } catch (err) {
      console.log(`✗ Error en login: ${err.response?.data?.msg || err.message}`);
    }

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.close();
    process.exit(1);
  }
}

debugSuperAdmin();
