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

async function updateSuperAdminPassword() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log("Conectado a la base de datos ERP");

    const username = process.env.SUPERADMIN_USERNAME || "superadmin";
    const newPassword = getRequiredEnv("SUPERADMIN_PASSWORD");
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    console.log("Actualizando contrasena del SuperAdmin...");

    await pool.request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, hashedPassword)
      .query("UPDATE ERP_USERS SET Password = @password WHERE Username = @username AND RolId = 1");

    console.log("Contrasena actualizada exitosamente");
    console.log(`  - Usuario actualizado: ${username}`);
    console.log("Configura la contrasena segura mediante SUPERADMIN_PASSWORD.");

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    await pool.close();
    process.exit(1);
  }
}

updateSuperAdminPassword();
