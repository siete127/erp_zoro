#!/usr/bin/env node
require("dotenv").config();

const sql = require("mssql");
const bcrypt = require("bcryptjs");
const { getRequiredEnv } = require("./config/env");

const config = {
  user: getRequiredEnv("DB_USER"),
  password: getRequiredEnv("DB_PASSWORD"),
  server: getRequiredEnv("DB_SERVER"),
  database: getRequiredEnv("DB_DATABASE"),
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
    connectionTimeout: 30000,
    requestTimeout: 300000,
  },
};

async function createSuperAdmin() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log("Conectado a la base de datos ERP");

    const existingResult = await pool.request()
      .query("SELECT TOP 1 * FROM ERP_USERS WHERE RolId = 1");

    if (existingResult.recordset.length > 0) {
      console.log("SuperAdmin ya existe:");
      const sa = existingResult.recordset[0];
      console.log(`  - Username: ${sa.Username}`);
      console.log(`  - Email: ${sa.Email}`);
      console.log(`  - Activo: ${sa.IsActive}`);
    } else {
      const username = process.env.SUPERADMIN_USERNAME || "superadmin";
      const email = process.env.SUPERADMIN_EMAIL || "superadmin@example.com";
      const password = getRequiredEnv("SUPERADMIN_PASSWORD");
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      console.log("Creando nuevo SuperAdmin...");
      console.log(`  - Username: ${username}`);
      console.log(`  - Email: ${email}`);

      await pool.request()
        .input("username", sql.VarChar, username)
        .input("password", sql.VarChar, hashedPassword)
        .input("email", sql.VarChar, email)
        .input("firstname", sql.VarChar, "Super")
        .input("lastname", sql.VarChar, "Admin")
        .input("rol", sql.Int, 1)
        .query(`
          INSERT INTO ERP_USERS (Username, Password, Email, FirstName, LastName, RolId, IsActive, CreationDate)
          VALUES (@username, @password, @email, @firstname, @lastname, @rol, 1, GETDATE());
          SELECT SCOPE_IDENTITY() AS User_Id;
        `);

      console.log("SuperAdmin creado exitosamente");
      console.log("Configura las credenciales seguras mediante variables de entorno.");
    }

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    await pool.close();
    process.exit(1);
  }
}

createSuperAdmin();
