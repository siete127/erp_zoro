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

async function createSuperAdmin() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Conectado a la base de datos ERP');

    // Verificar si existe un SuperAdmin
    const existingResult = await pool.request()
      .query('SELECT TOP 1 * FROM ERP_USERS WHERE RolId = 1');

    if (existingResult.recordset.length > 0) {
      console.log('✓ SuperAdmin ya existe:');
      const sa = existingResult.recordset[0];
      console.log(`  - Username: ${sa.Username}`);
      console.log(`  - Email: ${sa.Email}`);
      console.log(`  - Activo: ${sa.IsActive}`);
    } else {
      // Generar hash bcrypt
      const password = 'SuperAdmin123';
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      console.log('Creando nuevo SuperAdmin...');
      console.log(`  - Username: superadmin`);
      console.log(`  - Password: ${password}`);
      console.log(`  - Email: superadmin@ardaby.com`);

      // Insertar nuevo SuperAdmin
      await pool.request()
        .input('username', sql.VarChar, 'superadmin')
        .input('password', sql.VarChar, hashedPassword)
        .input('email', sql.VarChar, 'superadmin@ardaby.com')
        .input('firstname', sql.VarChar, 'Super')
        .input('lastname', sql.VarChar, 'Admin')
        .input('rol', sql.Int, 1)
        .query(`
          INSERT INTO ERP_USERS (Username, Password, Email, FirstName, LastName, RolId, IsActive, CreationDate)
          VALUES (@username, @password, @email, @firstname, @lastname, @rol, 1, GETDATE());
          SELECT SCOPE_IDENTITY() AS User_Id;
        `);

      console.log('✓ SuperAdmin creado exitosamente');
      console.log('\n📝 Credenciales de prueba:');
      console.log('  - Usuario: superadmin');
      console.log('  - Contraseña: SuperAdmin123');
    }

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.close();
    process.exit(1);
  }
}

createSuperAdmin();
