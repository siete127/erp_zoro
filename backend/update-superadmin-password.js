#!/usr/bin/env node
const sql = require('mssql');
const bcrypt = require('bcryptjs');

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

async function updateSuperAdminPassword() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Conectado a la base de datos ERP');

    const newPassword = 'SuperAdmin123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log('Actualizando contraseña del SuperAdmin...');
    
    await pool.request()
      .input('username', sql.VarChar, 'superadmin')
      .input('password', sql.VarChar, hashedPassword)
      .query('UPDATE ERP_USERS SET Password = @password WHERE Username = @username AND RolId = 1');

    console.log('✓ Contraseña actualizada exitosamente');
    console.log('\n📝 Credenciales para login:');
    console.log('  - Usuario: superadmin');
    console.log(`  - Contraseña: ${newPassword}`);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.close();
    process.exit(1);
  }
}

updateSuperAdminPassword();
